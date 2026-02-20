import argparse
import json
import os
import re
import logging
import shutil
import pandas as pd
from datetime import datetime
from google import genai
from google.genai import types

# --- CONFIGURATION ---
MODEL_ID = "gemini-2.5-flash" # Updated to latest stable flash model, adjust if needed

def get_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in environment variables.")
    return genai.Client(api_key=api_key)

def setup_logging(run_folder):
    log_file = os.path.join(run_folder, "run.log")
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(log_file, mode='a', encoding='utf-8'),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger()

# --- HELPER FUNCTIONS ---
def aksharamukha_transliterate(text, source_script, target_script="ISO"):
    try:
        from aksharamukha import transliterate
        if not text or pd.isna(text): return ""

        # 1. Perform the standard transliteration
        converted = transliterate.process(source_script, target_script, text)

        # 2. Apply Hindi Schwa Deletion (Fixing the "bahuta" -> "bahut" issue)
        if source_script == "Devanagari":
            # We must process word-by-word to catch the ends of words
            # Regex explanation:
            # (?<=[bcdfghjklmnpqrstvwxyz]) : Lookbehind to ensure previous char is a consonant (simplified)
            # a : The target char to remove
            # \b : Word boundary (end of word)
            # We strictly target 'a', NOT 'ā' (long a), 'i', 'u', etc.
            
            # This regex finds a short 'a' at the end of a word and removes it
            # It preserves 'sārā' (ends in ā) but fixes 'bahuta' (ends in a)
            converted = re.sub(r'(?<=[a-zA-Z])a\b', '', converted)

        return converted

    except ImportError:
        return "Error: Aksharamukha not installed"
    except Exception as e:
        return f"Error: {str(e)}"
# --- MODES ---

def prepare_run(input_csv, language):
    # 1. Create Unique Run Folder
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_folder = f"runs/{language}_{timestamp}"
    os.makedirs(run_folder, exist_ok=True)
    
    logger = setup_logging(run_folder)
    logger.info(f"--- MODE: PREPARE (Fresh Translation) ---")
    logger.info(f"Created run folder: {run_folder}")
    logger.info(f"Input CSV: {input_csv}")
    
    # 2. LOCATE PROMPT FILE AUTOMATICALLY
    # Expecting: prompts/prompt_hindiurdu.txt
    prompt_filename = f"prompt_{language.lower()}.txt"
    prompt_path = os.path.join("prompts", prompt_filename)
    
    if not os.path.exists(prompt_path):
        logger.error(f"CRITICAL: Prompt file not found at: {prompt_path}")
        logger.error(f"Please ensure you have created the file 'prompts/{prompt_filename}'")
        return

    logger.info(f"Loaded Prompt: {prompt_path}")
    
    # Snapshot the prompt
    shutil.copy(prompt_path, os.path.join(run_folder, "prompt_snapshot.txt"))

    # 3. Read Data
    df = pd.read_csv(input_csv)
    
    # 4. Read Prompt Content
    with open(prompt_path, 'r', encoding='utf-8') as f:
        system_instruction = f.read().strip()

    # 5. Generate JSONL
    batch_filename = os.path.join(run_folder, "batch_input.jsonl")
    chunk_size = 10
    request_count = 0
    
    logger.info("Generating batch requests...")
    
    with open(batch_filename, 'w', encoding='utf-8') as f:
        for i in range(0, len(df), chunk_size):
            chunk = df.iloc[i : i + chunk_size]
            batch_inputs = []
            
            for idx, row in chunk.iterrows():
                entry = {
                    "id": idx,
                    "english_word": str(row.get('english_word', '')),
                    "word_class": str(row.get('word_class', '')),
                    "level": str(row.get('level', '')),
                    "verb_transitivity": str(row.get('verb_transitivity', 'N/A'))
                }
                batch_inputs.append(entry)
            
            # Construct Request
            request = {
                "request": {
                    "contents": [{
                        "parts": [{
                            "text": f"{system_instruction}\n\nINPUT DATA:\n{json.dumps(batch_inputs, ensure_ascii=False)}"
                        }]
                    }],
                    "generationConfig": {
                        "response_mime_type": "application/json",
                        "temperature": 0.3
                    }
                }
            }
            f.write(json.dumps(request, ensure_ascii=False) + '\n')
            request_count += 1
            
    logger.info(f"SUCCESS: Generated {request_count} batch requests in {batch_filename}")
    print(f"\n[NEXT STEP] Run this command:\npython vocab_manager.py --mode submit --run_folder {run_folder}")

def submit_run(run_folder):
    logger = setup_logging(run_folder)
    logger.info("--- MODE: SUBMIT ---")
    
    batch_file_path = os.path.join(run_folder, "batch_input.jsonl")
    if not os.path.exists(batch_file_path):
        logger.error(f"Batch file not found: {batch_file_path}")
        return

    client = get_client()
    
    logger.info("Uploading file to Google GenAI...")
    uploaded_file = client.files.upload(
        file=batch_file_path,
        config=types.UploadFileConfig(mime_type='application/json')
    )
    
    logger.info(f"Creating Batch Job with model {MODEL_ID}...")
    batch_job = client.batches.create(
        model=MODEL_ID,
        src=uploaded_file.name,
    )
    
    logger.info(f"JOB STARTED: {batch_job.name}")
    print(f"\n[NEXT STEP] Wait for completion, then run:\npython vocab_manager.py --mode retrieve --run_folder {run_folder} --job_name {batch_job.name}")

