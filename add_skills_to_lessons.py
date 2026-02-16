#!/usr/bin/env python3
"""
Manually add skills_learned to all lessons that don't have it.
Based on lesson content and tags.
"""

import json
import os
from pathlib import Path

# Skills mapping based on lesson content
LESSON_SKILLS = {
    "01_the_a_starters.json": [
        "Reading അ, ക, റ, മ characters",
        "Recognizing inherent 'a' sound",
        "Reading 10 Malayalam words",
        "Understanding phonetic script"
    ],
    "02_the_nasalizer_and_long_a.json": [
        "Reading anusvara (ം) symbol",
        "Distinguishing long vs short 'a'",
        "Reading nasal word endings",
        "Building Malayalam vocabulary"
    ],
    "03_the_dental_and_labial_set.json": [
        "Reading dental consonants ത, ന, ല",
        "Reading labial consonants പ, വ",
        "Recognizing consonant groups",
        "Reading 20+ Malayalam words"
    ],
    "04_the_i_vowels.json": [
        "Reading ഇ and ഈ vowels",
        "Using ി and ീ modifiers",
        "Distinguishing short vs long 'i'",
        "Applying vowel modification"
    ],
    "05_the_u_vowels.json": [
        "Reading ഉ and ഊ vowels",
        "Using ു and ൂ modifiers",
        "Distinguishing short vs long 'u'",
        "Reading vowel combinations"
    ],
    "06_the_first_chillus.json": [
        "Reading chillu characters ൻ, ർ, ൽ",
        "Understanding pure consonants",
        "Reading word-final consonants",
        "Building reading fluency"
    ],
    "07_the_retroflexes.json": [
        "Reading retroflex consonants ട, ഡ, ണ",
        "Distinguishing dental vs retroflex",
        "Understanding tongue position",
        "Pronouncing heavy consonants"
    ],
    "08_the_pre_vowels.json": [
        "Reading ഏ and എ vowels",
        "Using േ and െ pre-vowel markers",
        "Reading left-side modifiers",
        "Understanding visual flow"
    ],
    "09_the_dual_vowels.json": [
        "Reading ഓ and ഒ vowels",
        "Using ോ and ൊ dual markers",
        "Reading complex modifiers",
        "Mastering vowel system"
    ],
    "10_the_heavy_chillus.json": [
        "Reading retroflex chillus ൾ, ൺ",
        "Distinguishing light vs heavy endings",
        "Reading Kerala (കേരളം)",
        "Understanding chillu system"
    ],
    "11_sibilants_and_soft_breath.json": [
        "Reading sibilants സ, ശ, ഷ",
        "Reading ഹ (ha) consonant",
        "Distinguishing s-sounds",
        "Reading 30+ Malayalam words"
    ],
    "12_the_diphthongs.json": [
        "Reading ഐ and ഔ diphthongs",
        "Using ൈ and ൌ modifiers",
        "Pronouncing gliding vowels",
        "Completing vowel system"
    ],
    "13_double_stops.json": [
        "Reading doubled stop consonants",
        "Understanding gemination",
        "Reading ക്ക, ട്ട, പ്പ clusters",
        "Pronouncing held consonants"
    ],
    "14_double_dentals.json": [
        "Reading doubled dental consonants",
        "Reading ത്ത, ന്ന, ല്ല clusters",
        "Understanding consonant doubling",
        "Building cluster fluency"
    ],
    "15_soft_nasal_clusters.json": [
        "Reading nasal + consonant clusters",
        "Reading ന്മ, മ്പ, ം + consonant",
        "Understanding nasal assimilation",
        "Reading complex combinations"
    ],
    "16_hard_nasal_clusters.json": [
        "Reading retroflex nasal clusters",
        "Reading ണ് combinations",
        "Distinguishing nasal types",
        "Reading heavy clusters"
    ],
    "17_labial_liquid_mergers.json": [
        "Reading labial + liquid clusters",
        "Reading പ്ല, വ്ല, ബ്ല combinations",
        "Understanding merged forms",
        "Reading flowing clusters"
    ],
    "18_semi_vowel_hooks.json": [
        "Reading യ (ya) conjuncts",
        "Recognizing subscript hooks",
        "Reading ക്യ, പ്യ patterns",
        "Understanding Y-combinations"
    ],
    "19_flowing_hooks.json": [
        "Reading ര (ra) conjuncts",
        "Recognizing R-hooks and curls",
        "Reading complex ligatures",
        "Mastering visual patterns"
    ],
    "20_the_chandrakkala.json": [
        "Understanding chandrakkala (്) mark",
        "Reading pure consonants",
        "Building consonant clusters",
        "Understanding script logic"
    ],
    "21_sanskrit_heavy_breath.json": [
        "Reading aspirated consonants",
        "Pronouncing ഖ, ഘ, ഛ, ജ്ഞ",
        "Understanding Sanskrit loanwords",
        "Reading breathy sounds"
    ],
    "22_script_reform.json": [
        "Understanding old vs new forms",
        "Reading reformed characters",
        "Recognizing archaic ligatures",
        "Understanding script evolution"
    ],
    "23_rare_marks.json": [
        "Reading rare diacritics",
        "Understanding special marks",
        "Reading uncommon symbols",
        "Completing script knowledge"
    ],
    "24_grammar_suffixes.json": [
        "Reading grammatical endings",
        "Understanding case markers",
        "Reading verb suffixes",
        "Applying grammar knowledge"
    ],
    "25_loanword_blitz.json": [
        "Reading English loanwords",
        "Understanding phonetic adaptations",
        "Reading modern vocabulary",
        "Building practical vocabulary"
    ],
    "26_visual_sabotage.json": [
        "Distinguishing similar characters",
        "Avoiding visual confusion",
        "Reading challenging pairs",
        "Mastering subtle differences"
    ],
    "27_environmental_speed_read.json": [
        "Speed reading signage",
        "Reading real-world text",
        "Applying reading skills",
        "Building reading fluency"
    ],
    "28_culinary_lab.json": [
        "Reading food vocabulary",
        "Understanding culinary terms",
        "Reading recipe words",
        "Building practical vocabulary"
    ],
    "29_digital_headlines.json": [
        "Reading news headlines",
        "Understanding modern text",
        "Speed reading practice",
        "Applying comprehension skills"
    ],
    "30_final_reading.json": [
        "Reading complete paragraphs",
        "Understanding full texts",
        "Mastering Malayalam script",
        "Achieving reading fluency"
    ]
}

