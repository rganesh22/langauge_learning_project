import pandas as pd
import os
import warnings
import argparse
import sys

# Suppress warnings
warnings.filterwarnings("ignore")

# --- CONFIGURATION ---
# Custom Order for CEFR Levels
LEVEL_ORDER = {
    "a1": 1, "a2": 2, 
    "b1": 3, "b2": 4, 
    "c1": 5, "c2": 6,
    "nan": 7 # Handle missing levels last
}

def get_level_rank(level):
    if pd.isna(level): return 7
    return LEVEL_ORDER.get(str(level).lower().strip(), 7)

def merge_datasets(main_file, missing_file, output_file):
    # 1. Validate Inputs
    if not os.path.exists(main_file):
        print(f"Error: Main file '{main_file}' not found.")
        sys.exit(1)
    if not os.path.exists(missing_file):
        print(f"Error: Missing rows file '{missing_file}' not found.")
        sys.exit(1)

    print(f"--- Configuration ---")
    print(f"Main File: {main_file}")
    print(f"Missing File: {missing_file}")
    print(f"Output File: {output_file}")
    print("-" * 30)

    # 2. Load DataFrames
    print(f"Reading inputs...")
    try:
        df_main = pd.read_csv(main_file)
        df_missing = pd.read_csv(missing_file)
    except Exception as e:
        print(f"Error reading CSV files: {e}")
        sys.exit(1)

    # Clean whitespace from headers
    df_main.columns = df_main.columns.str.strip()
    df_missing.columns = df_missing.columns.str.strip()

    # 3. Drop 'id' Columns
    if 'id' in df_main.columns: df_main.drop(columns=['id'], inplace=True)
    if 'id' in df_missing.columns: df_missing.drop(columns=['id'], inplace=True)

    # 4. Merge
    print(f"Merging {len(df_main)} main rows with {len(df_missing)} missing rows...")
    df_final = pd.concat([df_main, df_missing], ignore_index=True)

    # Remove rows where english_word is completely missing
    df_final.dropna(subset=['english_word'], inplace=True)

    # 5. Clean Up (Drop Duplicates - Robust)
    before_dedup = len(df_final)
    
    # Create a temporary column for case-insensitive deduplication
    df_final['temp_dedup_key'] = df_final['english_word'].astype(str).str.lower().str.strip()
    
    # Keep 'last' (assuming the 'missing' file has the newest corrections)
    df_final.drop_duplicates(subset=['temp_dedup_key'], keep='last', inplace=True)
    
    # Drop the temp key
    df_final.drop(columns=['temp_dedup_key'], inplace=True)
    
    print(f"Dropped {before_dedup - len(df_final)} duplicates.")

    # 6. SORTING LOGIC (Level -> Alphabetical)
    print("Sorting data by Level (A1->C2) then Alphabetically...")
    
    # Ensure level column exists
    if 'level' in df_final.columns:
        df_final['level_rank'] = df_final['level'].apply(get_level_rank)
        df_final['sort_word'] = df_final['english_word'].astype(str).str.lower()
        
        df_final.sort_values(by=['level_rank', 'sort_word'], ascending=[True, True], inplace=True)
        df_final.drop(columns=['level_rank', 'sort_word'], inplace=True)
    else:
        print("Warning: 'level' column not found. Sorting alphabetically only.")
        df_final.sort_values(by=['english_word'], key=lambda col: col.str.lower(), inplace=True)

    # 7. Reorder Columns (English Word First)
    cols = list(df_final.columns)
    if 'english_word' in cols:
        cols.insert(0, cols.pop(cols.index('english_word')))
    df_final = df_final[cols]

    # 8. Save
    try:
        df_final.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"✅ SUCCESS! Final dataset saved to: {output_file}")
        print(f"Total Final Rows: {len(df_final)}")
    except PermissionError:
        print(f"Error: Could not write to {output_file}. Is it open in another program?")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge main and recovered vocabulary lists (Language Agnostic).")
    
    parser.add_argument("--main", required=True, help="Path to the large/main CSV file")
    parser.add_argument("--missing", required=True, help="Path to the recovered/missing items CSV file")
    parser.add_argument("--output", required=True, help="Path for the final output CSV")

    args = parser.parse_args()

    merge_datasets(args.main, args.missing, args.output)