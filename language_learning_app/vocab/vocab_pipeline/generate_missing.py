import pandas as pd
import json
import re

# --- CONFIGURATION ---
INPUT_CSV = "kannada-oxford-5000.csv"         # Original full list
FINAL_OUTPUT_CSV = "kannada_refined_final.csv" # The file you currently have

def normalize_word(text):
    """
    Normalizes text for comparison:
    1. Converts to lowercase.
    2. Strips whitespace.
    3. Removes parentheticals like ' (verb)' or ' (noun)' for looser matching if needed, 
       but for strict matching we might keep them if your IDs are inconsistent.
    """
    if not isinstance(text, str): return ""
    return text.lower().strip()

print(f"Reading {INPUT_CSV}...")
df_input = pd.read_csv(INPUT_CSV)
print(f"Total Input Rows: {len(df_input)}")

print(f"Reading {FINAL_OUTPUT_CSV}...")
try:
    df_output = pd.read_csv(FINAL_OUTPUT_CSV)
    print(f"Total Output Rows: {len(df_output)}")
except FileNotFoundError:
    print("Output file not found! Assuming all rows are missing.")
    df_output = pd.DataFrame(columns=df_input.columns)

# Create sets of "english_word" for comparison
# We rely on 'english_word' because IDs might have shifted or be missing in the output
input_words = set(df_input['english_word'].apply(normalize_word))
output_words = set(df_output['english_word'].apply(normalize_word))

# Identify words present in INPUT but missing from OUTPUT
missing_words = input_words - output_words

print(f"Found {len(missing_words)} missing words.")

if len(missing_words) > 0:
    # Filter the original dataframe to get the full rows for these missing words
    # We use a mask to find rows where the normalized english_word is in the missing_set
    mask = df_input['english_word'].apply(normalize_word).isin(missing_words)
    df_missing = df_input[mask].copy()
    
    # Sort by ID if available to keep things tidy
    if 'id' in df_missing.columns:
        df_missing = df_missing.sort_values('id')
    
    output_filename = "kannada_missing_rows.csv"
    df_missing.to_csv(output_filename, index=False)
    
    print(f"✅ Verified & Created '{output_filename}' with {len(df_missing)} rows.")
    print("\n[NEXT STEP] Run this command to process ONLY these missing rows:")
    print(f"python simple_vocab_manager.py --mode prepare --input {output_filename} --language Kannada")
else:
    print("🎉 Verification Complete: No rows are missing! Your dataset is complete.")