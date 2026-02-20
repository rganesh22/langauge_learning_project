#!/usr/bin/env python3
"""
Generate A0 Unit 1 "Reading the Script" lessons for all 6 languages.
Each language gets 15-30 lessons with 15-25 steps each.
Uses the "alphabet soup" method: introduce 3-5 chars, quiz, build words, repeat.
"""
import json, os, shutil, random
from pathlib import Path

BASE = Path(__file__).parent / "backend" / "lessons"

# ============================================================================
# LANGUAGE DATA
# Each language defines: chars grouped into lessons, with transliterations,
# example words, memory tricks, and quiz material.
# ============================================================================

TAMIL_DATA = {
    "code": "ta",
    "name": "Tamil",
    "full_name": "Tamil",
    "unit_id": "ta_unit_1",
    "unit_title": "Reading Tamil Script",
    "unit_subtitle": "Master the Tamil alphabet from vowels to full words",
    "unit_description": "A comprehensive 20-lesson course teaching you to read Tamil script. From basic vowels through consonants, vowel markers, and special combinations to reading real words and sentences.",
    "lessons": [
        {
            "num": 1, "slug": "vowels_part_1", "title": "The First Vowels",
            "subtitle": "Meet அ, ஆ, இ, and ஈ",
            "desc": "Learn the first four Tamil vowels — two short/long pairs that form the foundation of Tamil phonetics.",
            "chars": [
                {"c": "அ", "t": "a", "sound": "a in about", "trick": "Looks like a person sitting — relaxed, short sound"},
                {"c": "ஆ", "t": "aa", "sound": "a in father", "trick": "அ with an extra tail — longer sound, longer letter"},
                {"c": "இ", "t": "i", "sound": "i in bit", "trick": "Has a dot on top — short and sharp"},
                {"c": "ஈ", "t": "ii", "sound": "ee in see", "trick": "Two loops — double the length of sound"},
            ],
            "words": [
                {"w": "அம்மா", "t": "ammaa", "m": "mother"},
                {"w": "ஆறு", "t": "aaru", "m": "river / six"},
                {"w": "இரண்டு", "t": "irandu", "m": "two"},
            ],
            "skills": ["Recognizing அ (a)", "Recognizing ஆ (aa)", "Recognizing இ (i)", "Recognizing ஈ (ii)", "Short vs long vowel distinction"],
        },
        {
            "num": 2, "slug": "vowels_part_2", "title": "More Vowel Pairs",
            "subtitle": "Meet உ, ஊ, எ, and ஏ",
            "desc": "Continue with four more vowels — the u-pair and e-pair.",
            "chars": [
                {"c": "உ", "t": "u", "sound": "u in put", "trick": "Looks like a hook — short and quick"},
                {"c": "ஊ", "t": "uu", "sound": "oo in food", "trick": "Bigger hook — longer sound"},
                {"c": "எ", "t": "e", "sound": "e in bed", "trick": "Open shape — short 'eh'"},
                {"c": "ஏ", "t": "ee", "sound": "ay in say", "trick": "Extra stroke on எ — elongated sound"},
            ],
            "words": [
                {"w": "உணவு", "t": "unavu", "m": "food"},
                {"w": "ஊர்", "t": "uur", "m": "town/village"},
                {"w": "எட்டு", "t": "ettu", "m": "eight"},
            ],
            "skills": ["Recognizing உ (u)", "Recognizing ஊ (uu)", "Recognizing எ (e)", "Recognizing ஏ (ee)"],
        },
        {
            "num": 3, "slug": "vowels_part_3", "title": "The Final Vowels",
            "subtitle": "Meet ஐ, ஒ, ஓ, and ஔ",
            "desc": "Complete the Tamil vowel set with the diphthongs and back vowels.",
            "chars": [
                {"c": "ஐ", "t": "ai", "sound": "ai in aisle", "trick": "Two-part sound, two-part look"},
                {"c": "ஒ", "t": "o", "sound": "o in hot", "trick": "Round shape for a round sound"},
                {"c": "ஓ", "t": "oo", "sound": "o in go", "trick": "ஒ with extra curve — longer sound"},
                {"c": "ஔ", "t": "au", "sound": "ow in how", "trick": "Wide letter for a wide diphthong"},
            ],
            "words": [
                {"w": "ஐந்து", "t": "aintu", "m": "five"},
                {"w": "ஒன்று", "t": "onru", "m": "one"},
                {"w": "ஓடு", "t": "oodu", "m": "run"},
            ],
            "skills": ["All 12 Tamil vowels", "Diphthongs ஐ and ஔ", "Complete vowel chart"],
        },
        {
            "num": 4, "slug": "hard_consonants", "title": "The Vallinam (Hard) Consonants",
            "subtitle": "க, ச, ட, த, ப, ற — the 6 hard stops",
            "desc": "Learn the six hard consonants of Tamil — the backbone of Tamil pronunciation.",
            "chars": [
                {"c": "க", "t": "ka", "sound": "ka in karma", "trick": "Looks like a 'k' with curves"},
                {"c": "ச", "t": "sa/cha", "sound": "sa or cha", "trick": "Context decides: 'sa' at start, 'cha' after nasal"},
                {"c": "ட", "t": "ta (retroflex)", "sound": "ta with tongue curled back", "trick": "The curl in the letter matches the tongue curl"},
                {"c": "த", "t": "tha (dental)", "sound": "th as in 'the'", "trick": "Softer shape for softer dental sound"},
                {"c": "ப", "t": "pa", "sound": "pa in papa", "trick": "Round like pursed lips making 'p'"},
                {"c": "ற", "t": "Ra (trill)", "sound": "trilled r/tra", "trick": "Strong vertical line — strong trilled sound"},
            ],
            "words": [
                {"w": "கண்", "t": "kan", "m": "eye"},
                {"w": "தமிழ்", "t": "tamizh", "m": "Tamil (the language)"},
                {"w": "பால்", "t": "paal", "m": "milk"},
            ],
            "skills": ["6 vallinam consonants", "Inherent 'a' in consonants", "Retroflex vs dental distinction"],
        },
        {
            "num": 5, "slug": "soft_consonants", "title": "The Mellinam (Soft/Nasal) Consonants",
            "subtitle": "ங, ஞ, ண, ந, ம, ன — the 6 nasals",
            "desc": "Learn the six nasal consonants that pair with the hard consonants.",
            "chars": [
                {"c": "ங", "t": "nga", "sound": "ng as in sing", "trick": "Curvy — the sound resonates in the nose"},
                {"c": "ஞ", "t": "nya", "sound": "ny as in canyon", "trick": "Like a knot — tongue ties to palate"},
                {"c": "ண", "t": "Na (retroflex)", "sound": "n with tongue curled back", "trick": "Pairs with ட — same tongue position, nasal"},
                {"c": "ந", "t": "na (dental)", "sound": "n as in 'no'", "trick": "Pairs with த — dental nasal"},
                {"c": "ம", "t": "ma", "sound": "ma in mama", "trick": "Looks like lips together for 'm'"},
                {"c": "ன", "t": "na (alveolar)", "sound": "n (tip of tongue behind teeth)", "trick": "The everyday 'n' sound"},
            ],
            "words": [
                {"w": "மண்", "t": "man", "m": "soil/earth"},
                {"w": "நான்", "t": "naan", "m": "I/me"},
                {"w": "மீன்", "t": "miin", "m": "fish"},
            ],
            "skills": ["6 mellinam consonants", "Nasal-stop pairing concept", "Three types of 'n' in Tamil"],
        },
        {
            "num": 6, "slug": "medium_consonants", "title": "The Idaiyinam (Medium) Consonants",
            "subtitle": "ய, ர, ல, வ, ழ, ள — the 6 approximants",
            "desc": "Complete the 18 basic consonants with the semivowels and liquids.",
            "chars": [
                {"c": "ய", "t": "ya", "sound": "ya in yoga", "trick": "Flowing shape for a flowing sound"},
                {"c": "ர", "t": "ra", "sound": "ra (soft r)", "trick": "Gentle curve — soft, American-style 'r'"},
                {"c": "ல", "t": "la", "sound": "la in lama", "trick": "Lateral tongue — 'l' sound"},
                {"c": "வ", "t": "va", "sound": "va in vanilla", "trick": "Starts with lips, not teeth"},
                {"c": "ழ", "t": "zha", "sound": "unique retroflex 'zh'", "trick": "Uniquely Tamil! Tongue curls way back"},
                {"c": "ள", "t": "La (retroflex l)", "sound": "l with tongue curled back", "trick": "Heavier 'l' — tongue tip curls to palate"},
            ],
            "words": [
                {"w": "வாழை", "t": "vaazhai", "m": "banana"},
                {"w": "யானை", "t": "yaanai", "m": "elephant"},
                {"w": "தமிழ்", "t": "tamizh", "m": "Tamil"},
            ],
            "skills": ["All 18 Tamil consonants complete", "The unique ழ sound", "Retroflex vs dental vs alveolar"],
        },
        {
            "num": 7, "slug": "the_pulli", "title": "The Pulli — Removing the Inherent Vowel",
            "subtitle": "The dot that changes everything: ்",
            "desc": "Learn how the pulli (்) removes the inherent 'a' from consonants to create pure consonant sounds.",
            "chars": [
                {"c": "க் vs க", "t": "k vs ka", "sound": "pure k vs ka", "trick": "Dot on top = strip the 'a' away"},
                {"c": "ம் vs ம", "t": "m vs ma", "sound": "pure m vs ma", "trick": "With pulli: just the consonant, no vowel"},
                {"c": "ன் vs ன", "t": "n vs na", "sound": "pure n vs na", "trick": "Essential for ending words correctly"},
                {"c": "ல் vs ல", "t": "l vs la", "sound": "pure l vs la", "trick": "Many Tamil words end in ல்"},
            ],
            "words": [
                {"w": "கண்", "t": "kan", "m": "eye (ends in pure n)"},
                {"w": "பால்", "t": "paal", "m": "milk (ends in pure l)"},
                {"w": "நாம்", "t": "naam", "m": "we (ends in pure m)"},
            ],
            "skills": ["Understanding the pulli ்", "Reading pure consonants at word end", "Distinguishing ka vs k"],
        },
        {
            "num": 8, "slug": "vowel_markers_aa_i", "title": "Vowel Markers I — ா and ி",
            "subtitle": "Changing consonant vowels with markers",
            "desc": "Learn how vowel markers (matras) modify consonants from their default 'a' sound to other vowels.",
            "chars": [
                {"c": "கா", "t": "kaa", "sound": "kaa", "trick": "Add a vertical line after the consonant for 'aa'"},
                {"c": "கி", "t": "ki", "sound": "ki", "trick": "Add a loop on top for short 'i'"},
                {"c": "கீ", "t": "kii", "sound": "kee", "trick": "Taller loop on top for long 'ii'"},
                {"c": "பா", "t": "paa", "sound": "paa", "trick": "Same 'aa' marker works on all consonants"},
            ],
            "words": [
                {"w": "பாடம்", "t": "paadam", "m": "lesson"},
                {"w": "கீழ்", "t": "kiizh", "m": "below"},
                {"w": "தமிழ்", "t": "tamizh", "m": "Tamil"},
            ],
            "skills": ["The aa marker ா", "The i marker ி", "The ii marker ீ", "Applying markers to any consonant"],
        },
        {
            "num": 9, "slug": "vowel_markers_u_uu", "title": "Vowel Markers II — ு and ூ",
            "subtitle": "The u-sound markers",
            "desc": "Learn the vowel markers for short 'u' and long 'uu' sounds.",
            "chars": [
                {"c": "கு", "t": "ku", "sound": "ku", "trick": "Small tail below for short 'u'"},
                {"c": "கூ", "t": "kuu", "sound": "koo", "trick": "Longer tail below for long 'uu'"},
                {"c": "பு", "t": "pu", "sound": "pu", "trick": "Same marker pattern on different consonants"},
                {"c": "தூ", "t": "thuu", "sound": "thoo", "trick": "Long 'uu' marker always extends further"},
            ],
            "words": [
                {"w": "குதிரை", "t": "kutirai", "m": "horse"},
                {"w": "பூ", "t": "puu", "m": "flower"},
                {"w": "தூக்கம்", "t": "thuukkam", "m": "sleep"},
            ],
            "skills": ["The u marker ு", "The uu marker ூ", "Recognizing u vs uu markers on various consonants"],
        },
        {
            "num": 10, "slug": "vowel_markers_e_ee_ai", "title": "Vowel Markers III — ெ, ே, and ை",
            "subtitle": "The front-placed markers",
            "desc": "Learn the unique pre-positioned vowel markers for e, ee, and ai sounds.",
            "chars": [
                {"c": "கெ", "t": "ke", "sound": "ke", "trick": "Marker goes BEFORE the consonant! A Tamil specialty"},
                {"c": "கே", "t": "kee", "sound": "kay", "trick": "Two strokes before = long 'ee'"},
                {"c": "கை", "t": "kai", "sound": "kai", "trick": "Special marker before for 'ai' diphthong"},
                {"c": "தை", "t": "thai", "sound": "thai", "trick": "Same ai-marker on different consonant"},
            ],
            "words": [
                {"w": "கெடு", "t": "kedu", "m": "spoil"},
                {"w": "தேன்", "t": "theen", "m": "honey"},
                {"w": "கை", "t": "kai", "m": "hand"},
            ],
            "skills": ["Pre-positioned markers", "The e marker ெ", "The ee marker ே", "The ai marker ை"],
        },
        {
            "num": 11, "slug": "vowel_markers_o_oo_au", "title": "Vowel Markers IV — ொ, ோ, and ௌ",
            "subtitle": "The split and compound markers",
            "desc": "Learn the compound vowel markers that wrap around consonants.",
            "chars": [
                {"c": "கொ", "t": "ko", "sound": "ko", "trick": "Combines ெ (before) + ா (after) = wraps around"},
                {"c": "கோ", "t": "koo", "sound": "koo", "trick": "Combines ே (before) + ா (after) = wraps around"},
                {"c": "கௌ", "t": "kau", "sound": "kow", "trick": "Special compound marker for 'au'"},
                {"c": "போ", "t": "poo", "sound": "poh", "trick": "Same pattern on different consonant"},
            ],
            "words": [
                {"w": "கொடி", "t": "kodi", "m": "flag"},
                {"w": "போது", "t": "poothu", "m": "time/when"},
                {"w": "கௌரவம்", "t": "kauravam", "m": "honor"},
            ],
            "skills": ["Split vowel markers", "The o marker ொ", "The oo marker ோ", "The au marker ௌ"],
        },
        {
            "num": 12, "slug": "full_marker_chart", "title": "The Complete Vowel Marker System",
            "subtitle": "Putting it all together",
            "desc": "Review all vowel markers systematically and practice reading any consonant-vowel combination.",
            "chars": [
                {"c": "க கா கி கீ கு கூ", "t": "ka kaa ki kii ku kuu", "sound": "all k-row", "trick": "First row of the full chart"},
                {"c": "கெ கே கை கொ கோ கௌ", "t": "ke kee kai ko koo kau", "sound": "all k-row continued", "trick": "Pre-positioned and split markers"},
                {"c": "த தா தி தீ து தூ", "t": "tha thaa thi thii thu thuu", "sound": "all th-row", "trick": "Same markers, different base consonant"},
            ],
            "words": [
                {"w": "காகிதம்", "t": "kaakitham", "m": "paper"},
                {"w": "தேசம்", "t": "theesam", "m": "country"},
                {"w": "கோவில்", "t": "koovil", "m": "temple"},
            ],
            "skills": ["Complete marker system mastery", "Reading any consonant+vowel combo", "Systematic chart knowledge"],
        },
        {
            "num": 13, "slug": "doubled_consonants", "title": "Doubled (Geminated) Consonants",
            "subtitle": "When consonants repeat: க்க, ப்ப, ட்ட",
            "desc": "Learn how doubled consonants are written and pronounced in Tamil.",
            "chars": [
                {"c": "க்க", "t": "kka", "sound": "kka (held k)", "trick": "First க gets pulli, then second க follows"},
                {"c": "ப்ப", "t": "ppa", "sound": "ppa (held p)", "trick": "Same pattern: pulli + repeat"},
                {"c": "ட்ட", "t": "tta", "sound": "tta (held t)", "trick": "The pause before the second consonant is key"},
                {"c": "ச்ச", "t": "ccha", "sound": "ccha", "trick": "Doubling always uses pulli as connector"},
            ],
            "words": [
                {"w": "அக்கா", "t": "akkaa", "m": "elder sister"},
                {"w": "அப்பா", "t": "appaa", "m": "father"},
                {"w": "எட்டு", "t": "ettu", "m": "eight"},
            ],
            "skills": ["Reading doubled consonants", "Pulli as consonant connector", "Pronunciation of geminates"],
        },
        {
            "num": 14, "slug": "nasal_clusters", "title": "Nasal + Stop Clusters",
            "subtitle": "ங்க, ஞ்ச, ண்ட, ந்த, ம்ப — the natural pairs",
            "desc": "Learn the five natural nasal-stop combinations that are extremely common in Tamil.",
            "chars": [
                {"c": "ங்க", "t": "ngka", "sound": "nk as in think", "trick": "Nasal ங + hard க — the 'nk' pair"},
                {"c": "ஞ்ச", "t": "nycha", "sound": "nch as in lunch", "trick": "Nasal ஞ + hard ச — the 'nch' pair"},
                {"c": "ண்ட", "t": "Nda", "sound": "nd (retroflex)", "trick": "Retroflex nasal + retroflex stop"},
                {"c": "ந்த", "t": "ntha", "sound": "nth as in tenth", "trick": "Dental nasal + dental stop"},
                {"c": "ம்ப", "t": "mpa", "sound": "mp as in jump", "trick": "Labial nasal + labial stop"},
            ],
            "words": [
                {"w": "மாங்காய்", "t": "maangkaay", "m": "mango (raw)"},
                {"w": "பந்து", "t": "panthu", "m": "ball"},
                {"w": "கொம்பு", "t": "kompu", "m": "horn"},
            ],
            "skills": ["Nasal-stop cluster reading", "The 5 natural pairs", "Cluster pronunciation"],
        },
        {
            "num": 15, "slug": "medial_softening", "title": "Medial Softening Rules",
            "subtitle": "When க becomes g, ப becomes b, ட becomes d",
            "desc": "Understand how Tamil hard consonants soften when they appear between vowels.",
            "chars": [
                {"c": "க → [g]", "t": "ka → ga", "sound": "k becomes g between vowels", "trick": "ஆகா = 'aagaa' not 'aakaa'"},
                {"c": "ச → [s/ʃ]", "t": "sa → sa/sha", "sound": "ch can become s between vowels", "trick": "Context dependent softening"},
                {"c": "ட → [d]", "t": "ta → da", "sound": "t becomes d between vowels", "trick": "நாடு = 'naadu' not 'naatu'"},
                {"c": "ப → [b]", "t": "pa → ba", "sound": "p becomes b between vowels", "trick": "அபா → 'abaa'"},
            ],
            "words": [
                {"w": "நாடு", "t": "naadu", "m": "country (ட softens to d)"},
                {"w": "அகம்", "t": "agam", "m": "inside (க softens to g)"},
                {"w": "சபை", "t": "sabai", "m": "assembly (ப softens to b)"},
            ],
            "skills": ["Medial softening rules", "When to soften hard consonants", "Reading words with softened sounds"],
        },
        {
            "num": 16, "slug": "special_characters", "title": "Special Characters & Symbols",
            "subtitle": "ஃ (Aytham), ஸ, ஷ, ஹ — Grantha and special marks",
            "desc": "Learn the special Tamil characters including the unique Aytham and borrowed Grantha letters.",
            "chars": [
                {"c": "ஃ", "t": "ah", "sound": "a glottal stop or 'h'", "trick": "Three dots — the visarga, a breathy stop"},
                {"c": "ஸ", "t": "sa", "sound": "sa as in sun", "trick": "Grantha letter borrowed from Sanskrit for 's'"},
                {"c": "ஷ", "t": "sha", "sound": "sh as in ship", "trick": "Grantha letter for the 'sh' sound"},
                {"c": "ஹ", "t": "ha", "sound": "ha as in hat", "trick": "Grantha letter for the 'h' sound"},
            ],
            "words": [
                {"w": "ஸ்ரீ", "t": "srii", "m": "Sri / honorific"},
                {"w": "ஷாப்", "t": "shaap", "m": "shop"},
                {"w": "ஹலோ", "t": "haloo", "m": "hello"},
            ],
            "skills": ["Aytham ஃ", "Grantha letters ஸ ஷ ஹ", "Reading borrowed words"],
        },
        {
            "num": 17, "slug": "reading_words", "title": "Reading Real Words",
            "subtitle": "Putting it all together with common vocabulary",
            "desc": "Practice reading complete Tamil words using everything you've learned so far.",
            "chars": [],
            "words": [
                {"w": "வணக்கம்", "t": "vanakkam", "m": "hello/greetings"},
                {"w": "நன்றி", "t": "nandri", "m": "thank you"},
                {"w": "தண்ணீர்", "t": "thanniir", "m": "water"},
                {"w": "சாப்பாடு", "t": "saappaadu", "m": "food/meal"},
                {"w": "புத்தகம்", "t": "putthagam", "m": "book"},
                {"w": "பள்ளிக்கூடம்", "t": "pallikuudam", "m": "school"},
                {"w": "மருந்து", "t": "marunthu", "m": "medicine"},
                {"w": "கடை", "t": "kadai", "m": "shop"},
            ],
            "skills": ["Reading multi-syllable words", "Applying all learned rules", "Common vocabulary recognition"],
        },
        {
            "num": 18, "slug": "numbers", "title": "Tamil Numerals",
            "subtitle": "௧ ௨ ௩ ௪ ௫ ௬ ௭ ௮ ௯ ௰",
            "desc": "Learn to read Tamil numerals and number words.",
            "chars": [
                {"c": "௧", "t": "1", "sound": "onru", "trick": "One stroke — one"},
                {"c": "௨", "t": "2", "sound": "irandu", "trick": "Two curves"},
                {"c": "௩", "t": "3", "sound": "muunru", "trick": "Three-like shape"},
                {"c": "௪", "t": "4", "sound": "naanku", "trick": "Four-cornered"},
                {"c": "௫", "t": "5", "sound": "aintu", "trick": "Five dots mentally"},
            ],
            "words": [
                {"w": "ஒன்று", "t": "onru", "m": "one"},
                {"w": "இரண்டு", "t": "irandu", "m": "two"},
                {"w": "மூன்று", "t": "muunru", "m": "three"},
                {"w": "பத்து", "t": "patthu", "m": "ten"},
            ],
            "skills": ["Tamil numeral symbols", "Number words 1-10", "Reading prices and dates"],
        },
        {
            "num": 19, "slug": "reading_sentences", "title": "Reading Simple Sentences",
            "subtitle": "From words to sentences",
            "desc": "Practice reading complete Tamil sentences and short phrases.",
            "chars": [],
            "words": [
                {"w": "நான் தமிழ் படிக்கிறேன்", "t": "naan tamizh padikkireen", "m": "I am learning Tamil"},
                {"w": "இது என் புத்தகம்", "t": "itu en putthagam", "m": "This is my book"},
                {"w": "அவர் யார்?", "t": "avar yaar?", "m": "Who is he/she?"},
                {"w": "நன்றாக இருக்கிறது", "t": "nanraaga irukkiRatu", "m": "It is good"},
            ],
            "skills": ["Reading full sentences", "Word boundary recognition", "Question markers"],
        },
        {
            "num": 20, "slug": "final_review", "title": "Final Review & Reading Challenge",
            "subtitle": "Show what you've mastered!",
            "desc": "A comprehensive review of all Tamil script elements with reading challenges.",
            "chars": [],
            "words": [
                {"w": "தமிழ்நாடு", "t": "tamilnaadu", "m": "Tamil Nadu (state)"},
                {"w": "சென்னை", "t": "chennai", "m": "Chennai (city)"},
                {"w": "கல்வி", "t": "kalvi", "m": "education"},
                {"w": "உலகம்", "t": "ulagam", "m": "world"},
                {"w": "மகிழ்ச்சி", "t": "magizhchi", "m": "happiness"},
            ],
            "skills": ["Complete Tamil script mastery", "Reading any Tamil text", "Confidence in script recognition"],
        },
    ]
}

