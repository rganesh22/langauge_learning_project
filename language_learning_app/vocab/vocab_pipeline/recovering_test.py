import json
import pandas as pd

INPUT_FILE = "kannada_batch_output.jsonl"
OUTPUT_FILE = "kannada_diagnostic_recovery.csv"

results = []
failed_batches = 0
total_batches = 0

print(f"Reading {INPUT_FILE}...")

with open(INPUT_FILE, 'r', encoding='utf-8') as f:
    for line_num, line in enumerate(f):
        total_batches += 1
        try:
            response_obj = json.loads(line)
            
            # Navigate to the content
            if "response" in response_obj:
                resp = response_obj["response"]
                if "candidates" in resp:
                    text_content = resp["candidates"][0]["content"]["parts"][0]["text"]
                    
                    # Clean up markdown code blocks if present
                    if text_content.startswith("```json"):
                        text_content = text_content[7:]
                    if text_content.endswith("```"):
                        text_content = text_content[:-3]
                    
                    try:
                        batch_data = json.loads(text_content)
                        results.extend(batch_data)
                    except json.JSONDecodeError as e:
                        print(f"❌ JSON Syntax Error in Batch {line_num}: {e}")
                        # OPTIONAL: Print the bad text to see what went wrong
                        # print(text_content[:100] + "...") 
                        failed_batches += 1
                else:
                    print(f"⚠️ Batch {line_num} has no candidates.")
                    failed_batches += 1
            else:
                 print(f"⚠️ Batch {line_num} has no 'response' key.")
                 failed_batches += 1

        except Exception as e:
            print(f"❌ Critical Error parsing line {line_num}: {e}")
            failed_batches += 1

print("-" * 30)
print(f"Total Batches Processed: {total_batches}")
print(f"Failed Batches: {failed_batches}")
print(f"Successfully Extracted Rows: {len(results)}")

if results:
    df = pd.DataFrame(results)
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"✅ Saved recovered data to {OUTPUT_FILE}")
else:
    print("No data recovered.")