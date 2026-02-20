#!/usr/bin/env python3
"""
Script to update all lesson JSON files to disable AI grading
and add accepted_responses fields
"""
import json
import os
from pathlib import Path

# Lesson directory
LESSONS_DIR = Path(__file__).parent / 'lessons'

def update_lesson_file(filepath):
    """Update a single lesson file to disable AI grading"""
    with open(filepath, 'r', encoding='utf-8') as f:
        lesson = json.load(f)
    
    modified = False
    
    for step in lesson.get('steps', []):
        if step.get('type') == 'free_response' and step.get('ai_grading') == True:
            # Disable AI grading
            step['ai_grading'] = False
            
            # Add accepted_responses based on the question
            question = step.get('question', '').lower()
            
            # Provide sensible default accepted responses
            # These are placeholder - should be customized per lesson
            if 'market' in question or 'ಮಾರುಕಟ್ಟೆ' in question:
                # Market shopping questions
                if 'kannada' in str(filepath).lower() or 'kn' in str(filepath):
                    step['accepted_responses'] = [
                        "ನಾನು ಟೊಮೇಟೊ ಮತ್ತು ಬಾಳೆಹಣ್ಣು ಖರೀದಿಸಲು ಇಷ್ಟಪಡುತ್ತೇನೆ",
                        "ನಾನು ತರಕಾರಿಗಳು ಖರೀದಿಸಲು ಇಷ್ಟಪಡುತ್ತೇನೆ",
                        "ನಾನು ಹಣ್ಣುಗಳು ಖರೀದಿಸಲು ಇಷ್ಟಪಡುತ್ತೇನೆ"
                    ]
                elif 'malayalam' in str(filepath).lower() or 'ml' in str(filepath):
                    step['accepted_responses'] = [
                        "ഞാൻ തക്കാളിയും വാഴപ്പഴവും വാങ്ങാൻ ഇഷ്ടപ്പെടുന്നു",
                        "ഞാൻ പച്ചക്കറികൾ വാങ്ങാൻ ഇഷ്ടപ്പെടുന്നു",
                        "ഞാൻ പഴങ്ങൾ വാങ്ങാൻ ഇഷ്ടപ്പെടുന്നു"
                    ]
                elif 'tamil' in str(filepath).lower() or 'ta' in str(filepath):
                    step['accepted_responses'] = [
                        "நான் தக்காளி மற்றும் வாழைப்பழம் வாங்க விரும்புகிறேன்",
                        "நான் காய்கறிகள் வாங்க விரும்புகிறேன்",
                        "நான் பழங்கள் வாங்க விரும்புகிறேன்"
                    ]
                elif 'telugu' in str(filepath).lower() or 'te' in str(filepath):
                    step['accepted_responses'] = [
                        "నేను టమోటా మరియు అరటిపండు కొనడానికి ఇష్టపడతాను",
                        "నేను కూరగాయలు కొనడానికి ఇష్టపడతాను",
                        "నేను పండ్లు కొనడానికి ఇష్టపడతాను"
                    ]
                elif 'hindi' in str(filepath).lower() or 'hi' in str(filepath):
                    step['accepted_responses'] = [
                        "मैं टमाटर और केला खरीदना पसंद करता हूं",
                        "मैं सब्जियां खरीदना पसंद करता हूं",
                        "मैं फल खरीदना पसंद करता हूं"
                    ]
            elif 'intro' in question or 'name' in question or 'परिचय' in question or 'ಪರಿಚಯ' in question:
                # Self introduction questions
                if 'kannada' in str(filepath).lower() or 'kn' in str(filepath):
                    step['accepted_responses'] = [
                        "ನನ್ನ ಹೆಸರು ರಾಜ್",
                        "ನನ್ನ ಹೆಸರು ಪ್ರಿಯಾ",
                        "ನನ್ನ ಹೆಸರು ಅನಿಲ್"
                    ]
                elif 'malayalam' in str(filepath).lower() or 'ml' in str(filepath):
                    step['accepted_responses'] = [
                        "എന്റെ പേര് രാജ്",
                        "എന്റെ പേര് പ്രിയ",
                        "എന്റെ പേര് അനിൽ"
                    ]
                elif 'tamil' in str(filepath).lower() or 'ta' in str(filepath):
                    step['accepted_responses'] = [
                        "என் பெயர் ராஜ்",
                        "என் பெயர் பிரியா",
                        "என் பெயர் அனில்"
                    ]
                elif 'telugu' in str(filepath).lower() or 'te' in str(filepath):
                    step['accepted_responses'] = [
                        "నా పేరు రాజ్",
                        "నా పేరు ప్రియా",
                        "నా పేరు అనిల్"
                    ]
                elif 'hindi' in str(filepath).lower() or 'hi' in str(filepath):
                    step['accepted_responses'] = [
                        "मेरा नाम राज है",
                        "मेरा नाम प्रिया है",
                        "मेरा नाम अनिल है"
                    ]
            else:
                # Generic fallback - accept any response
                step['accepted_responses'] = ["any"]
                # Remove the field if we don't have specific responses
                if 'accepted_responses' in step:
                    del step['accepted_responses']
                # Keep ai_grading false but add a note
                print(f"⚠️  {filepath.name}: Question needs manual accepted_responses")
            
            modified = True
    
    if modified:
        # Save the updated file with proper formatting
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(lesson, f, ensure_ascii=False, indent=2)
        print(f"✅ Updated: {filepath.relative_to(LESSONS_DIR.parent)}")
        return True
    return False

def main():
    """Update all lesson files"""
    count = 0
    for json_file in LESSONS_DIR.rglob('*.json'):
        if update_lesson_file(json_file):
            count += 1
    
    print(f"\n✅ Updated {count} lesson files")
    print("\n⚠️  Please review lessons and customize accepted_responses as needed!")

if __name__ == '__main__':
    main()