MALAYALAM_DATA = {
    "code": "ml",
    "name": "Malayalam",
    "full_name": "Malayalam",
    "unit_id": "ml_unit_1",
    "unit_title": "Reading Malayalam Script",
    "unit_subtitle": "Master the complete Malayalam writing system",
    "unit_description": "A 20-lesson course teaching you to read Malayalam script from basic vowels and consonants through conjuncts, chillus, and real-world reading.",
    "lessons": [
        {
            "num": 1, "slug": "first_vowels", "title": "The First Vowels",
            "subtitle": "അ, ആ, ഇ, ഈ — your entry into Malayalam",
            "desc": "Learn the first four Malayalam vowels with the critical short vs long distinction.",
            "chars": [
                {"c": "അ", "t": "a", "sound": "a in about", "trick": "Looks like a chair — sit and say 'a'"},
                {"c": "ആ", "t": "aa", "sound": "a in father", "trick": "അ with a tail — longer sound, longer letter"},
                {"c": "ഇ", "t": "i", "sound": "i in bit", "trick": "Small and compact for a short sound"},
                {"c": "ഈ", "t": "ii", "sound": "ee in see", "trick": "Taller version — stretched sound"},
            ],
            "words": [
                {"w": "അമ്മ", "t": "amma", "m": "mother"},
                {"w": "ആന", "t": "aana", "m": "elephant"},
                {"w": "ഇല", "t": "ila", "m": "leaf"},
            ],
            "skills": ["Recognizing അ ആ ഇ ഈ", "Short vs long vowels", "Vowel pairs concept"],
        },
        {
            "num": 2, "slug": "more_vowels", "title": "More Vowels",
            "subtitle": "ഉ, ഊ, എ, ഏ, ഐ",
            "desc": "Continue with five more vowels to build your vowel repertoire.",
            "chars": [
                {"c": "ഉ", "t": "u", "sound": "u in put", "trick": "Rounded shape for a rounded lip sound"},
                {"c": "ഊ", "t": "uu", "sound": "oo in food", "trick": "Bigger version of ഉ"},
                {"c": "എ", "t": "e", "sound": "e in bed", "trick": "Open top — short 'e'"},
                {"c": "ഏ", "t": "ee", "sound": "ay in say", "trick": "Taller version — long 'ee'"},
                {"c": "ഐ", "t": "ai", "sound": "ai in aisle", "trick": "Two-part sound, distinctive shape"},
            ],
            "words": [
                {"w": "ഉപ്പ്", "t": "uppu", "m": "salt"},
                {"w": "ഊഞ്ഞാൽ", "t": "uunhjaal", "m": "swing"},
                {"w": "എന്ത്", "t": "enth", "m": "what"},
            ],
            "skills": ["Recognizing ഉ ഊ എ ഏ ഐ", "All front and back vowels", "Growing word reading"],
        },
        {
            "num": 3, "slug": "final_vowels", "title": "Completing the Vowels",
            "subtitle": "ഒ, ഓ, ഔ, അം, അഃ",
            "desc": "Complete the vowel inventory with back vowels and special marks.",
            "chars": [
                {"c": "ഒ", "t": "o", "sound": "o in hot", "trick": "Round shape for round sound"},
                {"c": "ഓ", "t": "oo", "sound": "o in go", "trick": "Extended version of ഒ"},
                {"c": "ഔ", "t": "au", "sound": "ow in how", "trick": "Wide diphthong sound"},
                {"c": "അം", "t": "am", "sound": "nasal ending", "trick": "Anusvara — adds nasal"},
                {"c": "അഃ", "t": "aha", "sound": "breathy h ending", "trick": "Visarga — adds aspiration"},
            ],
            "words": [
                {"w": "ഒന്ന്", "t": "onnu", "m": "one"},
                {"w": "ഓട്ടം", "t": "oottam", "m": "running"},
                {"w": "ഔഷധം", "t": "aushadham", "m": "medicine"},
            ],
            "skills": ["Complete vowel set (15 vowels)", "Anusvara and Visarga", "Reading any vowel"],
        },
        {
            "num": 4, "slug": "first_consonants", "title": "First Consonants — Velar & Palatal",
            "subtitle": "ക, ഖ, ഗ, ഘ, ങ and ച, ഛ, ജ, ഝ, ഞ",
            "desc": "Learn the first two rows of the consonant chart — velar and palatal stops.",
            "chars": [
                {"c": "ക", "t": "ka", "sound": "ka in karma", "trick": "First consonant — like a pot with handle"},
                {"c": "ഖ", "t": "kha", "sound": "kha (aspirated k)", "trick": "Aspirated = puff of air after k"},
                {"c": "ഗ", "t": "ga", "sound": "ga in garden", "trick": "Voiced version of ക"},
                {"c": "ഘ", "t": "gha", "sound": "gha (aspirated g)", "trick": "Voiced + aspirated"},
                {"c": "ങ", "t": "nga", "sound": "ng in sing", "trick": "Nasal of this group"},
            ],
            "words": [
                {"w": "കര", "t": "kara", "m": "shore/land"},
                {"w": "ഗുരു", "t": "guru", "m": "teacher"},
                {"w": "ജലം", "t": "jalam", "m": "water"},
            ],
            "skills": ["Velar consonants (k-group)", "Palatal consonants (ch-group)", "Aspiration concept"],
        },
        {
            "num": 5, "slug": "retroflex_dental", "title": "Retroflex & Dental Consonants",
            "subtitle": "ട, ഠ, ഡ, ഢ, ണ and ത, ഥ, ദ, ധ, ന",
            "desc": "Learn the retroflex and dental rows — a crucial distinction in Malayalam.",
            "chars": [
                {"c": "ട", "t": "Ta", "sound": "ta (tongue curled back)", "trick": "Retroflex — tongue touches palate"},
                {"c": "ഡ", "t": "Da", "sound": "da (retroflex)", "trick": "Voiced retroflex"},
                {"c": "ണ", "t": "Na", "sound": "na (retroflex)", "trick": "Retroflex nasal"},
                {"c": "ത", "t": "tha", "sound": "th (dental, tongue on teeth)", "trick": "Dental — tongue touches teeth"},
                {"c": "ന", "t": "na", "sound": "na (dental)", "trick": "Dental nasal"},
            ],
            "words": [
                {"w": "വീട്", "t": "viit", "m": "house"},
                {"w": "നാട്", "t": "naad", "m": "country/land"},
                {"w": "തല", "t": "thala", "m": "head"},
            ],
            "skills": ["Retroflex consonants", "Dental consonants", "Retroflex vs dental distinction"],
        },
        {
            "num": 6, "slug": "labial_semivowels", "title": "Labials, Semivowels & Sibilants",
            "subtitle": "പ, ഫ, ബ, ഭ, മ and യ, ര, ല, വ, ശ, ഷ, സ, ഹ",
            "desc": "Complete the consonant chart with labials, semivowels, and sibilants.",
            "chars": [
                {"c": "പ", "t": "pa", "sound": "pa in papa", "trick": "Round like pursed lips"},
                {"c": "ബ", "t": "ba", "sound": "ba in ball", "trick": "Voiced labial"},
                {"c": "മ", "t": "ma", "sound": "ma in mama", "trick": "Lips together for nasal 'm'"},
                {"c": "യ", "t": "ya", "sound": "ya in yoga", "trick": "Flowing semivowel"},
                {"c": "ര", "t": "ra", "sound": "ra (soft r)", "trick": "Gentle r sound"},
            ],
            "words": [
                {"w": "പഴം", "t": "pazham", "m": "fruit"},
                {"w": "മരം", "t": "maram", "m": "tree"},
                {"w": "വിള", "t": "vila", "m": "crop"},
            ],
            "skills": ["Labial consonants", "Semivowels and liquids", "Sibilants ശ ഷ സ"],
        },
        {
            "num": 7, "slug": "special_consonants", "title": "Special Malayalam Consonants",
            "subtitle": "ള, ഴ, റ — uniquely Malayalam sounds",
            "desc": "Learn the special consonants that make Malayalam distinct from other Indian languages.",
            "chars": [
                {"c": "ള", "t": "La", "sound": "retroflex l", "trick": "Heavy 'l' — tongue curls back"},
                {"c": "ഴ", "t": "zha", "sound": "unique retroflex zh", "trick": "The famous Malayalam/Tamil 'zh' — tongue curls far back"},
                {"c": "റ", "t": "Ra", "sound": "trilled r", "trick": "Strong trilled R like Spanish 'rr'"},
                {"c": "ല", "t": "la", "sound": "la (dental l)", "trick": "Regular 'l' — tongue on teeth"},
            ],
            "words": [
                {"w": "കേരളം", "t": "keeralam", "m": "Kerala"},
                {"w": "വെള്ളം", "t": "vellam", "m": "water"},
                {"w": "മഴ", "t": "mazha", "m": "rain"},
            ],
            "skills": ["Three types of L/R in Malayalam", "The unique ഴ (zha)", "Distinguishing ര, റ, ല, ള, ഴ"],
        },
        {
            "num": 8, "slug": "chandrakkala", "title": "The Chandrakkala (Virama)",
            "subtitle": "് — stripping the inherent vowel",
            "desc": "Learn how the chandrakkala removes the inherent 'a' from consonants.",
            "chars": [
                {"c": "ക് vs ക", "t": "k vs ka", "sound": "pure k vs ka", "trick": "The crescent moon (്) = silence the 'a'"},
                {"c": "ന് vs ന", "t": "n vs na", "sound": "pure n vs na", "trick": "Essential for word-final consonants"},
                {"c": "ല് vs ല", "t": "l vs la", "sound": "pure l vs la", "trick": "Common at word endings"},
                {"c": "ർ", "t": "r", "sound": "pure r", "trick": "ര + ് = ർ (sometimes written as special form)"},
            ],
            "words": [
                {"w": "വീട്", "t": "viit", "m": "house (ends in pure t)"},
                {"w": "നാൽ", "t": "naal", "m": "four (ends in pure l)"},
                {"w": "അവർ", "t": "avar", "m": "they (ends in pure r)"},
            ],
            "skills": ["Chandrakkala usage", "Reading word-final pure consonants", "When to apply virama"],
        },
        {
            "num": 9, "slug": "vowel_signs_1", "title": "Vowel Signs — Part 1",
            "subtitle": "Changing the inherent 'a' to other vowels",
            "desc": "Learn how vowel signs (matras) modify consonants in Malayalam.",
            "chars": [
                {"c": "കാ", "t": "kaa", "sound": "kaa", "trick": "Add a stroke for 'aa'"},
                {"c": "കി", "t": "ki", "sound": "ki", "trick": "Loop on top for 'i'"},
                {"c": "കീ", "t": "kii", "sound": "kii", "trick": "Taller loop for 'ii'"},
                {"c": "കു", "t": "ku", "sound": "ku", "trick": "Mark below for 'u'"},
                {"c": "കൂ", "t": "kuu", "sound": "kuu", "trick": "Longer mark below for 'uu'"},
            ],
            "words": [
                {"w": "കാല്", "t": "kaal", "m": "leg/foot"},
                {"w": "കുട", "t": "kuda", "m": "umbrella"},
                {"w": "മീൻ", "t": "miin", "m": "fish"},
            ],
            "skills": ["aa, i, ii, u, uu vowel signs", "Applying signs to any consonant", "Sign position rules"],
        },
        {
            "num": 10, "slug": "vowel_signs_2", "title": "Vowel Signs — Part 2",
            "subtitle": "The remaining vowel markers",
            "desc": "Complete the vowel sign system with e, ee, ai, o, oo, au markers.",
            "chars": [
                {"c": "കെ", "t": "ke", "sound": "ke", "trick": "Pre-positioned marker for 'e'"},
                {"c": "കേ", "t": "kee", "sound": "kay", "trick": "Pre-positioned for long 'ee'"},
                {"c": "കൈ", "t": "kai", "sound": "kai", "trick": "Special marker for 'ai'"},
                {"c": "കൊ", "t": "ko", "sound": "ko", "trick": "Wraps around — ெ+ാ"},
                {"c": "കോ", "t": "koo", "sound": "koo", "trick": "Wraps around — ே+ா"},
            ],
            "words": [
                {"w": "കേരളം", "t": "keeralam", "m": "Kerala"},
                {"w": "കൊച്ചി", "t": "kochi", "m": "Kochi (city)"},
                {"w": "കൈ", "t": "kai", "m": "hand"},
            ],
            "skills": ["Complete vowel sign system", "Pre-positioned signs", "Split/compound signs"],
        },
        {
            "num": 11, "slug": "chillus", "title": "The Chillus — Pure Consonant Forms",
            "subtitle": "ൻ, ൺ, ൽ, ൾ, ർ, ൿ — consonants without virama",
            "desc": "Learn Malayalam's unique chillu letters — special standalone consonant forms.",
            "chars": [
                {"c": "ൻ", "t": "n", "sound": "pure n (dental)", "trick": "Standalone n — no chandrakkala needed"},
                {"c": "ൺ", "t": "N", "sound": "pure N (retroflex)", "trick": "Standalone retroflex n"},
                {"c": "ൽ", "t": "l", "sound": "pure l", "trick": "Standalone l"},
                {"c": "ൾ", "t": "L", "sound": "pure L (retroflex)", "trick": "Standalone retroflex l"},
                {"c": "ർ", "t": "r", "sound": "pure r", "trick": "Standalone r"},
            ],
            "words": [
                {"w": "അവൻ", "t": "avan", "m": "he (informal)"},
                {"w": "അവൾ", "t": "aval", "m": "she (informal)"},
                {"w": "നാർ", "t": "naar", "m": "fiber"},
            ],
            "skills": ["All chillu forms", "When to use chillus vs chandrakkala", "Reading chillu-ending words"],
        },
        {
            "num": 12, "slug": "conjuncts_1", "title": "Common Conjunct Consonants — Part 1",
            "subtitle": "When two consonants join: ക്ക, ന്ന, മ്മ, ല്ല",
            "desc": "Learn the most common doubled and combined consonant clusters in Malayalam.",
            "chars": [
                {"c": "ക്ക", "t": "kka", "sound": "kka", "trick": "Two k's joined — the first loses its 'a'"},
                {"c": "ന്ന", "t": "nna", "sound": "nna", "trick": "Doubled dental n"},
                {"c": "മ്മ", "t": "mma", "sound": "mma", "trick": "Doubled m"},
                {"c": "ല്ല", "t": "lla", "sound": "lla", "trick": "Doubled l"},
                {"c": "ത്ത", "t": "ttha", "sound": "ttha", "trick": "Doubled dental t"},
            ],
            "words": [
                {"w": "അമ്മ", "t": "amma", "m": "mother"},
                {"w": "അക്ക", "t": "akka", "m": "elder sister"},
                {"w": "എന്ന", "t": "enna", "m": "what/which"},
            ],
            "skills": ["Doubled consonant clusters", "Reading geminated sounds", "Common cluster patterns"],
        },
        {
            "num": 13, "slug": "conjuncts_2", "title": "More Conjuncts",
            "subtitle": "ന്ത, ണ്ട, ങ്ക, ഞ്ച, മ്പ — nasal clusters",
            "desc": "Learn nasal-stop clusters and other common consonant combinations.",
            "chars": [
                {"c": "ന്ത", "t": "ntha", "sound": "nth", "trick": "Dental nasal + dental stop"},
                {"c": "ണ്ട", "t": "Nda", "sound": "nd (retroflex)", "trick": "Retroflex nasal + retroflex stop"},
                {"c": "ങ്ക", "t": "ngka", "sound": "nk", "trick": "Velar nasal + velar stop"},
                {"c": "ഞ്ച", "t": "ncha", "sound": "nch", "trick": "Palatal nasal + palatal stop"},
                {"c": "മ്പ", "t": "mpa", "sound": "mp", "trick": "Labial nasal + labial stop"},
            ],
            "words": [
                {"w": "പന്ത്", "t": "panth", "m": "ball"},
                {"w": "കണ്ട", "t": "kanda", "m": "saw (past tense)"},
                {"w": "കൊമ്പ്", "t": "komp", "m": "horn"},
            ],
            "skills": ["Nasal-stop clusters", "Five natural nasal pairs", "Complex cluster reading"],
        },
        {
            "num": 14, "slug": "conjuncts_3", "title": "Advanced Conjuncts",
            "subtitle": "സ്ത, ക്ഷ, ജ്ഞ, ശ്ര — Sanskrit-origin clusters",
            "desc": "Learn the less common but important conjunct consonants, many from Sanskrit origin.",
            "chars": [
                {"c": "സ്ത", "t": "stha", "sound": "sth", "trick": "Common in tatsama words"},
                {"c": "ക്ഷ", "t": "ksha", "sound": "ksh", "trick": "A classic Sanskrit cluster"},
                {"c": "ജ്ഞ", "t": "jnya", "sound": "gnya", "trick": "Pronounced differently than spelled"},
                {"c": "ശ്ര", "t": "shra", "sound": "shr", "trick": "Common prefix in names"},
            ],
            "words": [
                {"w": "സ്ഥലം", "t": "sthalam", "m": "place"},
                {"w": "അക്ഷരം", "t": "aksharam", "m": "letter/character"},
                {"w": "ശ്രീ", "t": "shrii", "m": "Sri/auspicious"},
            ],
            "skills": ["Sanskrit-origin clusters", "Reading formal/literary words", "Complex ligatures"],
        },
        {
            "num": 15, "slug": "old_new_script", "title": "Old vs New Script Forms",
            "subtitle": "Understanding script reform differences",
            "desc": "Learn about the Malayalam script reform and how to read both old and new forms.",
            "chars": [
                {"c": "Old ക്ക vs New ക്ക", "t": "kka", "sound": "same sound", "trick": "Old script had more ligatures, new script is more linear"},
                {"c": "Old ന്ന vs New ന്ന", "t": "nna", "sound": "same sound", "trick": "You'll encounter both forms in daily life"},
            ],
            "words": [
                {"w": "മലയാളം", "t": "malayaalam", "m": "Malayalam (the language)"},
                {"w": "ഭാഷ", "t": "bhaasha", "m": "language"},
                {"w": "ലിപി", "t": "lipi", "m": "script"},
            ],
            "skills": ["Old vs new script recognition", "Script reform awareness", "Reading both forms"],
        },
        {
            "num": 16, "slug": "reading_words", "title": "Reading Real Words",
            "subtitle": "Common vocabulary practice",
            "desc": "Practice reading everyday Malayalam words using all your knowledge.",
            "chars": [],
            "words": [
                {"w": "നമസ്കാരം", "t": "namaskaaram", "m": "greetings"},
                {"w": "നന്ദി", "t": "nandi", "m": "thank you"},
                {"w": "വെള്ളം", "t": "vellam", "m": "water"},
                {"w": "ചോറ്", "t": "choor", "m": "rice"},
                {"w": "പുസ്തകം", "t": "pusthakam", "m": "book"},
                {"w": "വിദ്യാലയം", "t": "vidyaalayam", "m": "school"},
            ],
            "skills": ["Reading common vocabulary", "Applying all rules", "Word recognition speed"],
        },
        {
            "num": 17, "slug": "numbers", "title": "Malayalam Numerals",
            "subtitle": "൧ ൨ ൩ ൪ ൫ ൬ ൭ ൮ ൯ ൦",
            "desc": "Learn to read Malayalam numerals and number words.",
            "chars": [
                {"c": "൧", "t": "1", "sound": "onnu", "trick": "One"},
                {"c": "൨", "t": "2", "sound": "randu", "trick": "Two"},
                {"c": "൩", "t": "3", "sound": "muunnu", "trick": "Three"},
                {"c": "൪", "t": "4", "sound": "naalu", "trick": "Four"},
                {"c": "൫", "t": "5", "sound": "anchu", "trick": "Five"},
            ],
            "words": [
                {"w": "ഒന്ന്", "t": "onnu", "m": "one"},
                {"w": "രണ്ട്", "t": "randu", "m": "two"},
                {"w": "പത്ത്", "t": "patthu", "m": "ten"},
            ],
            "skills": ["Malayalam numeral symbols", "Number words 1-10", "Reading quantities"],
        },
        {
            "num": 18, "slug": "signage_reading", "title": "Reading Signs & Labels",
            "subtitle": "Real-world reading practice",
            "desc": "Practice reading Malayalam as you'd encounter it on signs, labels, and daily life.",
            "chars": [],
            "words": [
                {"w": "കടകൾ", "t": "kadakal", "m": "shops"},
                {"w": "ആശുപത്രി", "t": "aashupatri", "m": "hospital"},
                {"w": "വിമാനത്താവളം", "t": "vimaanatthaavalam", "m": "airport"},
                {"w": "റെയിൽവേ സ്റ്റേഷൻ", "t": "railway station", "m": "railway station"},
            ],
            "skills": ["Environmental reading", "Sign recognition", "Practical application"],
        },
        {
            "num": 19, "slug": "reading_sentences", "title": "Reading Simple Sentences",
            "subtitle": "From words to sentences",
            "desc": "Practice reading complete Malayalam sentences.",
            "chars": [],
            "words": [
                {"w": "ഞാൻ മലയാളം പഠിക്കുന്നു", "t": "njaan malayaalam padikkunnu", "m": "I am learning Malayalam"},
                {"w": "ഇത് എന്‍റെ പുസ്തകം ആണ്", "t": "ith ente pusthakam aanu", "m": "This is my book"},
                {"w": "നിങ്ങൾ എവിടെ നിന്ന്?", "t": "ningal evide ninnu?", "m": "Where are you from?"},
            ],
            "skills": ["Full sentence reading", "Word boundary recognition", "Natural reading flow"],
        },
        {
            "num": 20, "slug": "final_review", "title": "Final Review & Challenge",
            "subtitle": "Show your Malayalam reading mastery!",
            "desc": "A comprehensive review with reading challenges covering all script elements.",
            "chars": [],
            "words": [
                {"w": "കേരളം", "t": "keeralam", "m": "Kerala"},
                {"w": "തിരുവനന്തപുരം", "t": "thiruvananthapuram", "m": "Thiruvananthapuram"},
                {"w": "സ്വാഗതം", "t": "swaagatham", "m": "welcome"},
                {"w": "ആരോഗ്യം", "t": "aarogyam", "m": "health"},
            ],
            "skills": ["Complete Malayalam script mastery", "Reading any Malayalam text", "Script confidence"],
        },
    ]
}

