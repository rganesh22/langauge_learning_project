import pandas as pd
import re
from aksharamukha import transliterate

# --- CONFIGURATION ---
INPUT_FILE = "hindi-urdu-oxford-5000.csv"
HINDI_OUTPUT = "hindi-oxford-5000.csv"
URDU_OUTPUT = "urdu-oxford-5000.csv"

def translate_dev_to_ur(text):
    """
    Transliterates Devanagari text to Urdu script using Aksharamukha,
    preserving Latin characters (e.g. (m), (f)).
    """
    if not isinstance(text, str) or not text.strip():
        return text

    # Regex breakdown:
    # ([a-zA-Z\(\)]+) matches sequences of Latin letters and parentheses
    # We split the text so we can process Devanagari and Latin separately
    parts = re.split(r'([a-zA-Z\(\)]+)', text)
    
    converted_parts = []
    
    for part in parts:
        # If the part is Latin/Grammar marker, keep it as is
        if re.match(r'[a-zA-Z\(\)]+', part):
            converted_parts.append(part)
        # If it's empty or just whitespace, keep it
        elif not part.strip():
            converted_parts.append(part)
        else:
            try:
                # Transliterate Devanagari -> Urdu
                converted = transliterate.process('Devanagari', 'Urdu', part)
                converted_parts.append(converted)
            except Exception as e:
                print(f"Warning: Could not transliterate '{part}'. Error: {e}")
                converted_parts.append(part) # Fallback to original
                
    return "".join(converted_parts)

def process_csv():
    print(f"Reading {INPUT_FILE}...")
    try:
        df = pd.read_csv(INPUT_FILE)
    except FileNotFoundError:
        print(f"Error: Could not find {INPUT_FILE}")
        return

    # --- 1. PROCESS HINDI DATAFRAME ---
    print("Processing Hindi dataset...")
    
    hindi_cols = [
        'english_word', 'word_class', 'level', 'verb_transitivity', 
        'hindi_translation', 'hindi_transliteration'
    ]
    
    existing_hindi_cols = [c for c in hindi_cols if c in df.columns]
    df_hindi = df[existing_hindi_cols].copy()

    df_hindi.rename(columns={
        'hindi_translation': 'translation', 
        'hindi_transliteration': 'transliteration'
    }, inplace=True)
    
    df_hindi.to_csv(HINDI_OUTPUT, index=False, encoding='utf-8-sig')
    print(f"✅ Saved: {HINDI_OUTPUT}")

    # --- 2. PROCESS URDU DATAFRAME ---
    print("Processing Urdu dataset...")

    # Determine source column for transliteration
    source_col = 'urdu_translation' if 'urdu_translation' in df.columns else 'hindi_translation'
    
    urdu_cols = [
        'english_word', 'word_class', 'level', 'verb_transitivity'
    ]
    existing_urdu_cols = [c for c in urdu_cols if c in df.columns]
    df_urdu = df[existing_urdu_cols].copy()

    print(f"Transliterating Devanagari to Urdu from column: '{source_col}'...")
    df_urdu['translation'] = df[source_col].apply(translate_dev_to_ur)
    
    # Handle transliteration column
    if 'urdu_transliteration' in df.columns:
        df_urdu['transliteration'] = df['urdu_transliteration']
    else:
        df_urdu['transliteration'] = ""

    df_urdu.to_csv(URDU_OUTPUT, index=False, encoding='utf-8-sig')
    print(f"✅ Saved: {URDU_OUTPUT}")

if __name__ == "__main__":
    process_csv()