def add_skills_to_lesson(filepath):
    """Add skills_learned array to lesson if missing"""
    filename = filepath.name
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lesson = json.load(f)
        
        # Skip if already has skills_learned
        if 'skills_learned' in lesson:
            print(f"  ✓ Already has skills_learned")
            return False
        
        # Get skills from mapping
        if filename in LESSON_SKILLS:
            lesson['skills_learned'] = LESSON_SKILLS[filename]
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(lesson, f, ensure_ascii=False, indent=2)
            
            print(f"  ✅ Added {len(lesson['skills_learned'])} skills")
            return True
        else:
            print(f"  ⚠️  No skills mapping found")
            return False
            
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    lessons_dir = Path('backend/lessons/ml/unit_1_foundations')
    
    if not lessons_dir.exists():
        print(f"❌ Directory not found: {lessons_dir}")
        return
    
    # Get all lesson files
    lesson_files = sorted([f for f in lessons_dir.glob('*.json') 
                          if not f.name.startswith('_')])
    
    print(f"Adding skills_learned to {len(lesson_files)} lessons...\n")
    
    added_count = 0
    for lesson_file in lesson_files:
        print(f"📝 {lesson_file.name}")
        if add_skills_to_lesson(lesson_file):
            added_count += 1
        print()
    
    print(f"\n✅ Added skills to {added_count}/{len(lesson_files)} lessons!")

if __name__ == '__main__':
    main()