KANNADA_DATA = {
    "code": "kn",
    "name": "Kannada",
    "full_name": "Kannada",
    "unit_id": "kn_unit_1",
    "unit_title": "Reading Kannada Script",
    "unit_subtitle": "Master the Kannada writing system step by step",
    "unit_description": "A 20-lesson course teaching you to read Kannada script. From vowels and consonants through vowel marks, conjuncts, and reading real Kannada text.",
    "lessons": [
        {
            "num": 1, "slug": "vowels_part_1", "title": "The First Vowels",
            "subtitle": "ಅ, ಆ, ಇ, ಈ — the foundation",
            "desc": "Learn the first four Kannada vowels — two short/long pairs.",
            "chars": [
                {"c": "ಅ", "t": "a", "sound": "a in about", "trick": "Rounded shape — the foundation letter"},
                {"c": "ಆ", "t": "aa", "sound": "a in father", "trick": "ಅ with a tail — longer sound"},
                {"c": "ಇ", "t": "i", "sound": "i in bit", "trick": "Compact shape for short sound"},
                {"c": "ಈ", "t": "ii", "sound": "ee in see", "trick": "Extended ಇ — longer sound"},
            ],
            "words": [
                {"w": "ಅಮ್ಮ", "t": "amma", "m": "mother"},
                {"w": "ಆನೆ", "t": "aane", "m": "elephant"},
                {"w": "ಈಗ", "t": "iiga", "m": "now"},
            ],
            "skills": ["Recognizing ಅ ಆ ಇ ಈ", "Short vs long distinction", "Vowel pair concept"],
        },
        {
            "num": 2, "slug": "vowels_part_2", "title": "More Vowels",
            "subtitle": "ಉ, ಊ, ಋ, ಎ, ಏ, ಐ",
            "desc": "Continue with more vowels including the Sanskrit vowel ಋ.",
            "chars": [
                {"c": "ಉ", "t": "u", "sound": "u in put", "trick": "Rounded for rounded lips"},
                {"c": "ಊ", "t": "uu", "sound": "oo in food", "trick": "Extended ಉ"},
                {"c": "ಋ", "t": "ru", "sound": "ri in Sanskrit words", "trick": "Rare vowel from Sanskrit"},
                {"c": "ಎ", "t": "e", "sound": "e in bed", "trick": "Open top for short 'e'"},
                {"c": "ಏ", "t": "ee", "sound": "ay in say", "trick": "Extended for long 'ee'"},
                {"c": "ಐ", "t": "ai", "sound": "ai in aisle", "trick": "Diphthong — two sounds in one"},
            ],
            "words": [
                {"w": "ಊರು", "t": "uuru", "m": "town/village"},
                {"w": "ಎಲ್ಲಾ", "t": "ellaa", "m": "all/everyone"},
                {"w": "ಐದು", "t": "aidu", "m": "five"},
            ],
            "skills": ["Six more vowels", "The Sanskrit vowel ಋ", "Growing vowel recognition"],
        },
        {
            "num": 3, "slug": "vowels_complete", "title": "Completing the Vowels",
            "subtitle": "ಒ, ಓ, ಔ, ಅಂ, ಅಃ",
            "desc": "Finish the vowel inventory with back vowels and special marks.",
            "chars": [
                {"c": "ಒ", "t": "o", "sound": "o in hot", "trick": "Round sound, round shape"},
                {"c": "ಓ", "t": "oo", "sound": "o in go", "trick": "Long version of ಒ"},
                {"c": "ಔ", "t": "au", "sound": "ow in how", "trick": "Diphthong — wide sound"},
                {"c": "ಅಂ", "t": "am", "sound": "nasal ending", "trick": "Anusvara — dot above"},
                {"c": "ಅಃ", "t": "aha", "sound": "breathy ending", "trick": "Visarga — two dots"},
            ],
            "words": [
                {"w": "ಒಂದು", "t": "ondu", "m": "one"},
                {"w": "ಓದು", "t": "oodu", "m": "read"},
                {"w": "ಔಷಧ", "t": "aushadha", "m": "medicine"},
            ],
            "skills": ["Complete vowel chart (14 vowels)", "Anusvara and Visarga", "All vowels mastered"],
        },
        {
            "num": 4, "slug": "velar_palatal", "title": "Velar & Palatal Consonants",
            "subtitle": "ಕ, ಖ, ಗ, ಘ, ಙ and ಚ, ಛ, ಜ, ಝ, ಞ",
            "desc": "Learn the first two consonant groups — produced at the back and middle of the mouth.",
            "chars": [
                {"c": "ಕ", "t": "ka", "sound": "ka in karma", "trick": "The first consonant — gateway letter"},
                {"c": "ಖ", "t": "kha", "sound": "kha (aspirated)", "trick": "k + puff of air"},
                {"c": "ಗ", "t": "ga", "sound": "ga in garden", "trick": "Voiced k"},
                {"c": "ಚ", "t": "cha", "sound": "cha in chai", "trick": "Palatal — middle of mouth"},
                {"c": "ಜ", "t": "ja", "sound": "ja in jar", "trick": "Voiced ch"},
            ],
            "words": [
                {"w": "ಕನ್ನಡ", "t": "kannada", "m": "Kannada (language)"},
                {"w": "ಗುರು", "t": "guru", "m": "teacher"},
                {"w": "ಚಂದ್ರ", "t": "chandra", "m": "moon"},
            ],
            "skills": ["Velar consonants (k-group)", "Palatal consonants (ch-group)", "Aspirated vs unaspirated"],
        },
        {
            "num": 5, "slug": "retroflex_dental", "title": "Retroflex & Dental Consonants",
            "subtitle": "ಟ, ಠ, ಡ, ಢ, ಣ and ತ, ಥ, ದ, ಧ, ನ",
            "desc": "Master the crucial distinction between retroflex and dental sounds.",
            "chars": [
                {"c": "ಟ", "t": "Ta", "sound": "ta (retroflex)", "trick": "Tongue curls back to palate"},
                {"c": "ಡ", "t": "Da", "sound": "da (retroflex)", "trick": "Voiced retroflex"},
                {"c": "ಣ", "t": "Na", "sound": "na (retroflex)", "trick": "Retroflex nasal"},
                {"c": "ತ", "t": "tha", "sound": "th (dental)", "trick": "Tongue touches teeth"},
                {"c": "ನ", "t": "na", "sound": "na (dental)", "trick": "Dental nasal"},
            ],
            "words": [
                {"w": "ನಾಡು", "t": "naadu", "m": "land/country"},
                {"w": "ಮಾತು", "t": "maathu", "m": "word/speech"},
                {"w": "ದಿನ", "t": "dina", "m": "day"},
            ],
            "skills": ["Retroflex consonants", "Dental consonants", "Hearing the difference"],
        },
        {
            "num": 6, "slug": "labial_semivowels", "title": "Labials & Semivowels",
            "subtitle": "ಪ, ಫ, ಬ, ಭ, ಮ and ಯ, ರ, ಲ, ವ",
            "desc": "Complete the main consonant groups with labials and semivowels.",
            "chars": [
                {"c": "ಪ", "t": "pa", "sound": "pa", "trick": "Lips together"},
                {"c": "ಬ", "t": "ba", "sound": "ba", "trick": "Voiced labial"},
                {"c": "ಮ", "t": "ma", "sound": "ma", "trick": "Nasal labial"},
                {"c": "ಯ", "t": "ya", "sound": "ya", "trick": "Semivowel"},
                {"c": "ರ", "t": "ra", "sound": "ra", "trick": "Liquid r"},
                {"c": "ಲ", "t": "la", "sound": "la", "trick": "Lateral l"},
                {"c": "ವ", "t": "va", "sound": "va", "trick": "Labio-dental"},
            ],
            "words": [
                {"w": "ಪುಸ್ತಕ", "t": "pusthaka", "m": "book"},
                {"w": "ಬೆಂಗಳೂರು", "t": "bengaluuru", "m": "Bengaluru"},
                {"w": "ಮನೆ", "t": "mane", "m": "house"},
            ],
            "skills": ["Labial consonants", "Semivowels", "All basic consonants complete"],
        },
        {
            "num": 7, "slug": "sibilants_special", "title": "Sibilants & Special Consonants",
            "subtitle": "ಶ, ಷ, ಸ, ಹ, ಳ",
            "desc": "Learn the sibilants, aspirate, and the special retroflex ಳ.",
            "chars": [
                {"c": "ಶ", "t": "sha", "sound": "sh in ship", "trick": "Palatal sibilant"},
                {"c": "ಷ", "t": "Sha", "sound": "sh (retroflex)", "trick": "Retroflex sibilant"},
                {"c": "ಸ", "t": "sa", "sound": "s in sun", "trick": "Dental sibilant"},
                {"c": "ಹ", "t": "ha", "sound": "h in hat", "trick": "Glottal aspirate"},
                {"c": "ಳ", "t": "La", "sound": "retroflex l", "trick": "Heavy l — tongue curls back"},
            ],
            "words": [
                {"w": "ಶಾಲೆ", "t": "shaale", "m": "school"},
                {"w": "ಸರಿ", "t": "sari", "m": "correct/okay"},
                {"w": "ಹಣ", "t": "hana", "m": "money"},
            ],
            "skills": ["Three sibilants", "The aspirate ಹ", "Retroflex ಳ"],
        },
        {
            "num": 8, "slug": "vowel_marks_1", "title": "Vowel Marks — Part 1",
            "subtitle": "ಾ, ಿ, ೀ, ು, ೂ — modifying consonants",
            "desc": "Learn how vowel marks change the inherent 'a' of consonants.",
            "chars": [
                {"c": "ಕಾ", "t": "kaa", "sound": "kaa", "trick": "Add a stroke for 'aa'"},
                {"c": "ಕಿ", "t": "ki", "sound": "ki", "trick": "Small mark for short 'i'"},
                {"c": "ಕೀ", "t": "kii", "sound": "kee", "trick": "Extended mark for long 'ii'"},
                {"c": "ಕು", "t": "ku", "sound": "ku", "trick": "Below mark for 'u'"},
                {"c": "ಕೂ", "t": "kuu", "sound": "koo", "trick": "Extended below for 'uu'"},
            ],
            "words": [
                {"w": "ಕಾರು", "t": "kaaru", "m": "car"},
                {"w": "ಕೀಲಿ", "t": "kiili", "m": "key/parrot"},
                {"w": "ಗೂಡು", "t": "guudu", "m": "nest"},
            ],
            "skills": ["First five vowel marks", "Applying marks to consonants", "Reading marked syllables"],
        },
        {
            "num": 9, "slug": "vowel_marks_2", "title": "Vowel Marks — Part 2",
            "subtitle": "ೆ, ೇ, ೈ, ೊ, ೋ, ೌ — completing the system",
            "desc": "Complete the vowel mark system with e, o, and diphthong markers.",
            "chars": [
                {"c": "ಕೆ", "t": "ke", "sound": "ke", "trick": "Mark for short 'e'"},
                {"c": "ಕೇ", "t": "kee", "sound": "kay", "trick": "Mark for long 'ee'"},
                {"c": "ಕೈ", "t": "kai", "sound": "kai", "trick": "Mark for 'ai' diphthong"},
                {"c": "ಕೊ", "t": "ko", "sound": "ko", "trick": "Mark for short 'o'"},
                {"c": "ಕೋ", "t": "koo", "sound": "koo", "trick": "Mark for long 'oo'"},
                {"c": "ಕೌ", "t": "kau", "sound": "kow", "trick": "Mark for 'au' diphthong"},
            ],
            "words": [
                {"w": "ಕೆಲಸ", "t": "kelasa", "m": "work"},
                {"w": "ಕೋಣೆ", "t": "koone", "m": "room"},
                {"w": "ಕೈ", "t": "kai", "m": "hand"},
            ],
            "skills": ["Complete vowel mark system", "All 12 vowel marks mastered", "Reading any syllable"],
        },
        {
            "num": 10, "slug": "halant_virama", "title": "The Halant (Virama)",
            "subtitle": "್ — removing the inherent vowel",
            "desc": "Learn how the virama strips the inherent 'a' from consonants.",
            "chars": [
                {"c": "ಕ್ vs ಕ", "t": "k vs ka", "sound": "pure k vs ka", "trick": "Small mark below = no vowel"},
                {"c": "ನ್ vs ನ", "t": "n vs na", "sound": "pure n vs na", "trick": "Essential for consonant clusters"},
                {"c": "ಲ್ vs ಲ", "t": "l vs la", "sound": "pure l vs la", "trick": "Common at word endings"},
            ],
            "words": [
                {"w": "ಕನ್ನಡ", "t": "kannada", "m": "Kannada (halant joins consonants)"},
                {"w": "ಅಕ್ಕ", "t": "akka", "m": "elder sister"},
                {"w": "ಹಾಲ್", "t": "haal", "m": "milk"},
            ],
            "skills": ["Virama/halant usage", "Pure consonants", "Consonant joining"],
        },
        {
            "num": 11, "slug": "conjuncts_common", "title": "Common Conjunct Consonants",
            "subtitle": "ಕ್ಕ, ತ್ತ, ನ್ನ, ಲ್ಲ, ಮ್ಮ — doubled consonants",
            "desc": "Learn the most frequently occurring consonant clusters in Kannada.",
            "chars": [
                {"c": "ಕ್ಕ", "t": "kka", "sound": "kka", "trick": "Doubled k — hold then release"},
                {"c": "ತ್ತ", "t": "ttha", "sound": "ttha", "trick": "Doubled dental t"},
                {"c": "ನ್ನ", "t": "nna", "sound": "nna", "trick": "Doubled n"},
                {"c": "ಲ್ಲ", "t": "lla", "sound": "lla", "trick": "Doubled l"},
                {"c": "ಮ್ಮ", "t": "mma", "sound": "mma", "trick": "Doubled m"},
            ],
            "words": [
                {"w": "ಅಕ್ಕ", "t": "akka", "m": "elder sister"},
                {"w": "ಅಮ್ಮ", "t": "amma", "m": "mother"},
                {"w": "ಎಲ್ಲಾ", "t": "ellaa", "m": "all"},
            ],
            "skills": ["Doubled consonants", "Recognizing geminates", "Common cluster patterns"],
        },
        {
            "num": 12, "slug": "conjuncts_nasal", "title": "Nasal Clusters & Mixed Conjuncts",
            "subtitle": "ಂಕ, ಂಚ, ಂಟ, ಂತ, ಂಪ — nasal + stop pairs",
            "desc": "Learn nasal-stop combinations and mixed consonant clusters.",
            "chars": [
                {"c": "ಂಕ/ಙ್ಕ", "t": "ngka", "sound": "nk", "trick": "Velar nasal + velar stop"},
                {"c": "ಂಚ/ಞ್ಚ", "t": "ncha", "sound": "nch", "trick": "Palatal nasal + palatal stop"},
                {"c": "ಂಡ/ಣ್ಡ", "t": "Nda", "sound": "nd (retroflex)", "trick": "Retroflex pair"},
                {"c": "ಂತ/ನ್ತ", "t": "ntha", "sound": "nth", "trick": "Dental pair"},
                {"c": "ಂಪ/ಮ್ಪ", "t": "mpa", "sound": "mp", "trick": "Labial pair"},
            ],
            "words": [
                {"w": "ಬೆಂಗಳೂರು", "t": "bengaluuru", "m": "Bengaluru"},
                {"w": "ಸಂತೆ", "t": "santhe", "m": "market"},
                {"w": "ಗುಂಡು", "t": "gundu", "m": "round/bullet"},
            ],
            "skills": ["Nasal-stop clusters", "Anusvara shorthand", "Complex conjuncts"],
        },
        {
            "num": 13, "slug": "advanced_conjuncts", "title": "Advanced Conjuncts",
            "subtitle": "ಕ್ಷ, ಜ್ಞ, ಶ್ರ, ಸ್ತ — literary clusters",
            "desc": "Learn less common but important conjunct consonants found in formal Kannada.",
            "chars": [
                {"c": "ಕ್ಷ", "t": "ksha", "sound": "ksh", "trick": "Classic Sanskrit cluster"},
                {"c": "ಜ್ಞ", "t": "jnya", "sound": "gnya", "trick": "Pronounced differently than spelled"},
                {"c": "ಶ್ರ", "t": "shra", "sound": "shr", "trick": "Common in names and titles"},
                {"c": "ಸ್ತ", "t": "stha", "sound": "sth", "trick": "Common in tatsama words"},
            ],
            "words": [
                {"w": "ಅಕ್ಷರ", "t": "akshara", "m": "letter/character"},
                {"w": "ವಿಜ್ಞಾನ", "t": "vijnyaana", "m": "science"},
                {"w": "ಶ್ರೀ", "t": "shrii", "m": "Sri/auspicious"},
            ],
            "skills": ["Sanskrit-origin clusters", "Literary vocabulary", "Complex ligatures"],
        },
        {
            "num": 14, "slug": "ottaksharas", "title": "Subscript Consonants (Ottaksharas)",
            "subtitle": "How consonants stack in Kannada",
            "desc": "Understand how Kannada writes consonant clusters using subscript forms.",
            "chars": [
                {"c": "ಕ + ್ + ತ = ಕ್ತ", "t": "kta", "sound": "kta", "trick": "Second consonant goes below"},
                {"c": "ಸ + ್ + ಯ = ಸ್ಯ", "t": "sya", "sound": "sya", "trick": "Ya takes subscript form"},
                {"c": "ಪ + ್ + ರ = ಪ್ರ", "t": "pra", "sound": "pra", "trick": "Ra has a special subscript hook"},
            ],
            "words": [
                {"w": "ಪ್ರತಿ", "t": "prathi", "m": "each/every"},
                {"w": "ವಿದ್ಯಾ", "t": "vidyaa", "m": "knowledge"},
                {"w": "ರಾಷ್ಟ್ರ", "t": "raashtra", "m": "nation"},
            ],
            "skills": ["Subscript consonant forms", "Reading stacked clusters", "Ottakshara recognition"],
        },
        {
            "num": 15, "slug": "reading_words", "title": "Reading Real Words",
            "subtitle": "Common vocabulary practice",
            "desc": "Apply everything to read common Kannada words.",
            "chars": [],
            "words": [
                {"w": "ನಮಸ್ಕಾರ", "t": "namaskaara", "m": "greetings"},
                {"w": "ಧನ್ಯವಾದ", "t": "dhanyavaada", "m": "thank you"},
                {"w": "ನೀರು", "t": "niiru", "m": "water"},
                {"w": "ಊಟ", "t": "uuta", "m": "meal"},
                {"w": "ಮಗು", "t": "magu", "m": "child"},
                {"w": "ಹೆಸರು", "t": "hesaru", "m": "name"},
            ],
            "skills": ["Common vocabulary", "Multi-syllable words", "Practical reading"],
        },
        {
            "num": 16, "slug": "numbers", "title": "Kannada Numerals",
            "subtitle": "೧ ೨ ೩ ೪ ೫ ೬ ೭ ೮ ೯ ೦",
            "desc": "Learn Kannada numeral symbols and number words.",
            "chars": [
                {"c": "೧", "t": "1", "sound": "ondu", "trick": "One"},
                {"c": "೨", "t": "2", "sound": "eradu", "trick": "Two"},
                {"c": "೩", "t": "3", "sound": "muuru", "trick": "Three"},
                {"c": "೪", "t": "4", "sound": "naalku", "trick": "Four"},
                {"c": "೫", "t": "5", "sound": "aidu", "trick": "Five"},
            ],
            "words": [
                {"w": "ಒಂದು", "t": "ondu", "m": "one"},
                {"w": "ಎರಡು", "t": "eradu", "m": "two"},
                {"w": "ಹತ್ತು", "t": "hatthu", "m": "ten"},
            ],
            "skills": ["Kannada numeral symbols", "Number words 1-10"],
        },
        {
            "num": 17, "slug": "signage", "title": "Reading Signs & Labels",
            "subtitle": "Real-world Kannada reading",
            "desc": "Practice reading Kannada as it appears on signs, menus, and labels.",
            "chars": [],
            "words": [
                {"w": "ಅಂಗಡಿ", "t": "angadi", "m": "shop"},
                {"w": "ಆಸ್ಪತ್ರೆ", "t": "aaspathre", "m": "hospital"},
                {"w": "ಬಸ್ ನಿಲ್ದಾಣ", "t": "bas nildaana", "m": "bus station"},
                {"w": "ಮಾರುಕಟ್ಟೆ", "t": "maarukatte", "m": "market"},
            ],
            "skills": ["Environmental reading", "Practical application"],
        },
        {
            "num": 18, "slug": "loanwords", "title": "Reading Loanwords & Modern Kannada",
            "subtitle": "English and Sanskrit borrowings",
            "desc": "Practice reading loanwords and modern vocabulary written in Kannada script.",
            "chars": [],
            "words": [
                {"w": "ಬಸ್", "t": "bas", "m": "bus"},
                {"w": "ಟಿಕೆಟ್", "t": "tiket", "m": "ticket"},
                {"w": "ಫೋನ್", "t": "phoon", "m": "phone"},
                {"w": "ಕಂಪ್ಯೂಟರ್", "t": "kampyuutar", "m": "computer"},
            ],
            "skills": ["Reading English loanwords", "Modern vocabulary", "Transliteration patterns"],
        },
        {
            "num": 19, "slug": "sentences", "title": "Reading Simple Sentences",
            "subtitle": "From words to sentences",
            "desc": "Practice reading complete Kannada sentences.",
            "chars": [],
            "words": [
                {"w": "ನಾನು ಕನ್ನಡ ಕಲಿಯುತ್ತಿದ್ದೇನೆ", "t": "naanu kannada kaliyuttiddeene", "m": "I am learning Kannada"},
                {"w": "ಇದು ನನ್ನ ಪುಸ್ತಕ", "t": "idu nanna pusthaka", "m": "This is my book"},
                {"w": "ನಿಮ್ಮ ಹೆಸರೇನು?", "t": "nimma hesareenu?", "m": "What is your name?"},
            ],
            "skills": ["Full sentence reading", "Word boundaries", "Natural reading flow"],
        },
        {
            "num": 20, "slug": "final_review", "title": "Final Review & Challenge",
            "subtitle": "Prove your Kannada reading mastery!",
            "desc": "Comprehensive review covering all Kannada script elements.",
            "chars": [],
            "words": [
                {"w": "ಕರ್ನಾಟಕ", "t": "karnaataka", "m": "Karnataka"},
                {"w": "ಬೆಂಗಳೂರು", "t": "bengaluuru", "m": "Bengaluru"},
                {"w": "ಸಂಸ್ಕೃತಿ", "t": "samskruti", "m": "culture"},
                {"w": "ವಿಶ್ವವಿದ್ಯಾಲಯ", "t": "vishvavidyaalaya", "m": "university"},
            ],
            "skills": ["Complete Kannada script mastery", "Reading any Kannada text", "Confidence in script"],
        },
    ]
}

