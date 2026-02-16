#!/usr/bin/env python3
"""
Audit all 30 Malayalam lessons to ensure they're truly A0 level 
(focused on script/pronunciation, not comprehension)
"""
import json
import os
from pathlib import Path

lessons_dir = Path("backend/lessons/ml")

print("=" * 80)
print("MALAYALAM LESSON AUDIT - A0 LEVEL CHECK")
print("=" * 80)
print()
print("Checking if lessons focus on:")
print("  ✓ Script recognition (reading Malayalam characters)")
print("  ✓ Pronunciation (how to say what you read)")
print("  ✓ Basic word recognition (no comprehension required)")
print()
print("=" * 80)
print()

# Keywords that suggest comprehension (bad for A0)
comprehension_keywords = [
    "understand", "meaning", "translate", "conversation", "grammar rule",
    "sentence structure", "verb conjugation", "tense", "plural", "question form",
    "why", "when to use", "context"
]

# Keywords that are good for A0
reading_keywords = [
    "read", "pronounce", "sound", "articulation", "script", "character",
    "letter", "phonetic", "visual", "recognize"
]

issues_found = []

for i in range(1, 31):
    filename = None
    # Find the file
    for f in lessons_dir.glob(f"{i:02d}_*.json"):
        filename = f
        break
    
    if not filename:
        issues_found.append(f"Lesson {i}: FILE NOT FOUND")
        continue
    
    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    title = data.get('title', 'No title')
    description = data.get('description', '')
    tags = data.get('tags', [])
    steps = data.get('steps', [])
    
    print(f"Lesson {i:02d}: {title}")
    print(f"  File: {filename.name}")
    print(f"  Description: {description[:80]}...")
    print(f"  Tags: {', '.join(tags)}")
    print(f"  Steps: {len(steps)}")
    
    # Check for comprehension-focused content
    full_text = json.dumps(data).lower()
    
    found_comprehension = []
    for keyword in comprehension_keywords:
        if keyword in full_text:
            found_comprehension.append(keyword)
    
    found_reading = []
    for keyword in reading_keywords:
        if keyword in full_text:
            found_reading.append(keyword)
    
    # Check if questions ask about meaning/comprehension
    meaning_questions = 0
    pronunciation_questions = 0
    
    for step in steps:
        if step.get('type') in ['multiple_choice', 'free_response']:
            question = step.get('question', '').lower()
            if any(word in question for word in ['mean', 'meaning', 'translate', 'understand']):
                meaning_questions += 1
            if any(word in question for word in ['sound', 'pronounce', 'read', 'articulation']):
                pronunciation_questions += 1
    
    # Analysis
    status = "✓ GOOD"
    concerns = []
    
    if meaning_questions > 0:
        concerns.append(f"{meaning_questions} meaning/comprehension question(s)")
        status = "⚠ REVIEW"
    
    if len(found_comprehension) > 3:
        concerns.append(f"Uses comprehension keywords: {', '.join(found_comprehension[:3])}...")
        status = "⚠ REVIEW"
    
    if len(found_reading) == 0:
        concerns.append("No reading/pronunciation keywords found")
        status = "❌ ISSUE"
    
    print(f"  Status: {status}")
    if concerns:
        print(f"  Concerns: {'; '.join(concerns)}")
        issues_found.append(f"Lesson {i} ({title}): {'; '.join(concerns)}")
    else:
        print(f"  Analysis: Good A0 focus on reading/pronunciation")
    
    print()

print("=" * 80)
print("SUMMARY")
print("=" * 80)
print()

if issues_found:
    print(f"⚠  Found {len(issues_found)} potential issues:")
    print()
    for issue in issues_found:
        print(f"  • {issue}")
else:
    print("✅ All 30 lessons appear to be properly focused on A0 (reading/pronunciation)")

print()
print("=" * 80)
