"""
Transliteration service using aksharmukha
Converts between various Indic scripts and Roman transliteration using IAST
"""
from aksharamukha import transliterate
import re

def transliterate_text(text: str, from_script: str = 'kannada', to_script: str = 'ISO', from_script_override: str = None) -> str:
    """
    Transliterate text from one script to another using aksharmukha with ISO (IAST-like) scheme
    ISO scheme properly distinguishes short e/o from long ē/ō using macrons
    Uses standard diacritics like ā, ī, ū, ṇ, ē, ō, etc. (e.g., "bhārata gaṇarājya")
    This function cleans up extra diacritics to produce standard ISO/IAST format.
    
    Args:
        text: Text to transliterate
        from_script: Source script (kannada, telugu, devanagari, etc.)
        to_script: Target script (ISO, IAST, ITRANS, etc.) - defaults to ISO
    
    Returns:
        Transliterated text in clean ISO/IAST format (e.g., "nānu īga mēksikō siṭiyalli vāsisuttiddēnē")
    """
    try:
        # Skip transliteration for error messages or text that's primarily English/Latin
        if text and (text.strip().startswith('Error:') or text.strip().startswith('error:')):
            # Return as-is for error messages
            return text
        
        # Check if text is mostly Latin characters (likely English, not Indic script)
        # Count Latin letters vs Indic script characters
        if text:
            latin_chars = len(re.findall(r'[a-zA-Z]', text))
            # Indic script ranges: Devanagari, Bengali, Tamil, Telugu, Kannada, Malayalam, etc.
            indic_chars = len(re.findall(r'[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0600-\u06FF]', text))
            total_chars = latin_chars + indic_chars
            
            # If >70% Latin characters and text has at least 10 chars, skip transliteration
            if total_chars > 10 and latin_chars / total_chars > 0.7:
                return text
        
        # Map common language names to aksharmukha script names (default guess)
        script_map = {
            'kannada': 'Kannada',
            'telugu': 'Telugu',
            'malayalam': 'Malayalam',
            'tamil': 'Tamil',
            'hindi': 'Devanagari',
            'devanagari': 'Devanagari',
            # Default for Urdu language key (assume Devanagari authoring unless Arabic chars detected)
            'urdu': 'Devanagari',
            'spanish': None,  # No transliteration needed for non-Indic scripts
            'french': None,
            'welsh': None,
        }

        # Choose source scheme. If the language is 'urdu' but the input text
        # contains Arabic/Persian characters, prefer 'Urdu' (Perso-Arabic) as the
        # source. This handles situations where activities may already contain
        # Arabic script (native Urdu) rather than Devanagari authoring.
        # Allow caller to pass an explicit from_script_override (e.g., 'Devanagari' or 'Urdu')
        if from_script_override:
            lang_key = (from_script_override or '').lower()
        else:
            lang_key = (from_script or '').lower()
        from_scheme = script_map.get(lang_key)
        if lang_key == 'urdu':
            # Detect Arabic/Perso-Arabic characters in the text
            if re.search(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]', text):
                from_scheme = 'Urdu'
            else:
                from_scheme = 'Devanagari'

        if from_scheme is None:
            # For non-Indic scripts, return original text
            return text
        try:
            print(f"[transliterate_text] detected from_scheme={from_scheme} for language={from_script}")
        except Exception:
            pass
        
        # Default to ISO (IAST-like with proper e/o distinction), but allow other schemes. Map common alias names to
        # the exact scheme names expected by aksharamukha.
        target_map = {
            'iast': 'ISO',  # Use ISO instead of IAST for proper short/long e and o distinction
            'iso': 'ISO',
            'itrans': 'ITRANS',
            'arabic': 'Arabic',
            'urdu': 'Urdu',
            'devanagari': 'Devanagari'
        }
        ts_key = (to_script or 'ISO').lower()
        to_scheme = target_map.get(ts_key, to_script or 'ISO')

        # aksharamukha uses: process(source_script, target_script, text)
        try:
            result = transliterate.process(from_scheme, to_scheme, text)
        except Exception as e:
            print(f"aksharamukha.process error for from={from_scheme} to={to_scheme}: {e}")
            # Fall back to returning original text on error
            return text
        
        # Only clean ISO/IAST format - ITRANS and other schemes don't need IAST-specific cleaning
        if str(to_scheme).upper() in ('IAST', 'ISO'):
            result = clean_iast(result)
            # Apply schwa deletion for Hindi/Urdu
            result = delete_final_schwa(result, from_script)
        try:
            # Debug log short preview
            preview_in = (text or '')[:200].replace('\n', '\\n')
            preview_out = (result or '')[:200].replace('\n', '\\n')
            print(f"[transliterate_text] from={from_scheme} to={to_scheme} in={preview_in} out={preview_out}")
        except Exception:
            pass
        
        return result
    except Exception as e:
        print(f"Transliteration error: {e}")
        return text  # Return original if transliteration fails