TELUGU_DATA = {
    "code": "te",
    "name": "Telugu",
    "full_name": "Telugu",
    "unit_id": "te_unit_1",
    "unit_title": "Reading Telugu Script",
    "unit_subtitle": "Master the beautiful Telugu writing system",
    "unit_description": "A 20-lesson course teaching you to read Telugu script. Known as the 'Italian of the East' for its melodious sound, Telugu has a round, flowing script.",
    "lessons": [
        {"num": 1, "slug": "vowels_1", "title": "The First Vowels", "subtitle": "అ, ఆ, ఇ, ఈ", "desc": "Learn the first four Telugu vowels.", "chars": [{"c": "అ", "t": "a", "sound": "a in about", "trick": "Round top — the foundation vowel"}, {"c": "ఆ", "t": "aa", "sound": "a in father", "trick": "అ with a stroke — longer sound"}, {"c": "ఇ", "t": "i", "sound": "i in bit", "trick": "Compact for a short sound"}, {"c": "ఈ", "t": "ii", "sound": "ee in see", "trick": "Extended for a long sound"}], "words": [{"w": "అమ్మ", "t": "amma", "m": "mother"}, {"w": "ఆమె", "t": "aame", "m": "she"}, {"w": "ఇల్లు", "t": "illu", "m": "house"}], "skills": ["Recognize అ ఆ ఇ ఈ", "Short vs long distinction"]},
        {"num": 2, "slug": "vowels_2", "title": "More Vowels", "subtitle": "ఉ, ఊ, ఋ, ఎ, ఏ, ఐ", "desc": "Six more vowels to expand your set.", "chars": [{"c": "ఉ", "t": "u", "sound": "u in put", "trick": "Rounded shape"}, {"c": "ఊ", "t": "uu", "sound": "oo in food", "trick": "Extended ఉ"}, {"c": "ఋ", "t": "ru", "sound": "ri (Sanskrit)", "trick": "Sanskrit vowel"}, {"c": "ఎ", "t": "e", "sound": "e in bed", "trick": "Short e"}, {"c": "ఏ", "t": "ee", "sound": "ay in say", "trick": "Long ee"}, {"c": "ఐ", "t": "ai", "sound": "ai in aisle", "trick": "Diphthong"}], "words": [{"w": "ఊరు", "t": "uuru", "m": "village"}, {"w": "ఎక్కడ", "t": "ekkada", "m": "where"}, {"w": "ఐదు", "t": "aidu", "m": "five"}], "skills": ["Six more vowels", "Sanskrit vowel ఋ"]},
        {"num": 3, "slug": "vowels_3", "title": "Completing Vowels", "subtitle": "ఒ, ఓ, ఔ, అం, అః", "desc": "Finish the vowel set.", "chars": [{"c": "ఒ", "t": "o", "sound": "o in hot", "trick": "Round"}, {"c": "ఓ", "t": "oo", "sound": "o in go", "trick": "Long o"}, {"c": "ఔ", "t": "au", "sound": "ow in how", "trick": "Diphthong"}, {"c": "అం", "t": "am", "sound": "nasal", "trick": "Anusvara"}, {"c": "అః", "t": "aha", "sound": "breathy", "trick": "Visarga"}], "words": [{"w": "ఒకటి", "t": "okati", "m": "one"}, {"w": "ఓడ", "t": "ooda", "m": "ship"}, {"w": "ఔషధం", "t": "aushadham", "m": "medicine"}], "skills": ["Complete vowel set (16 vowels)"]},
        {"num": 4, "slug": "velar_palatal", "title": "Velar & Palatal Consonants", "subtitle": "క, ఖ, గ, ఘ, ఙ and చ, ఛ, జ, ఝ, ఞ", "desc": "The first two consonant rows.", "chars": [{"c": "క", "t": "ka", "sound": "ka", "trick": "First consonant"}, {"c": "ఖ", "t": "kha", "sound": "kha", "trick": "Aspirated k"}, {"c": "గ", "t": "ga", "sound": "ga", "trick": "Voiced k"}, {"c": "చ", "t": "cha", "sound": "cha", "trick": "Palatal"}, {"c": "జ", "t": "ja", "sound": "ja", "trick": "Voiced cha"}], "words": [{"w": "కళ", "t": "kala", "m": "art"}, {"w": "గుడి", "t": "gudi", "m": "temple"}, {"w": "చేప", "t": "cheepa", "m": "fish"}], "skills": ["Velar group", "Palatal group"]},
        {"num": 5, "slug": "retroflex_dental", "title": "Retroflex & Dental Consonants", "subtitle": "ట, ఠ, డ, ఢ, ణ and త, థ, ద, ధ, న", "desc": "Master the retroflex-dental distinction.", "chars": [{"c": "ట", "t": "Ta", "sound": "ta (retroflex)", "trick": "Tongue curls back"}, {"c": "డ", "t": "Da", "sound": "da (retroflex)", "trick": "Voiced retroflex"}, {"c": "ణ", "t": "Na", "sound": "na (retroflex)", "trick": "Retroflex nasal"}, {"c": "త", "t": "tha", "sound": "th (dental)", "trick": "Tongue on teeth"}, {"c": "న", "t": "na", "sound": "na (dental)", "trick": "Dental nasal"}], "words": [{"w": "తెలుగు", "t": "telugu", "m": "Telugu"}, {"w": "నాడు", "t": "naadu", "m": "country"}, {"w": "దేశం", "t": "desham", "m": "country/nation"}], "skills": ["Retroflex consonants", "Dental consonants"]},
        {"num": 6, "slug": "labial_semi", "title": "Labials & Semivowels", "subtitle": "ప, ఫ, బ, భ, మ and య, ర, ల, వ", "desc": "Labials, semivowels, and liquids.", "chars": [{"c": "ప", "t": "pa", "sound": "pa", "trick": "Lips together"}, {"c": "బ", "t": "ba", "sound": "ba", "trick": "Voiced labial"}, {"c": "మ", "t": "ma", "sound": "ma", "trick": "Nasal"}, {"c": "య", "t": "ya", "sound": "ya", "trick": "Semivowel"}, {"c": "ర", "t": "ra", "sound": "ra", "trick": "Liquid"}], "words": [{"w": "పుస్తకం", "t": "pusthakam", "m": "book"}, {"w": "మనిషి", "t": "manishi", "m": "person"}, {"w": "వాన", "t": "vaana", "m": "rain"}], "skills": ["Labials", "Semivowels"]},
        {"num": 7, "slug": "sibilants", "title": "Sibilants & Special Letters", "subtitle": "శ, ష, స, హ, ళ, ఱ", "desc": "Complete the consonant chart.", "chars": [{"c": "శ", "t": "sha", "sound": "sh", "trick": "Palatal sibilant"}, {"c": "ష", "t": "Sha", "sound": "sh (retroflex)", "trick": "Retroflex sibilant"}, {"c": "స", "t": "sa", "sound": "s", "trick": "Dental sibilant"}, {"c": "హ", "t": "ha", "sound": "h", "trick": "Aspirate"}, {"c": "ళ", "t": "La", "sound": "retroflex l", "trick": "Heavy L"}], "words": [{"w": "శాల", "t": "shaala", "m": "hall"}, {"w": "సంఖ్య", "t": "sankhya", "m": "number"}, {"w": "హైదరాబాద్", "t": "haidaraabaad", "m": "Hyderabad"}], "skills": ["Sibilants", "Special letters"]},
        {"num": 8, "slug": "vowel_marks_1", "title": "Vowel Marks — Part 1", "subtitle": "ా, ి, ీ, ు, ూ", "desc": "How vowel marks modify consonants.", "chars": [{"c": "కా", "t": "kaa", "sound": "kaa", "trick": "Stroke for aa"}, {"c": "కి", "t": "ki", "sound": "ki", "trick": "Mark for i"}, {"c": "కీ", "t": "kii", "sound": "kee", "trick": "Mark for ii"}, {"c": "కు", "t": "ku", "sound": "ku", "trick": "Below mark"}, {"c": "కూ", "t": "kuu", "sound": "koo", "trick": "Extended below"}], "words": [{"w": "కాలం", "t": "kaalam", "m": "time"}, {"w": "కీర్తి", "t": "kiirti", "m": "fame"}, {"w": "గూడు", "t": "guudu", "m": "nest"}], "skills": ["First five vowel marks"]},
        {"num": 9, "slug": "vowel_marks_2", "title": "Vowel Marks — Part 2", "subtitle": "ె, ే, ై, ొ, ో, ౌ", "desc": "Complete the vowel mark system.", "chars": [{"c": "కె", "t": "ke", "sound": "ke", "trick": "Short e mark"}, {"c": "కే", "t": "kee", "sound": "kay", "trick": "Long ee mark"}, {"c": "కై", "t": "kai", "sound": "kai", "trick": "Diphthong mark"}, {"c": "కొ", "t": "ko", "sound": "ko", "trick": "Short o mark"}, {"c": "కో", "t": "koo", "sound": "koo", "trick": "Long oo mark"}, {"c": "కౌ", "t": "kau", "sound": "kow", "trick": "Au diphthong"}], "words": [{"w": "కెరటం", "t": "keratam", "m": "wave"}, {"w": "కోట", "t": "koota", "m": "fort"}, {"w": "కై", "t": "kai", "m": "for"}], "skills": ["Complete vowel mark system"]},
        {"num": 10, "slug": "halant", "title": "The Halant (Virama)", "subtitle": "Removing the inherent vowel", "desc": "How the virama works in Telugu.", "chars": [{"c": "క్ vs క", "t": "k vs ka", "sound": "pure k vs ka", "trick": "Small tick = no vowel"}, {"c": "న్ vs న", "t": "n vs na", "sound": "pure n vs na", "trick": "For consonant clusters"}, {"c": "ల్ vs ల", "t": "l vs la", "sound": "pure l vs la", "trick": "Word-final consonants"}], "words": [{"w": "అక్క", "t": "akka", "m": "elder sister"}, {"w": "తెల్ల", "t": "tella", "m": "white"}, {"w": "విద్య", "t": "vidya", "m": "education"}], "skills": ["Virama usage", "Consonant clusters"]},
        {"num": 11, "slug": "conjuncts_1", "title": "Common Conjuncts", "subtitle": "క్క, త్త, న్న, ల్ల, మ్మ", "desc": "Doubled consonant clusters.", "chars": [{"c": "క్క", "t": "kka", "sound": "kka", "trick": "Doubled k"}, {"c": "త్త", "t": "ttha", "sound": "ttha", "trick": "Doubled t"}, {"c": "న్న", "t": "nna", "sound": "nna", "trick": "Doubled n"}, {"c": "ల్ల", "t": "lla", "sound": "lla", "trick": "Doubled l"}, {"c": "మ్మ", "t": "mma", "sound": "mma", "trick": "Doubled m"}], "words": [{"w": "అమ్మ", "t": "amma", "m": "mother"}, {"w": "అక్క", "t": "akka", "m": "sister"}, {"w": "ఎల్లా", "t": "ellaa", "m": "how"}], "skills": ["Geminated consonants"]},
        {"num": 12, "slug": "conjuncts_2", "title": "Nasal & Mixed Clusters", "subtitle": "ంక, ంచ, ండ, ంత, ంప", "desc": "Nasal-stop pairs and mixed clusters.", "chars": [{"c": "ంక", "t": "nka", "sound": "nk", "trick": "Velar pair"}, {"c": "ంచ", "t": "ncha", "sound": "nch", "trick": "Palatal pair"}, {"c": "ండ", "t": "nda", "sound": "nd", "trick": "Retroflex pair"}, {"c": "ంత", "t": "ntha", "sound": "nth", "trick": "Dental pair"}, {"c": "ంప", "t": "mpa", "sound": "mp", "trick": "Labial pair"}], "words": [{"w": "బంగారం", "t": "bangaaram", "m": "gold"}, {"w": "సంతోషం", "t": "santosham", "m": "happiness"}, {"w": "కొండ", "t": "konda", "m": "hill"}], "skills": ["Nasal clusters"]},
        {"num": 13, "slug": "advanced_conjuncts", "title": "Advanced Conjuncts", "subtitle": "క్ష, జ్ఞ, శ్ర, స్త", "desc": "Sanskrit-origin and literary clusters.", "chars": [{"c": "క్ష", "t": "ksha", "sound": "ksh", "trick": "Sanskrit classic"}, {"c": "జ్ఞ", "t": "jnya", "sound": "gnya", "trick": "Common in learned words"}, {"c": "శ్ర", "t": "shra", "sound": "shr", "trick": "In names and titles"}, {"c": "స్త", "t": "stha", "sound": "sth", "trick": "Tatsama words"}], "words": [{"w": "అక్షరం", "t": "aksharam", "m": "letter"}, {"w": "విజ్ఞానం", "t": "vijnyaanam", "m": "science"}, {"w": "శ్రీ", "t": "shrii", "m": "Sri"}], "skills": ["Literary conjuncts"]},
        {"num": 14, "slug": "subscript_forms", "title": "Subscript Consonant Forms", "subtitle": "How consonants stack in Telugu", "desc": "Telugu uses subscript forms for consonant clusters.", "chars": [{"c": "క + ్ + ర = క్ర", "t": "kra", "sound": "kra", "trick": "Ra subscript — very common"}, {"c": "ప + ్ + ర = ప్ర", "t": "pra", "sound": "pra", "trick": "Ra goes below"}, {"c": "స + ్ + య = స్య", "t": "sya", "sound": "sya", "trick": "Ya subscript"}], "words": [{"w": "ప్రపంచం", "t": "prapancham", "m": "world"}, {"w": "క్రమం", "t": "kramam", "m": "order"}, {"w": "విద్యార్థి", "t": "vidyaarthi", "m": "student"}], "skills": ["Subscript forms", "Ra and Ya subscripts"]},
        {"num": 15, "slug": "reading_words", "title": "Reading Real Words", "subtitle": "Common vocabulary", "desc": "Practice reading everyday Telugu words.", "chars": [], "words": [{"w": "నమస్కారం", "t": "namaskaaram", "m": "greetings"}, {"w": "ధన్యవాదాలు", "t": "dhanyavaadaalu", "m": "thank you"}, {"w": "నీళ్ళు", "t": "niillu", "m": "water"}, {"w": "భోజనం", "t": "bhojanam", "m": "food"}, {"w": "బడి", "t": "badi", "m": "school"}], "skills": ["Common words"]},
        {"num": 16, "slug": "numbers", "title": "Telugu Numerals", "subtitle": "౧ ౨ ౩ ౪ ౫ ౬ ౭ ౮ ౯ ౦", "desc": "Telugu numeral symbols and words.", "chars": [{"c": "౧", "t": "1", "sound": "okati", "trick": "One"}, {"c": "౨", "t": "2", "sound": "rendu", "trick": "Two"}, {"c": "౩", "t": "3", "sound": "muudu", "trick": "Three"}, {"c": "౪", "t": "4", "sound": "naalugu", "trick": "Four"}, {"c": "౫", "t": "5", "sound": "aidu", "trick": "Five"}], "words": [{"w": "ఒకటి", "t": "okati", "m": "one"}, {"w": "రెండు", "t": "rendu", "m": "two"}, {"w": "పది", "t": "padi", "m": "ten"}], "skills": ["Telugu numerals"]},
        {"num": 17, "slug": "signage", "title": "Reading Signs & Labels", "subtitle": "Real-world Telugu", "desc": "Practice environmental reading.", "chars": [], "words": [{"w": "దుకాణం", "t": "dukanam", "m": "shop"}, {"w": "ఆసుపత్రి", "t": "aasupathri", "m": "hospital"}, {"w": "బస్ స్టాండ్", "t": "bas staand", "m": "bus stand"}, {"w": "రైల్వే స్టేషన్", "t": "railway station", "m": "railway station"}], "skills": ["Environmental reading"]},
        {"num": 18, "slug": "loanwords", "title": "Loanwords in Telugu", "subtitle": "English and Sanskrit borrowings", "desc": "Reading modern and borrowed vocabulary.", "chars": [], "words": [{"w": "బస్సు", "t": "bassu", "m": "bus"}, {"w": "టికెట్", "t": "tiket", "m": "ticket"}, {"w": "ఫోన్", "t": "phoon", "m": "phone"}, {"w": "కంప్యూటర్", "t": "kampyuutar", "m": "computer"}], "skills": ["Loanword reading"]},
        {"num": 19, "slug": "sentences", "title": "Reading Sentences", "subtitle": "Full sentence practice", "desc": "Read complete Telugu sentences.", "chars": [], "words": [{"w": "నేను తెలుగు నేర్చుకుంటున్నాను", "t": "neenu telugu neerchukuntunnaanu", "m": "I am learning Telugu"}, {"w": "ఇది నా పుస్తకం", "t": "idi naa pusthakam", "m": "This is my book"}, {"w": "మీ పేరు ఏమిటి?", "t": "mii peeru eemiti?", "m": "What is your name?"}], "skills": ["Sentence reading"]},
        {"num": 20, "slug": "final_review", "title": "Final Review", "subtitle": "Telugu reading mastery!", "desc": "Comprehensive review.", "chars": [], "words": [{"w": "ఆంధ్రప్రదేశ్", "t": "aandhrapradesh", "m": "Andhra Pradesh"}, {"w": "తెలంగాణ", "t": "telangaana", "m": "Telangana"}, {"w": "హైదరాబాద్", "t": "haidaraabaad", "m": "Hyderabad"}, {"w": "సంస్కృతి", "t": "samskruti", "m": "culture"}], "skills": ["Complete Telugu mastery"]},
    ]
}

