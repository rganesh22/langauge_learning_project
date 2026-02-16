"""
Seed database with sample lessons
Run this script to populate the lessons table with initial content
"""
import sys
import os

# Add parent directory to path to import backend modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend import db

# Sample Lessons Data
sample_lessons = [
    {
        "lesson_id": "SPAN_B1_001",
        "title": "Navigating a Mexican Mercado",
        "language": "Spanish",
        "level": "B1",
        "steps": [
            {
                "type": "content",
                "content_markdown": "### El Mercado de Coyoacán\n\nEn el mercado, puedes encontrar mucha **fruta fresca**. Los mercados mexicanos son famosos por su ambiente vibrante y productos locales.\n\n| Item | Precio |\n|------|--------|\n| [[Manzanas|https://example.com/audio/manzanas.mp3]] | $20 |\n| [[Naranjas|https://example.com/audio/naranjas.mp3]] | $15 |\n| Plátanos | $10 |\n\nLos vendedores son muy amables y siempre están dispuestos a ayudar.",
                "image_url": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800"
            },
            {
                "id": "q1",
                "type": "multiple_choice",
                "question": "¿Dónde está ubicado el mercado?",
                "options": ["San José", "Coyoacán", "Madrid", "Barcelona"],
                "correct_index": 1,
                "feedback": "¡Correcto! Coyoacán es un barrio famoso en la Ciudad de México."
            },
            {
                "id": "q2",
                "type": "free_response",
                "question": "Describe qué podrías comprar en el mercado en español. Usa al menos 3 oraciones.",
                "ai_grading": True,
                "hint": "Intenta usar el verbo 'comprar' y los nombres de frutas que aprendiste."
            }
        ]
    },
    {
        "lesson_id": "KAN_A1_001",
        "title": "ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ಶಾಪಿಂಗ್",
        "language": "Kannada",
        "level": "A1",
        "steps": [
            {
                "type": "content",
                "content_markdown": "### ಮಾರುಕಟ್ಟೆ (Market)\n\nಕರ್ನಾಟಕದ ಮಾರುಕಟ್ಟೆಗಳಲ್ಲಿ ತಾಜಾ **ತರಕಾರಿಗಳು** ಮತ್ತು **ಹಣ್ಣುಗಳು** ಸಿಗುತ್ತವೆ.\n\n| ವಸ್ತು | ಬೆಲೆ |\n|------|------|\n| [[ಟೊಮೇಟೊ|https://example.com/audio/tomato.mp3]] | ₹40 |\n| [[ಬಾಳೆಹಣ್ಣು|https://example.com/audio/banana.mp3]] | ₹50 |\n| ಆಲೂಗಡ್ಡೆ | ₹30 |\n\nನೀವು ಇಲ್ಲಿ ತಾಜಾ ಆಹಾರವನ್ನು ಕಾಣಬಹುದು.",
                "image_url": "https://images.unsplash.com/photo-1555982105-d25af4182e4e?w=800"
            },
            {
                "id": "q1",
                "type": "multiple_choice",
                "question": "ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ನೀವು ಏನು ಕಾಣಬಹುದು?",
                "options": ["ತರಕಾರಿಗಳು ಮತ್ತು ಹಣ್ಣುಗಳು", "ಕಾರುಗಳು", "ಪುಸ್ತಕಗಳು", "ಬಟ್ಟೆಗಳು"],
                "correct_index": 0,
                "feedback": "ಸರಿ! ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ತಾಜಾ ತರಕಾರಿಗಳು ಮತ್ತು ಹಣ್ಣುಗಳು ಸಿಗುತ್ತವೆ."
            },
            {
                "id": "q2",
                "type": "free_response",
                "question": "ನೀವು ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ಏನು ಖರೀದಿಸಲು ಇಷ್ಟಪಡುತ್ತೀರಿ? ಕನ್ನಡದಲ್ಲಿ ಬರೆಯಿರಿ.",
                "ai_grading": True,
                "hint": "ಟೊಮೇಟೊ, ಬಾಳೆಹಣ್ಣು ಅಥವಾ ಆಲೂಗಡ್ಡೆ ಬಗ್ಗೆ ಬರೆಯಿರಿ."
            },
            {
                "id": "q3",
                "type": "multiple_choice",
                "question": "ಟೊಮೇಟೊದ ಬೆಲೆ ಎಷ್ಟು?",
                "options": ["₹30", "₹40", "₹50", "₹60"],
                "correct_index": 1,
                "feedback": "ಸರಿ! ಟೊಮೇಟೊದ ಬೆಲೆ ₹40."
            }
        ]
    },
    {
        "lesson_id": "ENG_B2_READ_001",
        "title": "The Art of Language Learning",
        "language": "English",
        "level": "B2",
        "steps": [
            {
                "type": "content",
                "content_markdown": "## The Science Behind Language Acquisition\n\n*Research has shown* that **immersion** is one of the most effective methods for learning a new language. When you surround yourself with native speakers and authentic materials, your brain begins to naturally recognize patterns.\n\n### Key Principles:\n\n1. **Consistent Practice**: Daily exposure is more effective than occasional intensive study\n2. **Meaningful Context**: Learn words and phrases in real-world situations\n3. **Active Production**: Don't just listen—speak and write too!\n\n> \"The limits of my language mean the limits of my world.\" - Ludwig Wittgenstein\n\nModern technology has made immersion more accessible than ever. You can now:\n- Watch [[movies|https://example.com/audio/movies.mp3]] in your target language\n- Listen to [[podcasts|https://example.com/audio/podcasts.mp3]] during your commute\n- Join online conversation groups\n- Use language learning apps",
                "image_url": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800"
            },
            {
                "id": "comp_q1",
                "type": "multiple_choice",
                "question": "According to the text, what is one of the most effective methods for language learning?",
                "options": [
                    "Reading grammar books",
                    "Immersion with native speakers",
                    "Memorizing word lists",
                    "Taking tests frequently"
                ],
                "correct_index": 1,
                "feedback": "Correct! The passage states that immersion with native speakers and authentic materials is highly effective."
            },
            {
                "id": "comp_q2",
                "type": "free_response",
                "question": "Summarize the three key principles of language learning mentioned in the text. Write your answer in complete sentences.",
                "ai_grading": True,
                "hint": "Look at the numbered list under 'Key Principles'"
            },
            {
                "id": "reflection",
                "type": "free_response",
                "question": "How do you currently practice language learning? What method mentioned in the text would you like to try?",
                "ai_grading": False,
                "answer_key": None
            }
        ]
    }
]


def seed_lessons():
    """Seed the database with sample lessons"""
    print("Seeding database with sample lessons...")
    
    for lesson in sample_lessons:
        print(f"Adding lesson: {lesson['title']} ({lesson['language']} - {lesson['level']})")
        success = db.add_lesson(
            lesson_id=lesson['lesson_id'],
            title=lesson['title'],
            language=lesson['language'],
            level=lesson['level'],
            steps=lesson['steps']
        )
        
        if success:
            print(f"  ✓ Successfully added {lesson['lesson_id']}")
        else:
            print(f"  ✗ Failed to add {lesson['lesson_id']}")
    
    print("\nSeeding complete!")
    
    # Verify by fetching lessons
    print("\nVerifying lessons in database:")
    for lang in ["Spanish", "Kannada", "English"]:
        lessons = db.get_lessons_by_language(lang)
        print(f"  {lang}: {len(lessons)} lesson(s)")


if __name__ == "__main__":
    seed_lessons()
