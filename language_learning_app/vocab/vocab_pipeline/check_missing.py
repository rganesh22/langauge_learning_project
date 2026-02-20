import pandas as pd
import os

# --- CONFIGURATION ---
INPUT_FILE = "kannada-oxford-5000.csv"          # Your original source file
FINAL_FILE = "runs/Hindi_Urdu_20260125_154933_main/final_vocab.csv"       # The final sorted/merged file
REPORT_FILE = "hindu_urdu_truly_missing.csv"       # Where to save the missing words

def normalize_word(text):
    """Normalizes text for consistent comparison."""
    if pd.isna(text): return ""
    return str(text).lower().strip()

def find_missing_words():
    # 1. Check if files exist
    if not os.path.exists(INPUT_FILE) or not os.path.exists(FINAL_FILE):
        print("Error: Input or Final CSV file not found.")
        print(f"Looking for: {INPUT_FILE} and {FINAL_FILE}")
        return

    print(f"Reading {INPUT_FILE}...")
    df_input = pd.read_csv(INPUT_FILE)
    
    print(f"Reading {FINAL_FILE}...")
    df_final = pd.read_csv(FINAL_FILE)

    print(f"Input Rows: {len(df_input)}")
    print(f"Final Rows: {len(df_final)}")

    # 2. Create normalized sets for comparison
    # We use sets because they are instant to lookup
    input_words = set(df_input['english_word'].apply(normalize_word))
    final_words = set(df_final['english_word'].apply(normalize_word))

    # 3. Calculate Difference
    # Words in Input but NOT in Final
    missing_words_set = input_words - final_words
    
    print("-" * 30)
    print(f"❌ Missing Words Count: {len(missing_words_set)}")

    if len(missing_words_set) > 0:
        print("\nExamples of missing words:")
        print(list(missing_words_set)[:10])  # Show first 10

        # 4. Extract full rows for the missing words
        # We go back to the original dataframe to get the full details (word class, level, etc.)
        mask = df_input['english_word'].apply(normalize_word).isin(missing_words_set)
        df_missing = df_input[mask].copy()

        # 5. Save to file
        df_missing.to_csv(REPORT_FILE, index=False)
        print("-" * 30)
        print(f"✅ Saved the {len(df_missing)} missing rows to: {REPORT_FILE}")
        print("You can run 'vocab_manager.py' on this file to recover them.")
    else:
        print("-" * 30)
        print("🎉 SUCCESS: No words are missing! The datasets match perfectly.")

if __name__ == "__main__":
    find_missing_words()