HINDI_DATA = {
    "code": "hi",
    "name": "Hindi",
    "full_name": "Hindi",
    "unit_id": "hi_unit_1",
    "unit_title": "Reading Devanagari Script",
    "unit_subtitle": "Master Hindi's Devanagari writing system",
    "unit_description": "An 18-lesson course teaching you to read Devanagari script for Hindi. From vowels through consonants, matras, conjuncts, and real-world reading.",
    "lessons": [
        {"num": 1, "slug": "vowels_1", "title": "The First Vowels", "subtitle": "अ, आ, इ, ई", "desc": "The foundation of Devanagari — first four vowels.", "chars": [{"c": "अ", "t": "a", "sound": "a in about", "trick": "The line on top (shirorekha) is the hallmark of Devanagari"}, {"c": "आ", "t": "aa", "sound": "a in father", "trick": "अ with a stroke — longer sound"}, {"c": "इ", "t": "i", "sound": "i in bit", "trick": "Compact shape"}, {"c": "ई", "t": "ii", "sound": "ee in see", "trick": "Extended form"}], "words": [{"w": "अब", "t": "ab", "m": "now"}, {"w": "आम", "t": "aam", "m": "mango"}, {"w": "इस", "t": "is", "m": "this"}], "skills": ["First 4 Devanagari vowels", "The shirorekha (headline)"]},
        {"num": 2, "slug": "vowels_2", "title": "More Vowels", "subtitle": "उ, ऊ, ए, ऐ", "desc": "Continue with u and e vowels.", "chars": [{"c": "उ", "t": "u", "sound": "u in put", "trick": "Hook shape"}, {"c": "ऊ", "t": "uu", "sound": "oo in food", "trick": "Extended hook"}, {"c": "ए", "t": "e", "sound": "ay in say", "trick": "Open shape"}, {"c": "ऐ", "t": "ai", "sound": "ai in aisle", "trick": "Extra stroke"}], "words": [{"w": "उस", "t": "us", "m": "that"}, {"w": "एक", "t": "ek", "m": "one"}, {"w": "ऐसा", "t": "aisaa", "m": "such"}], "skills": ["u, uu, e, ai vowels"]},
        {"num": 3, "slug": "vowels_3", "title": "Completing Vowels", "subtitle": "ओ, औ, अं, अः, ऋ", "desc": "Finish the vowel set.", "chars": [{"c": "ओ", "t": "o", "sound": "o in go", "trick": "Combination shape"}, {"c": "औ", "t": "au", "sound": "ow in how", "trick": "Wide diphthong"}, {"c": "अं", "t": "am", "sound": "nasal dot", "trick": "Anusvara"}, {"c": "अः", "t": "aha", "sound": "breathy", "trick": "Visarga"}, {"c": "ऋ", "t": "ri", "sound": "ri (Sanskrit)", "trick": "Sanskrit vowel"}], "words": [{"w": "और", "t": "aur", "m": "and"}, {"w": "ओर", "t": "or", "m": "towards"}, {"w": "ऋतु", "t": "ritu", "m": "season"}], "skills": ["Complete vowel set"]},
        {"num": 4, "slug": "ka_group", "title": "The Ka-Group (Velars)", "subtitle": "क, ख, ग, घ, ङ", "desc": "First consonant group — produced at the back of the mouth.", "chars": [{"c": "क", "t": "ka", "sound": "ka", "trick": "First consonant — like a vertical line with curve"}, {"c": "ख", "t": "kha", "sound": "kha (aspirated)", "trick": "k + puff of air"}, {"c": "ग", "t": "ga", "sound": "ga", "trick": "Voiced k"}, {"c": "घ", "t": "gha", "sound": "gha (aspirated g)", "trick": "Voiced + aspirated"}, {"c": "ङ", "t": "nga", "sound": "ng in sing", "trick": "Rare — mainly in clusters"}], "words": [{"w": "कल", "t": "kal", "m": "yesterday/tomorrow"}, {"w": "खाना", "t": "khaanaa", "m": "food"}, {"w": "गाना", "t": "gaanaa", "m": "song"}], "skills": ["Velar consonants", "Aspiration"]},
        {"num": 5, "slug": "cha_group", "title": "The Cha-Group (Palatals)", "subtitle": "च, छ, ज, झ, ञ", "desc": "Palatal consonants — produced at the hard palate.", "chars": [{"c": "च", "t": "cha", "sound": "cha in chair", "trick": "Palatal stop"}, {"c": "छ", "t": "chha", "sound": "chha (aspirated)", "trick": "ch + puff"}, {"c": "ज", "t": "ja", "sound": "ja in jar", "trick": "Voiced ch"}, {"c": "झ", "t": "jha", "sound": "jha", "trick": "Voiced + aspirated"}, {"c": "ञ", "t": "nya", "sound": "ny as in canyon", "trick": "Rare standalone"}], "words": [{"w": "चाय", "t": "chaay", "m": "tea"}, {"w": "जल", "t": "jal", "m": "water"}, {"w": "झूला", "t": "jhoolaa", "m": "swing"}], "skills": ["Palatal consonants"]},
        {"num": 6, "slug": "ta_group", "title": "The Ta-Group (Retroflexes)", "subtitle": "ट, ठ, ड, ढ, ण", "desc": "Retroflex consonants — tongue curls back.", "chars": [{"c": "ट", "t": "Ta", "sound": "ta (retroflex)", "trick": "Tongue curls to palate"}, {"c": "ठ", "t": "Tha", "sound": "tha (retroflex asp.)", "trick": "Aspirated retroflex"}, {"c": "ड", "t": "Da", "sound": "da (retroflex)", "trick": "Voiced retroflex"}, {"c": "ढ", "t": "Dha", "sound": "dha (retroflex asp.)", "trick": "Voiced + aspirated"}, {"c": "ण", "t": "Na", "sound": "na (retroflex)", "trick": "Retroflex nasal"}], "words": [{"w": "टमाटर", "t": "tamaatar", "m": "tomato"}, {"w": "डर", "t": "dar", "m": "fear"}, {"w": "बाण", "t": "baan", "m": "arrow"}], "skills": ["Retroflex consonants"]},
        {"num": 7, "slug": "tha_group", "title": "The Tha-Group (Dentals)", "subtitle": "त, थ, द, ध, न", "desc": "Dental consonants — tongue touches teeth.", "chars": [{"c": "त", "t": "ta", "sound": "th (dental, soft)", "trick": "Softer than English 't'"}, {"c": "थ", "t": "tha", "sound": "th (dental asp.)", "trick": "Dental + aspirated"}, {"c": "द", "t": "da", "sound": "d (dental)", "trick": "Voiced dental"}, {"c": "ध", "t": "dha", "sound": "dh (dental asp.)", "trick": "Voiced + aspirated"}, {"c": "न", "t": "na", "sound": "na (dental)", "trick": "Dental nasal — common 'n'"}], "words": [{"w": "दिन", "t": "din", "m": "day"}, {"w": "धन", "t": "dhan", "m": "wealth"}, {"w": "नमस्ते", "t": "namaste", "m": "hello"}], "skills": ["Dental consonants", "Dental vs retroflex"]},
        {"num": 8, "slug": "pa_group", "title": "The Pa-Group (Labials)", "subtitle": "प, फ, ब, भ, म", "desc": "Labial consonants — produced with the lips.", "chars": [{"c": "प", "t": "pa", "sound": "pa", "trick": "Lips together"}, {"c": "फ", "t": "pha", "sound": "pha / fa", "trick": "Also used for 'f' sound"}, {"c": "ब", "t": "ba", "sound": "ba", "trick": "Voiced labial"}, {"c": "भ", "t": "bha", "sound": "bha", "trick": "Voiced + aspirated"}, {"c": "म", "t": "ma", "sound": "ma", "trick": "Nasal — lips together"}], "words": [{"w": "पानी", "t": "paanii", "m": "water"}, {"w": "फल", "t": "phal", "m": "fruit"}, {"w": "भारत", "t": "bhaarat", "m": "India"}], "skills": ["Labial consonants"]},
        {"num": 9, "slug": "semivowels_sibilants", "title": "Semivowels & Sibilants", "subtitle": "य, र, ल, व, श, ष, स, ह", "desc": "Complete the consonant chart.", "chars": [{"c": "य", "t": "ya", "sound": "ya", "trick": "Semivowel"}, {"c": "र", "t": "ra", "sound": "ra", "trick": "Liquid r"}, {"c": "ल", "t": "la", "sound": "la", "trick": "Lateral l"}, {"c": "व", "t": "va/wa", "sound": "va or wa", "trick": "Context dependent"}, {"c": "श", "t": "sha", "sound": "sh", "trick": "Palatal sibilant"}, {"c": "ष", "t": "Sha", "sound": "sh (retroflex)", "trick": "Retroflex sibilant"}, {"c": "स", "t": "sa", "sound": "s", "trick": "Dental sibilant"}, {"c": "ह", "t": "ha", "sound": "h", "trick": "Aspirate"}], "words": [{"w": "याद", "t": "yaad", "m": "memory"}, {"w": "शहर", "t": "shahar", "m": "city"}, {"w": "हम", "t": "ham", "m": "we"}], "skills": ["All 33 consonants complete"]},
        {"num": 10, "slug": "nuqta_letters", "title": "Nuqta Letters — Urdu-Origin Sounds", "subtitle": "क़, ख़, ग़, ज़, ड़, ढ़, फ़", "desc": "Learn the dotted letters for sounds borrowed from Persian/Arabic.", "chars": [{"c": "क़", "t": "qa", "sound": "q (deep throat)", "trick": "Dot below = Urdu/Persian sound"}, {"c": "ख़", "t": "kha", "sound": "kh (guttural)", "trick": "Like Scottish 'loch'"}, {"c": "ग़", "t": "gha", "sound": "gh (guttural)", "trick": "Voiced guttural"}, {"c": "ज़", "t": "za", "sound": "z in zoo", "trick": "Common in everyday Hindi"}, {"c": "फ़", "t": "fa", "sound": "f in fun", "trick": "The 'f' sound in Hindi"}], "words": [{"w": "ज़रूरी", "t": "zaruuri", "m": "necessary"}, {"w": "फ़ोन", "t": "fon", "m": "phone"}, {"w": "क़ीमत", "t": "qiimat", "m": "price"}], "skills": ["Nuqta letters", "Persian/Arabic borrowed sounds"]},
        {"num": 11, "slug": "matras_1", "title": "Matras (Vowel Signs) — Part 1", "subtitle": "ा, ि, ी, ु, ू", "desc": "How vowel marks change consonant sounds.", "chars": [{"c": "का", "t": "kaa", "sound": "kaa", "trick": "Vertical stroke after = aa"}, {"c": "कि", "t": "ki", "sound": "ki", "trick": "Hook before = short i"}, {"c": "की", "t": "kii", "sound": "kee", "trick": "Line after = long ii"}, {"c": "कु", "t": "ku", "sound": "ku", "trick": "Hook below = u"}, {"c": "कू", "t": "kuu", "sound": "koo", "trick": "Extended hook below = uu"}], "words": [{"w": "काम", "t": "kaam", "m": "work"}, {"w": "किताब", "t": "kitaab", "m": "book"}, {"w": "कूल", "t": "kuul", "m": "cool"}], "skills": ["First five matras"]},
        {"num": 12, "slug": "matras_2", "title": "Matras — Part 2", "subtitle": "े, ै, ो, ौ, ृ", "desc": "Complete the matra system.", "chars": [{"c": "के", "t": "ke", "sound": "kay", "trick": "Stroke above = e"}, {"c": "कै", "t": "kai", "sound": "kai", "trick": "Double stroke above = ai"}, {"c": "को", "t": "ko", "sound": "ko", "trick": "Stroke above + after = o"}, {"c": "कौ", "t": "kau", "sound": "kow", "trick": "Double above + after = au"}, {"c": "कृ", "t": "kri", "sound": "kri", "trick": "Small hook below = ri"}], "words": [{"w": "केला", "t": "kelaa", "m": "banana"}, {"w": "कौन", "t": "kaun", "m": "who"}, {"w": "कृपा", "t": "kripaa", "m": "grace"}], "skills": ["Complete matra system"]},
        {"num": 13, "slug": "halant_conjuncts", "title": "The Halant & Conjuncts", "subtitle": "How consonants join in Devanagari", "desc": "Learn the halant and common consonant conjuncts.", "chars": [{"c": "क् + क = क्क", "t": "kka", "sound": "kka", "trick": "Halant joins consonants"}, {"c": "प् + र = प्र", "t": "pra", "sound": "pra", "trick": "Ra joins as a hook below"}, {"c": "त् + र = त्र", "t": "tra", "sound": "tra", "trick": "Special tra form"}, {"c": "श् + र = श्र", "t": "shra", "sound": "shr", "trick": "Common in names"}], "words": [{"w": "प्रश्न", "t": "prashn", "m": "question"}, {"w": "विद्या", "t": "vidyaa", "m": "knowledge"}, {"w": "श्री", "t": "shrii", "m": "Sri/Mr."}], "skills": ["Halant usage", "Common conjuncts"]},
        {"num": 14, "slug": "more_conjuncts", "title": "More Conjuncts & Special Forms", "subtitle": "क्ष, त्र, ज्ञ, द्ध, ट्ट", "desc": "Important special conjunct forms.", "chars": [{"c": "क्ष", "t": "ksha", "sound": "ksh", "trick": "Classic conjunct"}, {"c": "त्र", "t": "tra", "sound": "tr", "trick": "Has a special form"}, {"c": "ज्ञ", "t": "gya/jnya", "sound": "gya", "trick": "Pronounced 'gya' in Hindi"}, {"c": "द्ध", "t": "ddha", "sound": "ddh", "trick": "Common in words like बुद्ध"}], "words": [{"w": "अक्षर", "t": "akshar", "m": "letter"}, {"w": "ज्ञान", "t": "gyaan", "m": "knowledge"}, {"w": "बुद्ध", "t": "buddh", "m": "Buddha"}], "skills": ["Special conjuncts", "Reading literary Hindi"]},
        {"num": 15, "slug": "reading_words", "title": "Reading Real Words", "subtitle": "Common Hindi vocabulary", "desc": "Practice reading everyday Hindi words.", "chars": [], "words": [{"w": "नमस्ते", "t": "namaste", "m": "hello"}, {"w": "धन्यवाद", "t": "dhanyavaad", "m": "thank you"}, {"w": "पानी", "t": "paanii", "m": "water"}, {"w": "खाना", "t": "khaanaa", "m": "food"}, {"w": "किताब", "t": "kitaab", "m": "book"}, {"w": "स्कूल", "t": "skuul", "m": "school"}], "skills": ["Common vocabulary"]},
        {"num": 16, "slug": "numbers", "title": "Hindi Numerals", "subtitle": "१ २ ३ ४ ५ ६ ७ ८ ९ ०", "desc": "Devanagari numeral symbols.", "chars": [{"c": "१", "t": "1", "sound": "ek", "trick": "One"}, {"c": "२", "t": "2", "sound": "do", "trick": "Two"}, {"c": "३", "t": "3", "sound": "tiin", "trick": "Three"}, {"c": "४", "t": "4", "sound": "chaar", "trick": "Four"}, {"c": "५", "t": "5", "sound": "paanch", "trick": "Five"}], "words": [{"w": "एक", "t": "ek", "m": "one"}, {"w": "दो", "t": "do", "m": "two"}, {"w": "दस", "t": "das", "m": "ten"}], "skills": ["Devanagari numerals"]},
        {"num": 17, "slug": "sentences", "title": "Reading Sentences", "subtitle": "Full sentence practice", "desc": "Read complete Hindi sentences.", "chars": [], "words": [{"w": "मैं हिंदी सीख रहा हूँ", "t": "main hindii siikh rahaa huun", "m": "I am learning Hindi"}, {"w": "यह मेरी किताब है", "t": "yah merii kitaab hai", "m": "This is my book"}, {"w": "आपका नाम क्या है?", "t": "aapkaa naam kyaa hai?", "m": "What is your name?"}], "skills": ["Sentence reading"]},
        {"num": 18, "slug": "final_review", "title": "Final Review", "subtitle": "Devanagari mastery!", "desc": "Comprehensive review.", "chars": [], "words": [{"w": "भारत", "t": "bhaarat", "m": "India"}, {"w": "हिन्दुस्तान", "t": "hindustaan", "m": "Hindustan"}, {"w": "दिल्ली", "t": "dillii", "m": "Delhi"}, {"w": "स्वागत है", "t": "swaagat hai", "m": "welcome"}], "skills": ["Complete Devanagari mastery"]},
    ]
}

