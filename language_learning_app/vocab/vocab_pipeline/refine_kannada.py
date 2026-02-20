
# V3: batches/8vqsu1d801llxh59v7wdpngn7x0bin1b3xhw
# V2: batches/290aazl9tr8poo4hh1jj6f3epkikukymnxca

import argparse
import csv
import json
import os
import re
import time
import logging
import pandas as pd
from pathlib import Path
from google import genai
from google.genai import types

# --- CONFIGURATION ---
INPUT_FILE = "kannada_missing_rows.csv"
BATCH_JSONL = "kannada_missing_batch_input.jsonl"
BATCH_OUTPUT_JSONL = "kannada_missing_batch_output.jsonl"
FINAL_OUTPUT = "kannada_missing_refined_final.csv"
FAILED_ROWS_FILE = "kannada_missing_failed_rows.csv"
LOG_FILE = "refinement_missing.log"

# # Old Run
# INPUT_FILE = "kannada-oxford-5000.csv"
# BATCH_JSONL = "kannada_batch_input.jsonl"
# BATCH_OUTPUT_JSONL = "kannada_batch_output.jsonl"
# FINAL_OUTPUT = "kannada_refined_final.csv"
# FAILED_ROWS_FILE = "kannada_failed_rows.csv"
# LOG_FILE = "refinement.log"


# Note: The new SDK prefers specific model versions for batching
MODEL_ID = "gemini-2.5-flash" 

# --- LOGGING SETUP ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, mode='a', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger()

# --- EXPERT SYSTEM PROMPT ---
SYSTEM_PROMPT = """
You are an expert Kannada lexicographer and language teacher. Refine and augment this dataset for modern learners.

INPUT DATA:
You will receive a JSON object for each word. 
- Use 'current_translation' as the starting point.
- Use 'verb_transitivity' to determine if the verb is transitive (needs object) or intransitive.
- Use 'pre_existing_senses' to know what meanings ALREADY exist in the dataset to avoid duplicates.

OUTPUT REQUIREMENT:
Return a STRICT JSON array of objects.
Keys: "id", "english_word", "word_class", "kannada_translation", "verb_transitivity", "level".

CRITICAL LINGUISTIC RULES:
1. KANNADA ONLY: 'kannada_translation' MUST be in Kannada script (U+0C80–U+0CFF) ONLY. Strictly NO Latin script, NO transliteration.
2. SYNONYM SORTING: Provide up to 4 synonyms. Sort them: MOST COMMONLY USED/NATURAL -> LEAST COMMON/FORMAL.
3. DIVERSE ORIGINS: Incorporate Native Dravidian (Deshya), Sanskrit-derived (Tatsama), Tadbhava, and integrated loanwords (Persian, Arabic, European).
4. VERB FORMS: Always use the INFORMAL IMPERATIVE (singular) form (e.g., 'ತಿನ್ನು', 'ನಡೆ').
5. NO ARCHAIC WORDS: Avoid obsolete terms. Use words active in modern news, speech, and literature.
6. NO ENGLISH LEAKS: Use English loanwords (in Kannada script) ONLY if the Kannada equivalent is truly clunky or never used in modern context (e.g., 'ಬಸ್ಸು').
7. DISAMBIGUATION STRATEGY: 
   - Check 'pre_existing_senses'. If a sense is already listed there, DO NOT create a duplicate entry.
   - If the word has a distinct meaning (e.g., Bank - river vs. money) or transitivity (Transitive vs. Intransitive) NOT in 'pre_existing_senses', create a NEW entry.

IN-CONTEXT EXAMPLES:

Example 1 (Etymological Sorting & Origin):
Input: {"id": 10, "word": "book", "class": "noun", "current_translation": "ಪುಸ್ತಕ", "pre_existing_senses": ["ಪುಸ್ತಕ"]}
Output: [{"id": 10, "english_word": "book", "word_class": "noun", "kannada_translation": "ಪುಸ್ತಕ / ಹೊತ್ತಿಗೆ / ಕಿತಾಬು", "verb_transitivity": "N/A", "level": "a1"}]
(Note: 'ಪುಸ್ತಕ' is most common, 'ಹೊತ್ತಿಗೆ' is native/literary, 'ಕಿತಾಬು' is Persian origin).

Example 2 (Transitivity Disambiguation):
Input: {"id": 20, "word": "to break", "class": "verb", "verb_transitivity": "transitive", "current_translation": "ಒಡೆ", "pre_existing_senses": []}
Output: [
  {"id": 20, "english_word": "to break (shatter/snap)", "word_class": "verb", "kannada_translation": "ಒಡೆ / ಮುರಿ", "verb_transitivity": "intransitive", "level": "a2"},
  {"id": 20, "english_word": "to break something (action)", "word_class": "verb", "kannada_translation": "ಒಡೆದು ಹಾಕು / ಮುರಿದು ಹಾಕು", "verb_transitivity": "transitive", "level": "a2"}
]

Example 3 (Semantic Disambiguation & Pre-existing Awareness):
Input: {"id": 30, "word": "bank", "class": "noun", "current_translation": "ಬ್ಯಾಂಕು", "pre_existing_senses": ["ಬ್ಯಾಂಕು", "ತೀರ"]}
Output: [{"id": 30, "english_word": "bank (river side)", "word_class": "noun", "kannada_translation": "ದಂಡೆ / ತೀರ / ತಟ / ದಡ", "verb_transitivity": "N/A", "level": "a1"}]
"""

