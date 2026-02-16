"""
Prompting templates for lesson grading
"""

LESSON_FREE_RESPONSE_GRADING_PROMPT = """Grade the following free response answer for a language learning lesson.

Language: {language}
User CEFR Level: {user_cefr_level}
Question: {question}
User's Answer: {user_answer}

Provide constructive feedback in English appropriate for {user_cefr_level} level learners.
Assign a score from 0-100 where:
- 0-30: Minimal effort or completely incorrect
- 31-50: Some understanding but major issues
- 51-70: Good understanding with minor issues
- 71-90: Very good with only small improvements needed
- 91-100: Excellent, near-perfect response

Return ONLY valid JSON (no markdown) in this format:
{{
    "score": 75,
    "feedback": "detailed constructive feedback in English"
}}
"""