URDU_DATA = {
    "code": "ur",
    "name": "Urdu",
    "full_name": "Urdu",
    "unit_id": "ur_unit_1",
    "unit_title": "Reading Urdu Script",
    "unit_subtitle": "Master the Nastaliq/Naskh script from right to left",
    "unit_description": "A 20-lesson course teaching you to read Urdu's modified Arabic script. Learn letter forms, connections, dots, and diacritics to read Urdu text confidently.",
    "lessons": [
        {"num": 1, "slug": "intro_alif_bay", "title": "Introduction & First Letters", "subtitle": "ا (alif), ب (bay), پ (pay), ت (tay)", "desc": "Learn the basics of Urdu script: right-to-left, connected letters, and your first four.", "chars": [{"c": "ا", "t": "alif", "sound": "a / aa", "trick": "A simple vertical stroke — the foundation. It doesn't connect to the left."}, {"c": "ب", "t": "bay", "sound": "b", "trick": "A boat shape with ONE dot below"}, {"c": "پ", "t": "pay", "sound": "p", "trick": "Same boat, THREE dots below — Urdu-specific!"}, {"c": "ت", "t": "tay", "sound": "t", "trick": "Same boat, TWO dots ABOVE"}], "words": [{"w": "اب", "t": "ab", "m": "now"}, {"w": "آپ", "t": "aap", "m": "you (formal)"}, {"w": "بات", "t": "baat", "m": "talk/thing"}], "skills": ["Right-to-left reading", "Letter connection basics", "Dot-counting for ب پ ت"]},
        {"num": 2, "slug": "say_jim_group", "title": "The Say & Jim Groups", "subtitle": "ث (say), ج (jiim), چ (chay), ح (hay), خ (khay)", "desc": "More letters with the important dot/shape distinctions.", "chars": [{"c": "ث", "t": "say", "sound": "s/th", "trick": "Boat + THREE dots above"}, {"c": "ج", "t": "jiim", "sound": "j", "trick": "Cup shape, ONE dot below"}, {"c": "چ", "t": "chay", "sound": "ch", "trick": "Cup + THREE dots below — Urdu!"}, {"c": "ح", "t": "hay", "sound": "h (breathy)", "trick": "Cup with NO dots"}, {"c": "خ", "t": "khay", "sound": "kh (guttural)", "trick": "Cup + ONE dot above"}], "words": [{"w": "چاچا", "t": "chaachaa", "m": "uncle"}, {"w": "حال", "t": "haal", "m": "condition"}, {"w": "جب", "t": "jab", "m": "when"}], "skills": ["Jim-group letters", "Dot-based distinctions"]},
        {"num": 3, "slug": "daal_zaal", "title": "Non-Connecting Letters", "subtitle": "د (daal), ذ (zaal), ر (ray), ڑ (array), ز (zay), ژ (zhay)", "desc": "Letters that don't connect to the next letter.", "chars": [{"c": "د", "t": "daal", "sound": "d", "trick": "Triangular — doesn't connect left"}, {"c": "ذ", "t": "zaal", "sound": "z/dh", "trick": "د + dot above"}, {"c": "ر", "t": "ray", "sound": "r", "trick": "A dipping stroke"}, {"c": "ڑ", "t": "array", "sound": "rd (retroflex)", "trick": "ر + small taa — Urdu specific"}, {"c": "ز", "t": "zay", "sound": "z", "trick": "ر + dot above"}, {"c": "ژ", "t": "zhay", "sound": "zh", "trick": "ر + three dots — rare"}], "words": [{"w": "در", "t": "dar", "m": "door"}, {"w": "روز", "t": "roz", "m": "day"}, {"w": "بڑا", "t": "baraa", "m": "big"}], "skills": ["Non-connecting letters", "Retroflex ڑ"]},
        {"num": 4, "slug": "siin_shiin", "title": "The Siin & Shiin Group", "subtitle": "س (siin), ش (shiin), ص (suaad), ض (zuaad)", "desc": "Sibilants and emphatic letters.", "chars": [{"c": "س", "t": "siin", "sound": "s", "trick": "Three teeth — like a wave"}, {"c": "ش", "t": "shiin", "sound": "sh", "trick": "Three teeth + three dots above"}, {"c": "ص", "t": "suaad", "sound": "s (emphatic)", "trick": "Looped shape — Arabic emphatic"}, {"c": "ض", "t": "zuaad", "sound": "z (emphatic)", "trick": "ص + dot above"}], "words": [{"w": "سب", "t": "sab", "m": "all"}, {"w": "شام", "t": "shaam", "m": "evening"}, {"w": "صبح", "t": "subah", "m": "morning"}], "skills": ["Sibilant letters", "Emphatic consonants"]},
        {"num": 5, "slug": "toy_zoy_ain", "title": "Emphatics & Ain Group", "subtitle": "ط (toy), ظ (zoy), ع (ain), غ (ghain)", "desc": "Arabic-origin emphatic and guttural letters.", "chars": [{"c": "ط", "t": "toy", "sound": "t (emphatic)", "trick": "Tall looped letter"}, {"c": "ظ", "t": "zoy", "sound": "z (emphatic)", "trick": "ط + dot above"}, {"c": "ع", "t": "ain", "sound": "a (guttural)", "trick": "Unique guttural vowel carrier"}, {"c": "غ", "t": "ghain", "sound": "gh (guttural)", "trick": "ع + dot above"}], "words": [{"w": "طالب", "t": "taalib", "m": "student"}, {"w": "عمر", "t": "umar", "m": "age"}, {"w": "غلط", "t": "ghalat", "m": "wrong"}], "skills": ["Emphatic letters", "Ain and Ghain"]},
        {"num": 6, "slug": "fay_qaaf", "title": "Fay & Qaaf Group", "subtitle": "ف (fay), ق (qaaf), ک (kaaf), گ (gaaf)", "desc": "Labio-dental and velar letters, including Urdu-specific forms.", "chars": [{"c": "ف", "t": "fay", "sound": "f", "trick": "Loop with dot above"}, {"c": "ق", "t": "qaaf", "sound": "q (deep throat)", "trick": "Two dots above — deep guttural"}, {"c": "ک", "t": "kaaf", "sound": "k", "trick": "Urdu form — different from Arabic ك"}, {"c": "گ", "t": "gaaf", "sound": "g", "trick": "ک + extra stroke — Urdu specific!"}], "words": [{"w": "فکر", "t": "fikr", "m": "thought/worry"}, {"w": "قلم", "t": "qalam", "m": "pen"}, {"w": "کام", "t": "kaam", "m": "work"}, {"w": "گھر", "t": "ghar", "m": "home"}], "skills": ["Fay, Qaaf group", "Urdu-specific ک and گ"]},
        {"num": 7, "slug": "laam_miim_nuun", "title": "Laam, Miim, Nuun", "subtitle": "ل (laam), م (miim), ن (nuun), ں (nuun ghunna)", "desc": "Common everyday letters including Urdu's nasal nuun.", "chars": [{"c": "ل", "t": "laam", "sound": "l", "trick": "Tall stroke that leans"}, {"c": "م", "t": "miim", "sound": "m", "trick": "Round loop"}, {"c": "ن", "t": "nuun", "sound": "n", "trick": "Cup with dot above"}, {"c": "ں", "t": "nuun ghunna", "sound": "nasal n (no dot)", "trick": "Nasalization marker — Urdu specific!"}], "words": [{"w": "لکھنا", "t": "likhnaa", "m": "to write"}, {"w": "من", "t": "man", "m": "mind"}, {"w": "نام", "t": "naam", "m": "name"}, {"w": "میں", "t": "mein", "m": "in/I"}], "skills": ["Common consonants", "Nasal nuun ں"]},
        {"num": 8, "slug": "waao_hay_yay", "title": "Waao, Hay, Yay", "subtitle": "و (waao), ہ/ھ (hay), ی (yay), ے (baree yay)", "desc": "The final core letters, including important Urdu-specific forms.", "chars": [{"c": "و", "t": "waao", "sound": "w / oo / o", "trick": "Multi-purpose: consonant w, vowel oo/o"}, {"c": "ہ", "t": "hay", "sound": "h", "trick": "Urdu hay — different initial/medial/final forms"}, {"c": "ھ", "t": "do-chashmii hay", "sound": "aspiration", "trick": "Adds aspiration to preceding letter (بھ = bh)"}, {"c": "ی", "t": "yay", "sound": "y / ii / i", "trick": "Multi-purpose: consonant y, vowel ii/i"}, {"c": "ے", "t": "baree yay", "sound": "ay / e", "trick": "Large yay — only at word end"}], "words": [{"w": "ہم", "t": "ham", "m": "we"}, {"w": "یہ", "t": "yeh", "m": "this"}, {"w": "وہ", "t": "woh", "m": "that"}, {"w": "ہے", "t": "hai", "m": "is"}], "skills": ["Final core letters", "Do-chashmii hay (aspiration)"]},
        {"num": 9, "slug": "letter_forms", "title": "Letter Position Forms", "subtitle": "Initial, medial, and final shapes", "desc": "Understand how letters change shape based on position in a word.", "chars": [{"c": "ب: بـ ـبـ ـب", "t": "bay forms", "sound": "b", "trick": "Initial: بـ (tooth+dot), Medial: ـبـ, Final: ـب"}, {"c": "ج: جـ ـجـ ـج", "t": "jiim forms", "sound": "j", "trick": "Initial: جـ, Medial: ـجـ, Final: ـج (full shape)"}, {"c": "ک: کـ ـکـ ـک", "t": "kaaf forms", "sound": "k", "trick": "Changes significantly by position"}], "words": [{"w": "بچپن", "t": "bachpan", "m": "childhood"}, {"w": "کتاب", "t": "kitaab", "m": "book"}], "skills": ["Positional letter forms", "Reading connected text"]},
        {"num": 10, "slug": "short_vowels", "title": "Short Vowels (Diacritics)", "subtitle": "زبر (zabar), زیر (zer), پیش (pesh)", "desc": "Learn the short vowel marks that are often omitted in printed Urdu.", "chars": [{"c": "بَ", "t": "ba", "sound": "ba (zabar = a above)", "trick": "Small diagonal stroke above = 'a'"}, {"c": "بِ", "t": "bi", "sound": "bi (zer = i below)", "trick": "Small stroke below = 'i'"}, {"c": "بُ", "t": "bu", "sound": "bu (pesh = u above)", "trick": "Small waao-like mark above = 'u'"}], "words": [{"w": "کِتاب", "t": "kitaab", "m": "book (with zer on ک)"}, {"w": "سُنا", "t": "sunaa", "m": "heard (with pesh on س)"}, {"w": "بَس", "t": "bas", "m": "enough (with zabar on ب)"}], "skills": ["Three short vowel marks", "Reading with diacritics"]},
        {"num": 11, "slug": "long_vowels", "title": "Long Vowels", "subtitle": "Using ا و ی for long sounds", "desc": "How alif, waao, and yay serve as long vowel carriers.", "chars": [{"c": "ا = aa", "t": "aa", "sound": "long a", "trick": "Alif after consonant = 'aa'"}, {"c": "و = oo/o", "t": "oo", "sound": "long u or o", "trick": "Waao = 'oo' or 'o'"}, {"c": "ی = ii/ee", "t": "ii", "sound": "long i", "trick": "Yay = 'ii' or 'ee'"}, {"c": "آ = initial aa", "t": "aa", "sound": "aa at word start", "trick": "Alif with madda = initial 'aa'"}], "words": [{"w": "آنا", "t": "aanaa", "m": "to come"}, {"w": "جانا", "t": "jaanaa", "m": "to go"}, {"w": "بولنا", "t": "bolnaa", "m": "to speak"}], "skills": ["Long vowel reading", "Alif madda"]},
        {"num": 12, "slug": "aspiration", "title": "Aspirated Consonants", "subtitle": "بھ (bh), پھ (ph), تھ (th), جھ (jh), چھ (chh), دھ (dh), ڈھ (dh), کھ (kh), گھ (gh)", "desc": "Learn how do-chashmii hay creates aspirated sounds — critical for Urdu.", "chars": [{"c": "بھ", "t": "bh", "sound": "bh", "trick": "ب + ھ = aspirated b"}, {"c": "پھ", "t": "ph", "sound": "ph", "trick": "پ + ھ = aspirated p"}, {"c": "تھ", "t": "th", "sound": "th (dental asp.)", "trick": "ت + ھ = dental aspirated"}, {"c": "کھ", "t": "kh", "sound": "kh", "trick": "ک + ھ = aspirated k"}, {"c": "گھ", "t": "gh", "sound": "gh", "trick": "گ + ھ = aspirated g"}], "words": [{"w": "بھائی", "t": "bhaaii", "m": "brother"}, {"w": "پھول", "t": "phool", "m": "flower"}, {"w": "گھر", "t": "ghar", "m": "home"}, {"w": "کھانا", "t": "khaanaa", "m": "food"}], "skills": ["Aspiration with do-chashmii hay", "Reading aspirated pairs"]},
        {"num": 13, "slug": "special_marks", "title": "Special Marks & Symbols", "subtitle": "تشدید (shadda), جزم (jazm), ہمزہ (hamza)", "desc": "Learn the special marks used in Urdu.", "chars": [{"c": "تشدید (ّ)", "t": "shadda", "sound": "doubles the letter", "trick": "Small w-shape above = double the consonant"}, {"c": "جزم (ْ)", "t": "jazm/sukun", "sound": "no vowel", "trick": "Small circle above = consonant has no vowel"}, {"c": "ہمزہ (ء)", "t": "hamza", "sound": "glottal stop", "trick": "A catch in the throat"}], "words": [{"w": "اللہ", "t": "allaah", "m": "God (shadda on ل)"}, {"w": "مؤمن", "t": "momin", "m": "believer (hamza on و)"}], "skills": ["Shadda, Jazm, Hamza"]},
        {"num": 14, "slug": "common_ligatures", "title": "Common Ligatures", "subtitle": "لا (laam-alif) and other standard joins", "desc": "Learn the mandatory ligatures and common beautiful letter joins in Nastaliq.", "chars": [{"c": "لا", "t": "laa", "sound": "laa", "trick": "Laam + alif ALWAYS form this ligature"}, {"c": "للہ", "t": "llah", "sound": "llah", "trick": "Double laam + hay — in 'Allah'"}, {"c": "بسم", "t": "bism", "sound": "bism", "trick": "Common in Bismillah"}], "words": [{"w": "لا", "t": "laa", "m": "no"}, {"w": "الله", "t": "allaah", "m": "God"}, {"w": "بسم الله", "t": "bismillaah", "m": "in the name of God"}], "skills": ["Laam-alif ligature", "Reading standard joins"]},
        {"num": 15, "slug": "reading_words", "title": "Reading Real Words", "subtitle": "Common Urdu vocabulary", "desc": "Practice reading everyday Urdu words.", "chars": [], "words": [{"w": "سلام", "t": "salaam", "m": "peace/greeting"}, {"w": "شکریہ", "t": "shukriya", "m": "thank you"}, {"w": "پانی", "t": "paanii", "m": "water"}, {"w": "کتاب", "t": "kitaab", "m": "book"}, {"w": "سکول", "t": "skool", "m": "school"}, {"w": "دوست", "t": "dost", "m": "friend"}], "skills": ["Common vocabulary"]},
        {"num": 16, "slug": "numbers", "title": "Urdu Numerals", "subtitle": "۱ ۲ ۳ ۴ ۵ ۶ ۷ ۸ ۹ ۰", "desc": "Eastern Arabic-Indic numerals used in Urdu.", "chars": [{"c": "۱", "t": "1", "sound": "ek", "trick": "One"}, {"c": "۲", "t": "2", "sound": "do", "trick": "Two"}, {"c": "۳", "t": "3", "sound": "tiin", "trick": "Three"}, {"c": "۴", "t": "4", "sound": "chaar", "trick": "Four"}, {"c": "۵", "t": "5", "sound": "paanch", "trick": "Five"}], "words": [{"w": "ایک", "t": "ek", "m": "one"}, {"w": "دو", "t": "do", "m": "two"}, {"w": "دس", "t": "das", "m": "ten"}], "skills": ["Urdu numerals"]},
        {"num": 17, "slug": "without_diacritics", "title": "Reading Without Diacritics", "subtitle": "How Urdu is actually printed", "desc": "Learn to read Urdu as it normally appears — without short vowel marks.", "chars": [], "words": [{"w": "پاکستان", "t": "paakistaan", "m": "Pakistan"}, {"w": "لاہور", "t": "laahoor", "m": "Lahore"}, {"w": "اسلام آباد", "t": "islaam aabaad", "m": "Islamabad"}, {"w": "کراچی", "t": "karaachi", "m": "Karachi"}], "skills": ["Reading undiacriticized text", "Context-based vowel guessing"]},
        {"num": 18, "slug": "signage", "title": "Reading Signs & Labels", "subtitle": "Practical Urdu reading", "desc": "Read Urdu as you'd encounter it in daily life.", "chars": [], "words": [{"w": "دکان", "t": "dukaan", "m": "shop"}, {"w": "ہسپتال", "t": "haspataal", "m": "hospital"}, {"w": "بس اڈا", "t": "bas adda", "m": "bus station"}, {"w": "ریلوے اسٹیشن", "t": "railway station", "m": "railway station"}], "skills": ["Environmental reading"]},
        {"num": 19, "slug": "sentences", "title": "Reading Sentences", "subtitle": "Complete Urdu sentences", "desc": "Read full Urdu sentences.", "chars": [], "words": [{"w": "میں اردو سیکھ رہا ہوں", "t": "main urduu siikh rahaa huun", "m": "I am learning Urdu"}, {"w": "یہ میری کتاب ہے", "t": "yeh merii kitaab hai", "m": "This is my book"}, {"w": "آپ کا نام کیا ہے؟", "t": "aap kaa naam kyaa hai?", "m": "What is your name?"}], "skills": ["Sentence reading"]},
        {"num": 20, "slug": "final_review", "title": "Final Review", "subtitle": "Urdu script mastery!", "desc": "Comprehensive review.", "chars": [], "words": [{"w": "پاکستان زندہ باد", "t": "paakistaan zindah baad", "m": "Long live Pakistan"}, {"w": "اردو ادب", "t": "urduu adab", "m": "Urdu literature"}, {"w": "خوش آمدید", "t": "khush aamdeed", "m": "welcome"}], "skills": ["Complete Urdu script mastery"]},
    ]
}

