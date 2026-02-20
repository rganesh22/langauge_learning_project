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

def merge_datasets(main_file, missing_file, output_file, language):
    # 1. Validate Inputs
    if not os.path.exists(main_file):
        print(f"Error: Main file '{main_file}' not found.")
        sys.exit(1)
    if not os.path.exists(missing_file):
        print(f"Error: Missing rows file '{missing_file}' not found.")
        sys.exit(1)

    print(f"--- Configuration ---")
    print(f"Language: {language}")
    print(f"Main File: {main_file}")
    print(f"Missing File: {missing_file}")
    print(f"Output File: {output_file}")
    print("-" * 30)

    # 2. Load DataFrames
    print(f"Reading inputs...")
    df_main = pd.read_csv(main_file)
    df_missing = pd.read_csv(missing_file)

    # 3. Dynamic Column Renaming
    target_col_name = f"{language.lower()}_translation"
    
    def normalize_cols(df):
        # Rename 'target_translation' to specific language if present
        if 'target_translation' in df.columns:
            df.rename(columns={'target_translation': target_col_name}, inplace=True)
        return df

    df_main = normalize_cols(df_main)
    df_missing = normalize_cols(df_missing)

    # 4. Drop 'id' Columns
    if 'id' in df_main.columns: df_main.drop(columns=['id'], inplace=True)
    if 'id' in df_missing.columns: df_missing.drop(columns=['id'], inplace=True)

    # 5. Merge
    print(f"Merging {len(df_main)} main rows with {len(df_missing)} missing rows...")
    df_final = pd.concat([df_main, df_missing], ignore_index=True)

    # 6. Clean Up (Drop Duplicates)
    before_dedup = len(df_final)
    df_final.drop_duplicates(subset=['english_word'], keep='last', inplace=True)
    print(f"Dropped {before_dedup - len(df_final)} duplicates.")

    # 7. Generate Transliteration
    if 'transliteration' not in df_final.columns or df_final['transliteration'].isnull().any():
        print(f"Generating transliteration for {language}...")
        try:
            from aksharamukha import transliterate
            
            def get_translit(text):
                if pd.isna(text): return ""
                try:
                    return transliterate.process(language.title(), 'ISO', str(text))
                except Exception:
                    return ""
            
            if target_col_name in df_final.columns:
                df_final['transliteration'] = df_final[target_col_name].apply(get_translit)
            else:
                print(f"Warning: Could not find translation column '{target_col_name}' to transliterate.")
                
        except ImportError:
            print("Warning: 'aksharamukha' library not installed. Transliteration skipped.")
            if 'transliteration' not in df_final.columns:
                df_final['transliteration'] = ""

    # 8. SORTING LOGIC (Level -> Alphabetical)
    print("Sorting data by Level (A1->C2) then Alphabetically...")
    
    df_final['level_rank'] = df_final['level'].apply(get_level_rank)
    df_final['sort_word'] = df_final['english_word'].astype(str).str.lower()
    
    df_final.sort_values(by=['level_rank', 'sort_word'], ascending=[True, True], inplace=True)
    df_final.drop(columns=['level_rank', 'sort_word'], inplace=True)

    # 9. Reorder Columns
    desired_order = ['english_word', 'word_class', target_col_name, 'transliteration', 'verb_transitivity', 'level']
    existing_cols = [c for c in desired_order if c in df_final.columns]
    remaining_cols = [c for c in df_final.columns if c not in existing_cols]
    df_final = df_final[existing_cols + remaining_cols]

    # 10. Save
    df_final.to_csv(output_file, index=False, encoding='utf-8-sig')
    print(f"✅ SUCCESS! Final dataset saved to: {output_file}")
    print(f"Total Final Rows: {len(df_final)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge main and recovered vocabulary lists.")
    
    parser.add_argument("--main", required=True, help="Path to the large/main CSV file")
    parser.add_argument("--missing", required=True, help="Path to the recovered/missing items CSV file")
    parser.add_argument("--output", required=True, help="Path for the final output CSV")
    parser.add_argument("--language", required=True, help="Language name (e.g., Kannada, Tamil)")

    args = parser.parse_args()

    # Call the correct function
    merge_datasets(args.main, args.missing, args.output, args.language)