def delete_final_schwa(text: str, language: str = None) -> str:
    """
    Delete final inherent 'a' vowel (schwa) from words in Hindi/Urdu transliteration.
    This is a common convention in Hindi/Urdu romanization where the final 'a' is dropped.
    
    Examples:
    - "nāma" -> "nām" (name)
    - "kyā" -> "kyā" (keeps long ā)
    - "savālāta" -> "savālāt" (questions)
    - "praśna" -> "praśn" (question)
    """
    if not text or language not in ['hindi', 'urdu']:
        return text
    
    # Split by whitespace and punctuation, process each word
    def process_word(word):
        # Only delete final 'a' (short a), not ā (long a) or other vowels
        # Match: word ending in 'a' that is not preceded by ā, ī, ū, ē, ō, ṛ, ṝ, ḷ, ḹ
        if re.search(r'[^āīūēōṛṝḷḹ]a$', word):
            return word[:-1]
        return word
    
    # Split text into words and non-word parts
    parts = re.split(r'(\s+|[.,!?;:\-—()[\]{}\"\']+)', text)
    result = []
    for part in parts:
        if part and not re.match(r'[\s.,!?;:\-—()[\]{}\"\']+', part):
            result.append(process_word(part))
        else:
            result.append(part)
    
    return ''.join(result)