ALL_LANGUAGES = [TAMIL_DATA, MALAYALAM_DATA, KANNADA_DATA, TELUGU_DATA, HINDI_DATA, URDU_DATA]

# ============================================================================
# LESSON GENERATOR
# ============================================================================

def build_steps(lesson, lang_data):
    """Generate 15-25 steps for a lesson using the alphabet soup method."""
    steps = []
    chars = lesson.get("chars", [])
    words = lesson.get("words", [])
    lesson_num = lesson["num"]
    qid = 0

    # Step 1: Welcome / intro content
    if lesson_num == 1:
        steps.append({
            "type": "content",
            "step_title": f"Welcome to {lang_data['name']} Script!",
            "content_markdown": f"# Welcome to {lang_data['name']} Script! 🎉\n\nYou're about to learn to read {lang_data['name']} — one of the beautiful writing systems of South Asia.\n\n## Today's Mission\nLearn **{len(chars)} new characters** and start reading real words!\n\n### What You'll Learn\n{chr(10).join('- **' + c['c'] + '** (' + c['t'] + ') — ' + c['sound'] for c in chars[:5])}\n\nLet's begin! 💪"
        })
    else:
        intro_text = lesson.get("desc", "")
        char_preview = ""
        if chars:
            char_preview = "\n\n### Today's Characters\n" + " · ".join(f"**{c['c']}**" for c in chars[:6])
        steps.append({
            "type": "content",
            "step_title": lesson["title"],
            "content_markdown": f"# {lesson['title']}\n\n{intro_text}{char_preview}"
        })

    # Steps for each character (content + quiz pairs)
    for i, ch in enumerate(chars):
        # Content step introducing the character
        content_lines = [f"## {ch['c']} — {ch['t']}"]
        content_lines.append(f"\n**Sound:** {ch['sound']}")
        content_lines.append(f"\n**Memory Trick:** {ch['trick']}")
        if i < len(chars) - 1 and i > 0:
            content_lines.append(f"\n| Character | Sound | Transliteration |")
            content_lines.append(f"|-----------|-------|-----------------|")
            content_lines.append(f"| **{ch['c']}** | {ch['sound']} | {ch['t']} |")

        steps.append({
            "type": "content",
            "step_title": f"Learn: {ch['c']} ({ch['t']})",
            "content_markdown": "\n".join(content_lines)
        })

        # Quiz for this character
        qid += 1
        other_chars = [c for c in chars if c['c'] != ch['c']]
        wrong = [c['c'] for c in other_chars[:3]]
        if len(wrong) < 3:
            wrong.extend(["?", "—", "×"][:3-len(wrong)])
        options = [ch['c']] + wrong
        random.seed(qid + lesson_num * 100)
        random.shuffle(options)

        steps.append({
            "type": "multiple_choice",
            "id": f"q{qid}",
            "step_title": f"Identify: {ch['t']}",
            "question": f"Which character represents the sound **{ch['t']}** ({ch['sound']})?",
            "options": options,
            "correct_answer": ch['c'],
            "feedback": f"Correct! **{ch['c']}** is the {ch['sound']} sound. {ch['trick']}"
        })

    # Sound matching quiz (if enough chars)
    if len(chars) >= 3:
        qid += 1
        ch = chars[0]
        steps.append({
            "type": "multiple_choice",
            "id": f"q{qid}",
            "step_title": "Sound Match",
            "question": f"What sound does **{ch['c']}** make?",
            "options": [ch['sound']] + [c['sound'] for c in chars[1:4]],
            "correct_answer": ch['sound'],
            "feedback": f"Right! **{ch['c']}** = {ch['t']} = {ch['sound']}."
        })

    # Visual comparison content (if pairs exist)
    if len(chars) >= 2:
        comparison_rows = "\n".join(f"- **{chars[i]['c']}** ({chars[i]['t']}) vs **{chars[min(i+1,len(chars)-1)]['c']}** ({chars[min(i+1,len(chars)-1)]['t']})" for i in range(0, len(chars)-1, 2))
        steps.append({
            "type": "content",
            "step_title": "Visual Comparison",
            "content_markdown": f"## Compare the Shapes\n\nLook closely at how these characters differ:\n\n{comparison_rows}\n\nNotice the subtle differences in strokes, dots, or curves!"
        })

    # Free response quiz
    if chars:
        qid += 1
        ch = chars[-1]
        steps.append({
            "type": "free_response",
            "id": f"q{qid}",
            "step_title": "Type the Sound",
            "question": f"What is the transliteration (Roman letters) for **{ch['c']}**?",
            "ai_grading": False,
            "accepted_responses": [ch['t'], ch['t'].lower(), ch['t'].upper()],
            "hint": f"It sounds like '{ch['sound']}'."
        })

    # Word practice section
    if words:
        word_table_rows = "\n".join(f"| **{w['w']}** | {w['t']} | {w['m']} |" for w in words)
        steps.append({
            "type": "content",
            "step_title": "Word Practice",
            "content_markdown": f"## Let's Read Words!\n\nUsing what you've learned, try reading these words:\n\n| {lang_data['name']} | Transliteration | Meaning |\n|---------|-----------------|--------|\n{word_table_rows}"
        })

        # Quiz on words
        for w in words[:3]:
            qid += 1
            wrong_meanings = [ww['m'] for ww in words if ww['m'] != w['m']][:3]
            if len(wrong_meanings) < 3:
                wrong_meanings.extend(["hello", "goodbye", "water"][:3-len(wrong_meanings)])
            opts = [w['m']] + wrong_meanings[:3]
            random.seed(qid + lesson_num * 200)
            random.shuffle(opts)
            steps.append({
                "type": "multiple_choice",
                "id": f"q{qid}",
                "step_title": f"Read: {w['w']}",
                "question": f"What does **{w['w']}** ({w['t']}) mean?",
                "options": opts,
                "correct_answer": w['m'],
                "feedback": f"Correct! **{w['w']}** ({w['t']}) means '{w['m']}'."
            })

        # Free response on word transliteration
        if words:
            qid += 1
            w = words[0]
            steps.append({
                "type": "free_response",
                "id": f"q{qid}",
                "step_title": "Transliterate the Word",
                "question": f"Type the transliteration for **{w['w']}** (meaning: {w['m']})",
                "ai_grading": False,
                "accepted_responses": [w['t'], w['t'].lower(), w['t'].replace(" ", "")],
                "hint": f"Sound it out character by character."
            })

    # Summary / review content
    if chars:
        summary_rows = "\n".join(f"| **{c['c']}** | {c['t']} | {c['sound']} |" for c in chars)
        steps.append({
            "type": "content",
            "step_title": "Lesson Summary",
            "content_markdown": f"## Summary\n\nGreat job! Here's everything you learned:\n\n| Character | Transliteration | Sound |\n|-----------|----------------|-------|\n{summary_rows}"
        })
    else:
        steps.append({
            "type": "content",
            "step_title": "Lesson Summary",
            "content_markdown": f"## Summary\n\nExcellent reading practice! You worked through {len(words)} words/phrases. Keep building your speed and confidence!"
        })

    # Final quiz
    if chars:
        qid += 1
        steps.append({
            "type": "multiple_choice",
            "id": f"q{qid}",
            "step_title": "Final Check",
            "question": f"How many new characters/concepts did we cover in this lesson?",
            "options": [str(len(chars)), str(len(chars)+2), str(len(chars)-1), str(len(chars)+5)],
            "correct_answer": str(len(chars)),
            "feedback": f"Correct! We covered {len(chars)} characters today. Keep practicing!"
        })
    elif words:
        qid += 1
        w = words[-1]
        steps.append({
            "type": "multiple_choice",
            "id": f"q{qid}",
            "step_title": "Final Check",
            "question": f"What does **{w['w']}** mean?",
            "options": [w['m'], words[0]['m'] if len(words) > 1 else "hello", "water", "school"],
            "correct_answer": w['m'],
            "feedback": f"Perfect! You're reading {lang_data['name']} with confidence!"
        })

    # Pad to minimum 15 steps if needed
    while len(steps) < 15:
        qid += 1
        if chars and len(chars) > 1:
            ch = chars[len(steps) % len(chars)]
            steps.append({
                "type": "multiple_choice",
                "id": f"q{qid}",
                "step_title": f"Review: {ch['c']}",
                "question": f"Which transliteration matches **{ch['c']}**?",
                "options": [ch['t']] + [c['t'] for c in chars if c['t'] != ch['t']][:3],
                "correct_answer": ch['t'],
                "feedback": f"That's right! **{ch['c']}** = {ch['t']}."
            })
        elif words:
            w = words[len(steps) % len(words)]
            steps.append({
                "type": "free_response",
                "id": f"q{qid}",
                "step_title": f"Practice: {w['w']}",
                "question": f"Type the meaning of **{w['w']}** ({w['t']})",
                "ai_grading": False,
                "accepted_responses": [w['m']],
                "hint": f"Transliteration: {w['t']}"
            })
        else:
            break

    # Trim to max 25
    steps = steps[:25]
    return steps