def retrieve_run(run_folder, job_name):
    logger = setup_logging(run_folder)
    logger.info("--- MODE: RETRIEVE ---")
    
    client = get_client()
    
    try:
        job = client.batches.get(name=job_name)
    except Exception as e:
        logger.error(f"Could not find job: {e}")
        return

    status = str(job.state)
    logger.info(f"Status: {status}")

    if status == "JobState.JOB_STATE_SUCCEEDED" or status == "JOB_STATE_SUCCEEDED" or status == "SUCCEEDED":
        logger.info("Job Complete. Downloading results...")
        output_path = os.path.join(run_folder, "batch_output.jsonl")
        
        output_file_name = None
        if hasattr(job, 'dest') and job.dest:
             if hasattr(job.dest, 'name'): output_file_name = job.dest.name
             elif hasattr(job.dest, 'file_name'): output_file_name = job.dest.file_name
        
        if not output_file_name and hasattr(job, 'output_file'):
            output_file_name = job.output_file

        if not output_file_name:
            logger.error(f"Could not find output file name. Job dump: {job}") 
            return

        logger.info(f"Retrieving content for: {output_file_name}")

        file_bytes = client.files.download(file=output_file_name)
        content = file_bytes.decode("utf-8")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        logger.info(f"Saved to {output_path}")
        print(f"\n[NEXT STEP] Run this command:\npython vocab_manager.py --mode finalize --run_folder {run_folder}")
    
    elif "FAILED" in status:
        logger.error(f"Job Failed: {job.error}")
    else:
        logger.info("Job still processing...")

def finalize_run(run_folder):
    logger = setup_logging(run_folder)
    logger.info("--- MODE: FINALIZE ---")
    
    batch_output_path = os.path.join(run_folder, "batch_output.jsonl")
    
    results_map = {}
    try:
        with open(batch_output_path, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    resp = json.loads(line)
                    if "response" in resp:
                        if "candidates" in resp["response"] and len(resp["response"]["candidates"]) > 0:
                            text = resp["response"]["candidates"][0]["content"]["parts"][0]["text"]
                            # Clean up potential markdown code blocks
                            text = text.replace("```json", "").replace("```", "").strip()
                            items = json.loads(text)
                            for item in items:
                                if "id" in item:
                                    results_map[item["id"]] = item
                except Exception as e:
                    logger.warning(f"Skipping malformed line: {e}")
                    pass
    except Exception as e:
        logger.error(f"Error reading output: {e}")
        return
    
    final_rows = []
    sorted_ids = sorted(results_map.keys())
    folder_lower = run_folder.lower()
    
    # Logic to determine transliteration source script
    source_script = "Kannada" # Default
    if "tamil" in folder_lower: source_script = "Tamil"
    elif "telugu" in folder_lower: source_script = "Telugu"
    elif "malayalam" in folder_lower: source_script = "Malayalam"
    elif "hindi" in folder_lower or "urdu" in folder_lower: source_script = "Devanagari"

    for uid in sorted_ids:
        item = results_map[uid]
        
        # Base Row Data
        row = {
            "id": uid,
            "english_word": item.get("english_word"),
            "word_class": item.get("word_class"),
            "level": item.get("level"),
            "verb_transitivity": item.get("verb_transitivity"),
        }

        # CHECK FOR DUAL LANGUAGE (Hindi/Urdu)
        if "hindi_translation" in item or "urdu_translation" in item:
            hindi_txt = item.get("hindi_translation", "")
            urdu_txt = item.get("urdu_translation", "")
            
            row["hindi_translation"] = hindi_txt
            row["urdu_translation"] = urdu_txt
            
            # Transliterate both (Both are in Devanagari per your prompt)
            row["hindi_transliteration"] = aksharamukha_transliterate(hindi_txt, "Devanagari", "ISO")
            row["urdu_transliteration"] = aksharamukha_transliterate(urdu_txt, "Devanagari", "ISO")

        # CHECK FOR SINGLE TARGET (Kannada, etc.)
        else:
            trans = item.get("target_translation") or item.get("kannada_translation") or item.get("translation")
            row["target_translation"] = trans
            row["transliteration"] = aksharamukha_transliterate(trans, source_script, "ISO")

        final_rows.append(row)

    df_final = pd.DataFrame(final_rows)
    final_csv = os.path.join(run_folder, "final_vocab.csv")
    df_final.to_csv(final_csv, index=False, encoding='utf-8-sig')
    
    logger.info(f"✅ Final CSV created: {final_csv}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["prepare", "submit", "retrieve", "finalize"], required=True)
    parser.add_argument("--input", help="Input CSV (Prepare)")
    parser.add_argument("--language", help="Language Name (Prepare) - Maps to prompts/prompt_{language}.txt")
    parser.add_argument("--run_folder", help="Run Folder Path")
    parser.add_argument("--job_name", help="Batch Job Name")
    
    args = parser.parse_args()
    
    try:
        if args.mode == "prepare":
            if not args.input or not args.language:
                print("Error: --input and --language are required for prepare mode.")
            else:
                prepare_run(args.input, args.language)
        elif args.mode == "submit":
            if not args.run_folder:
                print("Error: --run_folder is required.")
            else:
                submit_run(args.run_folder)
        elif args.mode == "retrieve":
            if not args.run_folder or not args.job_name:
                print("Error: --run_folder and --job_name are required.")
            else:
                retrieve_run(args.run_folder, args.job_name)
        elif args.mode == "finalize":
            if not args.run_folder:
                print("Error: --run_folder is required.")
            else:
                finalize_run(args.run_folder)
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")