# --- HELPER FUNCTIONS ---
def get_base_word(text):
    if not isinstance(text, str): return ""
    cleaned = re.sub(r'\s*\(.*?\)', '', text)
    return cleaned.lower().strip()

def build_global_registry(df):
    registry = {}
    for _, row in df.iterrows():
        base_word = get_base_word(str(row['english_word']))
        trans = str(row['kannada_translation']).strip()
        if base_word not in registry: registry[base_word] = []
        if trans and trans.lower() != "nan" and trans not in registry[base_word]:
            registry[base_word].append(trans)
    return registry

def kannada_to_latin(text):
    try:
        from aksharamukha import transliterate as ak_transliterate
        if not text or pd.isna(text): return ""
        return ak_transliterate.process('Kannada', 'ISO', text)
    except ImportError:
        logger.warning("Aksharamukha library not found. Transliteration skipped.")
        return ""
    except Exception as e:
        logger.error(f"Transliteration error: {e}")
        return ""

def get_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY not found in environment variables.")
        raise ValueError("Missing API Key")
    return genai.Client(api_key=api_key)

# --- MODES ---

def prepare_batch_file():
    logger.info("--- MODE: PREPARE ---")
    if not os.path.exists(INPUT_FILE):
        logger.error(f"Input file {INPUT_FILE} not found.")
        return

    logger.info(f"Reading {INPUT_FILE}...")
    df = pd.read_csv(INPUT_FILE)
    
    logger.info("Building Global Registry...")
    registry = build_global_registry(df)
    
    chunk_size = 25 
    request_count = 0
    
    logger.info(f"Generating JSONL with chunk size {chunk_size}...")
    
    with open(BATCH_JSONL, 'w', encoding='utf-8') as f:
        for i in range(0, len(df), chunk_size):
            chunk = df.iloc[i : i + chunk_size]
            batch_inputs = []
            
            for idx, row in chunk.iterrows():
                base_word = get_base_word(str(row['english_word']))
                batch_inputs.append({
                    "id": idx,
                    "english_word": str(row['english_word']),
                    "word_class": str(row['word_class']),
                    "level": str(row['level']),
                    "verb_transitivity": str(row.get('verb_transitivity', 'N/A')),
                    "current_translation": str(row['kannada_translation']),
                    "pre_existing_senses": registry.get(base_word, [])
                })
            
            # Request format for NEW google-genai SDK
            request = {
                "request": {
                    "contents": [{
                        "parts": [{
                            "text": f"{SYSTEM_PROMPT}\n\nProcess these entries:\n{json.dumps(batch_inputs, ensure_ascii=False)}"
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
            
    logger.info(f"SUCCESS: Generated {BATCH_JSONL} with {request_count} batch requests.")

def submit_batch_job():
    logger.info("--- MODE: SUBMIT ---")
    if not os.path.exists(BATCH_JSONL):
        logger.error(f"Error: {BATCH_JSONL} not found.")
        return

    client = get_client()
    
    logger.info("Uploading file to Google GenAI...")
    # New SDK File Upload
    batch_file = client.files.upload(
        file=BATCH_JSONL,
        config=types.UploadFileConfig(mime_type='application/json')
    )
    logger.info(f"File uploaded: {batch_file.name}")
    
    logger.info("Creating Batch Job...")
    # New SDK Batch Create
    batch_job = client.batches.create(
        model=MODEL_ID,
        src=batch_file.name,
    )
    
    logger.info(f"Batch Job Created successfully!")
    logger.info(f"JOB NAME: {batch_job.name}")
    logger.info(f"STATUS: {batch_job.state}")
    logger.info("IMPORTANT: Save the JOB NAME above to retrieve results later.")

def list_and_retrieve(job_name=None):
    logger.info("--- MODE: RETRIEVE ---")
    client = get_client()
    
    if not job_name:
        logger.info("Listing recent batch jobs...")
        for job in client.batches.list(page_size=5):
            print(f"Job: {job.name} | Status: {job.state} | Created: {job.create_time}")
        print("\nRun: python refine_kannada.py --mode retrieve --job_name <YOUR_JOB_NAME>")
        return

    logger.info(f"Checking status for: {job_name}")
    job = client.batches.get(name=job_name)
    
    status = str(job.state)
    logger.info(f"Current Status: {status}")

    if status == "JobState.JOB_STATE_SUCCEEDED" or status == "JOB_STATE_SUCCEEDED" or status == "SUCCEEDED":
        logger.info("Job Complete. Downloading results...")
        
        # 1. Get the Output File Name safely
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
        
        # --- FIX IS HERE ---
        # Use .download() instead of .content()
        # It returns bytes, so we must decode it to utf-8 string
        file_bytes = client.files.download(file=output_file_name)
        content = file_bytes.decode("utf-8")
        # -------------------
        
        with open(BATCH_OUTPUT_JSONL, 'w', encoding='utf-8') as f:
            f.write(content)
        logger.info(f"SUCCESS: Results saved to {BATCH_OUTPUT_JSONL}")
        logger.info("Next Step: Run with '--mode finalize'")
        
    elif "FAILED" in status:
        logger.error(f"Job Failed. Error: {job.error}")
    else:
        logger.info("Job is still processing. Please check again later.")

def finalize_data():
    logger.info("--- MODE: FINALIZE ---")
    if not os.path.exists(BATCH_OUTPUT_JSONL):
        logger.error(f"Error: {BATCH_OUTPUT_JSONL} not found.")
        return

    logger.info("Parsing batch output file...")
    results = []
    
    try:
        with open(BATCH_OUTPUT_JSONL, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    response_obj = json.loads(line)
                    # New SDK Response Structure
                    # The actual generation is usually in response -> candidates -> content
                    if "response" in response_obj:
                        resp = response_obj["response"]
                        if "candidates" in resp:
                            text_content = resp["candidates"][0]["content"]["parts"][0]["text"]
                            batch_data = json.loads(text_content)
                            results.extend(batch_data)
                except Exception as e:
                    logger.warning(f"Error parsing line: {e}")
    except Exception as e:
        logger.error(f"Critical error reading output file: {e}")
        return

    if not results:
        logger.error("No results found in the output file.")
        return

    df = pd.DataFrame(results)
    logger.info(f"Parsed {len(df)} rows.")
    
    logger.info("Validating Kannada script...")
    latin_pattern = re.compile(r'[a-zA-Z]')
    failed_mask = df['kannada_translation'].apply(lambda x: bool(latin_pattern.search(str(x))))
    failed_rows = df[failed_mask]
    clean_df = df[~failed_mask].copy()

    if not failed_rows.empty:
        logger.warning(f"WARNING: {len(failed_rows)} rows contained Latin script.")
        failed_rows.to_csv(FAILED_ROWS_FILE, index=False)
    else:
        logger.info("Validation Passed.")

    logger.info("Applying Aksharamukha Transliteration...")
    clean_df['transliteration'] = clean_df['kannada_translation'].apply(kannada_to_latin)

    # Save
    cols = ['id', 'english_word', 'word_class', 'level', 'verb_transitivity', 'kannada_translation', 'transliteration']
    final_cols = [c for c in cols if c in clean_df.columns]
    clean_df = clean_df[final_cols]
    
    if 'id' in clean_df.columns:
        clean_df = clean_df.sort_values(by='id')

    clean_df.to_csv(FINAL_OUTPUT, index=False, encoding='utf-8-sig')
    logger.info(f"✅ SUCCESS! Final dataset saved to: {FINAL_OUTPUT}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Kannada Dataset Refinement Manager")
    parser.add_argument("--mode", choices=["prepare", "submit", "retrieve", "finalize"], required=True)
    parser.add_argument("--job_name", help="The Resource Name of the batch job.")
    
    args = parser.parse_args()
    
    try:
        if args.mode == "prepare":
            prepare_batch_file()
        elif args.mode == "submit":
            submit_batch_job()
        elif args.mode == "retrieve":
            list_and_retrieve(args.job_name)
        elif args.mode == "finalize":
            finalize_data()
    except Exception as e:
        logger.critical(f"Unhandled exception: {e}")
        raise