def clean_iast(text: str) -> str:
    """
    Clean ISO/IAST transliteration to standard format.
    Converts combining diacritics to precomposed characters.
    Standardizes ISO/IAST format:
    - Converts ṁ (m with dot above) to ṃ (m with dot below) for anusvara
    - Preserves visarga (ḥ) consistently
    - Preserves all standard IAST diacritics: ā, ē, ī, ō, ū, ṛ, ṝ, ḷ, ḹ, ṃ, ṇ, ṭ, ḍ, ṣ, ś, ḥ
    - Preserves SHORT e and o (without macrons) and LONG ē and ō (with macrons) as output by Aksharamukha ISO
    """
    # NOTE: Aksharamukha's ISO output is already correct:
    # - Short e and o appear as 'e' and 'o' (no macron)
    # - Long ē and ō appear as 'ē' and 'ō' (with macron)
    # - IAST scheme doesn't distinguish short/long e and o, so we use ISO instead!
    # We should NOT convert all e->ē or o->ō as that would be incorrect!
    
    # Only handle breve vowels if they appear (rare in Aksharamukha output)
    text = text.replace('ĕ', 'e')  # Short e with breve -> short e
    text = text.replace('ŏ', 'o')  # Short o with breve -> short o
    text = text.replace('ĭ', 'i')  # Short i with breve -> short i
    text = text.replace('ŭ', 'u')  # Short u with breve -> short u
    
    # Normalize combining macrons to precomposed characters FIRST (before other operations)
    text = re.sub(r'e\u0304', 'ē', text)  # e + combining macron -> ē
    text = re.sub(r'o\u0304', 'ō', text)  # o + combining macron -> ō
    text = re.sub(r'a\u0304', 'ā', text)  # a + combining macron -> ā
    text = re.sub(r'i\u0304', 'ī', text)  # i + combining macron -> ī
    text = re.sub(r'u\u0304', 'ū', text)  # u + combining macron -> ū
    
    # Normalize combining dot below for consonants (ṇ, ṭ, ḍ, ṣ, ḷ, ṃ)
    text = re.sub(r'n\u0323', 'ṇ', text)  # n + combining dot below -> ṇ
    text = re.sub(r't\u0323', 'ṭ', text)  # t + combining dot below -> ṭ
    text = re.sub(r'd\u0323', 'ḍ', text)  # d + combining dot below -> ḍ
    text = re.sub(r's\u0323', 'ṣ', text)  # s + combining dot below -> ṣ
    text = re.sub(r'l\u0323', 'ḷ', text)  # l + combining dot below -> ḷ
    
    # Standardize anusvara: convert ṃ (m with dot below) to ṁ (m with dot above)
    # Using ṁ (U+1E41) for anusvara as per user preference
    text = re.sub(r'm\u0323', 'ṁ', text)  # m + combining dot below -> ṁ
    text = text.replace('ṃ', 'ṁ')  # ṃ -> ṁ (convert dot below to dot above for anusvara)
    text = re.sub(r'm\u0307', 'ṁ', text)  # m + combining dot above -> ṁ (ensure consistency)
    
    # Ensure visarga (ḥ) is preserved consistently
    # Visarga should remain as ḥ (U+1E25) - no normalization needed, just ensure it's preserved
    
    # Handle capital M which aksharamukha sometimes uses for anusvara in IAST
    # Convert M to ṁ (m with dot above) in Indic transliteration contexts (before consonants, at word end, etc.)
    # Using ṁ (U+1E41) for anusvara as per user preference
    # This is safe because capital M is rarely used in Indic transliterations
    # Pattern: M followed by space, end of string, or Indic consonants
    indic_consonants = r'[kkgghṅccjñṭṭṭhḍḍḍhṇtthdndhnpbhmyrlvśṣsh]'
    text = re.sub(r'M(?=\s|$|' + indic_consonants + r')', 'ṁ', text)  # M -> ṁ before space/end/consonants
    
    # Handle other forms of ḷ (l with diaeresis below, etc.)
    text = re.sub(r'l\u0324', 'ḷ', text)  # l + combining diaeresis below (U+0324) -> ḷ
    text = re.sub(r'l\u0325', 'ḷ', text)  # l + combining ring below (U+0325) -> ḷ
    text = text.replace('l̤', 'ḷ')  # l with diaeresis below -> ḷ
    
    # Normalize combining dot above for ś
    text = re.sub(r's\u0307', 'ś', text)  # s + combining dot above -> ś
    
    # Remove ONLY unwanted combining diacritics that aren't part of standard IAST
    # Remove combining breve (U+0306) - we've already converted these to macrons
    text = re.sub(r'\u0306', '', text)  # Remove combining breve
    
    # Remove other unwanted combining marks (grave, acute, circumflex, etc.)
    # But keep the ones we've normalized above
    # Remove: grave (U+0300), acute (U+0301), circumflex (U+0302), tilde (U+0303), etc.
    # Keep: macron (U+0304), dot above (U+0307), dot below (U+0323) - already normalized
    unwanted_marks = [
        '\u0300',  # combining grave
        '\u0301',  # combining acute
        '\u0302',  # combining circumflex
        '\u0303',  # combining tilde
        '\u0305',  # combining overline
        '\u0308',  # combining diaeresis
        '\u0309',  # combining hook above
        '\u030A',  # combining ring above
        '\u030B',  # combining double acute
        '\u030C',  # combining caron
        '\u030D',  # combining vertical line above
        '\u030E',  # combining double vertical line above
        '\u030F',  # combining double grave
        '\u0310',  # combining candrabindu
        '\u0311',  # combining inverted breve
        '\u0312',  # combining turned comma above
        '\u0313',  # combining comma above
        '\u0314',  # combining reversed comma above
        '\u031B',  # combining horn
        '\u031C',  # combining left half ring below
        '\u031D',  # combining up tack below
        '\u031E',  # combining down tack below
        '\u031F',  # combining plus sign below
        '\u0320',  # combining minus sign below
        '\u0321',  # combining palatalized hook below
        '\u0322',  # combining retroflex hook below
        '\u0326',  # combining comma below
        '\u0327',  # combining cedilla
        '\u0328',  # combining ogonek
        '\u0329',  # combining vertical line below
        '\u032A',  # combining bridge below
        '\u032B',  # combining inverted arch below
        '\u032C',  # combining caron below
        '\u032D',  # combining circumflex accent below
        '\u032E',  # combining breve below
        '\u032F',  # combining inverted breve below
    ]
    for mark in unwanted_marks:
        text = text.replace(mark, '')
    
    # Preserve paragraph breaks and spacing
    # Only normalize multiple spaces within a line, but preserve newlines and double newlines
    # First, replace double newlines with a marker
    text = text.replace('\n\n', '\u0001PARAGRAPH\u0001')
    # Normalize multiple spaces within lines (but not newlines)
    text = re.sub(r'[ \t]+', ' ', text)  # Multiple spaces/tabs -> single space
    # Restore paragraph breaks
    text = text.replace('\u0001PARAGRAPH\u0001', '\n\n')
    # Normalize single newlines (but keep double newlines)
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)  # Single newline -> space
    # Clean up any remaining extra spaces
    text = re.sub(r' +', ' ', text)  # Multiple spaces -> single space
    text = text.strip()
    
    return text