def generate_lesson_json(lesson, lang_data):
    """Generate a complete lesson JSON."""
    steps = build_steps(lesson, lang_data)
    code = lang_data["code"]
    return {
        "lesson_id": f"{code}_{lesson['num']:02d}_{lesson['slug']}",
        "language": lang_data["full_name"],
        "title": lesson["title"],
        "subtitle": lesson.get("subtitle", ""),
        "description": lesson["desc"],
        "estimated_minutes": max(15, len(steps) * 1.2),
        "cefr_level": "A0",
        "tags": ["script", "reading", "basics"],
        "skills_learned": lesson.get("skills", [f"Reading {lang_data['name']} characters"]),
        "steps": steps
    }


def generate_unit_metadata(lang_data):
    """Generate _unit_metadata.json for a language."""
    lessons = lang_data["lessons"]
    return {
        "unit_id": lang_data["unit_id"],
        "unit_number": 1,
        "language": lang_data["full_name"],
        "title": lang_data["unit_title"],
        "subtitle": lang_data["unit_subtitle"],
        "description": lang_data["unit_description"],
        "estimated_minutes": len(lessons) * 25,
        "lesson_count": len(lessons),
        "lessons": [f"{l['num']:02d}_{l['slug']}" for l in lessons],
        "completion_criteria": {"all_lessons_completed": True},
        "skills_learned": [
            f"Reading all {lang_data['name']} script characters",
            f"Understanding {lang_data['name']} vowel and consonant systems",
            f"Reading real {lang_data['name']} words and sentences",
            "Vowel marks / matras system",
            "Consonant clusters and conjuncts"
        ]
    }


def main():
    """Generate all lesson files for all languages."""
    # Clean everything first
    if BASE.exists():
        shutil.rmtree(BASE)
    BASE.mkdir(parents=True, exist_ok=True)

    total_lessons = 0
    total_steps = 0

    for lang_data in ALL_LANGUAGES:
        code = lang_data["code"]
        unit_dir = BASE / code / "unit_1_reading_the_script"
        unit_dir.mkdir(parents=True, exist_ok=True)

        # Write unit metadata
        meta = generate_unit_metadata(lang_data)
        with open(unit_dir / "_unit_metadata.json", "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        print(f"\n📖 {lang_data['name']} — {len(lang_data['lessons'])} lessons")

        for lesson in lang_data["lessons"]:
            lesson_json = generate_lesson_json(lesson, lang_data)
            filename = f"{lesson['num']:02d}_{lesson['slug']}.json"
            filepath = unit_dir / filename
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(lesson_json, f, ensure_ascii=False, indent=2)

            step_count = len(lesson_json["steps"])
            total_steps += step_count
            total_lessons += 1
            print(f"  ✅ {filename} — {lesson_json['title']} ({step_count} steps)")

    print(f"\n{'='*70}")
    print(f"✅ Generated {total_lessons} lessons with {total_steps} total steps")
    print(f"   Languages: {', '.join(l['name'] for l in ALL_LANGUAGES)}")
    print(f"   Output: {BASE}")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
