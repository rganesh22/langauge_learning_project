"""
API client for Gemini AI and Google Cloud Speech-to-Text
Handles text generation, TTS, and STT operations
"""
import json
import random
import time
import threading
import base64
import io
import struct
import re
import signal
import asyncio
import concurrent.futures
from functools import wraps
import google.generativeai as genai
from google.cloud import speech
try:
    from google import genai as google_genai
    from google.genai import types
    HAS_GOOGLE_GENAI = True
except ImportError:
    HAS_GOOGLE_GENAI = False
    print("Warning: google.genai not available, falling back to google.cloud.texttospeech")
from google.cloud import texttospeech
from . import config
from .prompting import render_template

# Initialize Gemini API
if config.GEMINI_API_KEY:
    genai.configure(api_key=config.GEMINI_API_KEY)

# ============================================================================
# Model Configuration
# ============================================================================

# Gemini model to use throughout the application
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_MODEL_LIVE = "gemini-2.5-flash-native-audio-preview-12-2025"  # For live API (real-time audio)

# ============================================================================
# Text Generation Functions
# ============================================================================

# Gemini 2.5 Flash pricing (January 2026)
# Text: Input $0.30/1M tokens, Output $2.50/1M tokens  
# Audio: Input $1.00/1M tokens, Output (not applicable for text model)
# Gemini 2.5 Flash Native Audio pricing (January 2026)
# Text: Input $0.50/1M tokens, Output $2.00/1M tokens
# Audio: Input $3.00/1M tokens, Output $12.00/1M tokens
GEMINI_25_FLASH_INPUT_PRICE_PER_1M = 0.30  # Text input
GEMINI_25_FLASH_OUTPUT_PRICE_PER_1M = 2.50  # Text output
GEMINI_25_FLASH_AUDIO_INPUT_PRICE_PER_1M = 1.00  # Audio input
GEMINI_25_FLASH_NATIVE_AUDIO_INPUT_TEXT_PRICE_PER_1M = 0.50  # Text input for native audio model
GEMINI_25_FLASH_NATIVE_AUDIO_OUTPUT_TEXT_PRICE_PER_1M = 2.00  # Text output for native audio model
GEMINI_25_FLASH_NATIVE_AUDIO_INPUT_AUDIO_PRICE_PER_1M = 3.00  # Audio input for native audio model
GEMINI_25_FLASH_NATIVE_AUDIO_OUTPUT_AUDIO_PRICE_PER_1M = 12.00  # Audio output for native audio model

# Timeout configuration
GEMINI_API_TIMEOUT = 60  # 60 seconds timeout for API calls
TTS_TIMEOUT = 30  # 30 seconds timeout for TTS generation

# Language-specific writing guidelines (3 general rules for rubric)
WRITING_GUIDELINES = {
    'kannada': [
        "ನೀಡಲಾದ ಎಲ್ಲಾ ಅನಿವಾರ್ಯ ಪದಗಳನ್ನು ಬಳಸಬೇಕು ಮತ್ತು ಸಾಧ್ಯವಾದಷ್ಟು ಕಲಿತ ಮತ್ತು ಕಲಿಯುತ್ತಿರುವ ಪದಗಳನ್ನು ಸಹೃದಯವಾಗಿ ಬಳಸಬೇಕು.",
        "ವ್ಯಾಕರಣದ ನಿಖರತೆ, ಪದಗಳ ಸರಿಯಾದ ಬಳಕೆ, ಮತ್ತು ಸ್ಪಷ್ಟತೆಯನ್ನು ಕಾಪಾಡಿಕೊಳ್ಳಬೇಕು.",
        "ಲೇಖನವು ಸಂಬಂಧಿತವಾಗಿರಬೇಕು, ಸ್ಪಷ್ಟವಾಗಿರಬೇಕು, ಮತ್ತು ಪೂರ್ಣವಾಗಿರಬೇಕು."
    ],
    'telugu': [
        "ఇవ్వబడిన అన్ని అవసరమైన పదాలను ఉపయోగించాలి మరియు వీలైనంత నేర్చుకున్న మరియు నేర్చుకుంటున్న పదాలను స్వాభావికంగా ఉపయోగించాలి.",
        "వ్యాకరణ ఖచ్చితత్వం, పదాల సరైన ఉపయోగం మరియు స్పష్టతను కొనసాగించాలి.",
        "వ్యాసం సంబంధితంగా, స్పష్టంగా మరియు పూర్తిగా ఉండాలి."
    ],
    'malayalam': [
        "നൽകിയിരിക്കുന്ന എല്ലാ ആവശ്യമായ വാക്കുകളും ഉപയോഗിക്കണം കൂടാതെ പഠിച്ചതും പഠിക്കുന്നതുമായ വാക്കുകൾ സ്വാഭാവികമായി ഉപയോഗിക്കണം.",
        "വ്യാകരണ കൃത്യത, വാക്കുകളുടെ ശരിയായ ഉപയോഗം, സ്പഷ്ടത എന്നിവ പാലിക്കണം.",
        "ലേഖനം പ്രസക്തവും വ്യക്തവും പൂർണ്ണവും ആയിരിക്കണം."
    ],
    'tamil': [
        "கொடுக்கப்பட்ட அனைத்து தேவையான சொற்களையும் பயன்படுத்த வேண்டும் மற்றும் கற்ற மற்றும் கற்றுக்கொண்டிருக்கும் சொற்களை இயல்பாகப் பயன்படுத்த வேண்டும்.",
        "இலக்கண துல்லியம், சொற்களின் சரியான பயன்பாடு மற்றும் தெளிவை பராமரிக்க வேண்டும்.",
        "கட்டுரை பொருத்தமானதாகவும், தெளிவாகவும், முழுமையாகவும் இருக்க வேண்டும்."
    ],
    'hindi': [
        "दिए गए सभी आवश्यक शब्दों का उपयोग करें और सीखे हुए तथा सीख रहे शब्दों का स्वाभाविक रूप से उपयोग करें।",
        "व्याकरण की शुद्धता, शब्दों का सही उपयोग और स्पष्टता बनाए रखें।",
        "लेख प्रासंगिक, स्पष्ट और पूर्ण होना चाहिए।"
    ],
    'urdu': [
        "दिए गए सभी आवश्यक शब्दों का उपयोग करें और सीखे हुए तथा सीख रहे शब्दों का स्वाभाविक रूप से उपयोग करें।",  # Devanagari
        "व्याकरण की शुद्धता, शब्दों का सही उपयोग और स्पष्टता बनाए रखें।",  # Devanagari
        "लेख प्रासंगिक, स्पष्ट और पूर्ण होना चाहिए।"  # Devanagari
    ],
    'english': [
        "Use all the required words provided and incorporate learned and learning words naturally.",
        "Maintain grammatical accuracy, proper word usage, and clarity.",
        "The writing should be relevant, clear, and complete."
    ]
}

# Language-specific script requirements
SCRIPT_REQUIREMENTS = {
    'kannada': "CRITICAL: Use only Kannada script (ಕನ್ನಡ ಲಿಪಿ). NO English, NO Latin letters.",
    'telugu': "CRITICAL: Use only Telugu script (తెలుగు లిపి). NO English, NO Latin letters.",
    'malayalam': "CRITICAL: Use only Malayalam script (മലയാളം ലിപി). NO English, NO Latin letters.",
    'tamil': "CRITICAL: Use only Tamil script (தமிழ் எழுத்து). NO English, NO Latin letters.",
    'hindi': "CRITICAL: Use only Devanagari script (देवनागरी लिपि). NO English, NO Latin letters.",
    'urdu': "CRITICAL: Use ONLY Devanagari script (देवनागरी लिपि) - NOT Nastaliq/Arabic script. The client will handle conversion to Nastaliq. NO English, NO Latin letters.",
    'english': "Use only English (Latin script)."
}

def get_script_requirement(language):
    """Get the script requirement text for a specific language"""
    return SCRIPT_REQUIREMENTS.get(language.lower(), SCRIPT_REQUIREMENTS['english'])

class TimeoutError(Exception):
    """Custom timeout error"""
    pass

def timeout_handler(signum, frame):
    """Signal handler for timeout"""
    raise TimeoutError("Operation timed out")

def with_timeout(timeout_seconds):
    """Decorator to add timeout to function calls"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Use threading for timeout (works on all platforms)
            result = [None]
            exception = [None]
            
            def target():
                try:
                    result[0] = func(*args, **kwargs)
                except Exception as e:
                    exception[0] = e
            
            thread = threading.Thread(target=target)
            thread.daemon = True
            thread.start()
            thread.join(timeout_seconds)
            
            if thread.is_alive():
                # Thread is still running - timeout occurred
                raise TimeoutError(f"Operation timed out after {timeout_seconds} seconds")
            
            if exception[0]:
                raise exception[0]
            
            return result[0]
        return wrapper
    return decorator

def calculate_token_costs(token_info: dict, model_name: str = None) -> dict:
    """Calculate costs from token usage info
    
    Args:
        token_info: Dict with 'prompt_tokens' and 'completion_tokens' or 'total_tokens'
        model_name: Model name (default: uses GEMINI_MODEL constant)
    
    Returns:
        dict: Token info with added cost fields
    """
    if not token_info:
        return token_info
    
    if model_name is None:
        model_name = GEMINI_MODEL
    
    prompt_tokens = token_info.get('prompt_tokens', 0)
    completion_tokens = token_info.get('completion_tokens', 0)
    total_tokens = token_info.get('total_tokens', prompt_tokens + completion_tokens)
    
    # Use Gemini 2.5 Flash pricing
    input_cost = (prompt_tokens / 1_000_000) * GEMINI_25_FLASH_INPUT_PRICE_PER_1M
    output_cost = (completion_tokens / 1_000_000) * GEMINI_25_FLASH_OUTPUT_PRICE_PER_1M
    total_cost = input_cost + output_cost
    
    # Add cost fields to token_info
    token_info_with_costs = {
        **token_info,
        'input_cost': round(input_cost, 6),
        'output_cost': round(output_cost, 6),
        'total_cost': round(total_cost, 6),
        'model': model_name,
    }
    
    return token_info_with_costs

def generate_text_with_gemini(prompt: str, model_name: str = None) -> tuple:
    """Generate text using Gemini API
    
    Returns:
        tuple: (response_text, response_time, token_info, is_truncated, debug_info)
    """
    if model_name is None:
        model_name = GEMINI_MODEL
    
    debug_info = {
        'step': 'generate_ text_with_gemini',
        'model_name': model_name,
        'prompt_length': len(prompt),
        'prompt_preview': prompt[:200] + '...' if len(prompt) > 200 else prompt,
    }
    
    if not config.GEMINI_API_KEY:
        debug_info['error'] = 'GEMINI_API_KEY not set'
        raise Exception("GEMINI_API_KEY not set")
    
    try:
        debug_info['status'] = 'initializing_model'
        model = genai.GenerativeModel(model_name)
        start_time = time.time()
        
        debug_info['status'] = 'calling_api'
        debug_info['call_start_time'] = start_time
        
        # Wrap API call with timeout
        # Use longer timeout for reading activities (they generate longer stories)
        timeout_seconds = GEMINI_API_TIMEOUT
        if len(prompt) > 5000:  # Reading activities typically have longer prompts
            timeout_seconds = 120  # 2 minutes for reading activities
        
        @with_timeout(timeout_seconds)
        def call_api():
            return model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.7,
                    "top_p": 0.95,
                    "top_k": 40,
                    "max_output_tokens": 8192,
                }
            )
        
        try:
            response = call_api()
        except TimeoutError as e:
            debug_info['error'] = f'API call timed out after {timeout_seconds} seconds'
            debug_info['error_type'] = 'TimeoutError'
            raise Exception(f"Gemini API call timed out after {timeout_seconds} seconds. Please try again.")
        
        response_time = time.time() - start_time
        debug_info['response_time'] = response_time
        debug_info['status'] = 'response_received'
        
        # Extract token usage info if available
        token_info = {}
        if hasattr(response, 'usage_metadata'):
            token_info = {
                'prompt_tokens': getattr(response.usage_metadata, 'prompt_token_count', 0),
                'completion_tokens': getattr(response.usage_metadata, 'candidates_token_count', 0),
                'total_tokens': getattr(response.usage_metadata, 'total_token_count', 0),
            }
            # Calculate costs
            token_info = calculate_token_costs(token_info, model_name)
            debug_info['token_info'] = token_info
        
        # Check if response was truncated
        is_truncated = False
        if hasattr(response, 'candidates') and response.candidates:
            finish_reason = getattr(response.candidates[0], 'finish_reason', None)
            is_truncated = finish_reason == 'MAX_TOKENS' or finish_reason == 'OTHER'
            debug_info['finish_reason'] = finish_reason
            debug_info['is_truncated'] = is_truncated
        
        # Check if response.text exists and is not empty
        if not hasattr(response, 'text'):
            debug_info['error'] = 'Response object has no text attribute'
            debug_info['response_attributes'] = dir(response)
            raise Exception("Empty response from Gemini API - no text attribute in response")
        
        if not response.text:
            debug_info['error'] = 'Response text is empty'
            debug_info['response_type'] = str(type(response.text))
            raise Exception("Empty response from Gemini API - text is empty")
        
        debug_info['response_length'] = len(response.text)
        debug_info['response_preview'] = response.text[:500] + '...' if len(response.text) > 500 else response.text
        debug_info['status'] = 'success'
        
        return (response.text, response_time, token_info, is_truncated, debug_info)
    except Exception as e:
        error_msg = f"Error generating text with Gemini: {str(e)}"
        debug_info['error'] = error_msg
        debug_info['error_type'] = type(e).__name__
        import traceback
        debug_info['traceback'] = traceback.format_exc()
        print(error_msg)
        traceback.print_exc()
        raise Exception(error_msg)


# Gemini TTS Model Configuration
# Using Gemini 2.5 Flash TTS for cost-efficient, low-latency audio generation
GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts"  # Or "gemini-2.5-pro-tts" for higher quality

# Available Gemini TTS prebuilt voices
# Voice genders based on Gemini TTS documentation: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#voice_options
# Complete list as of January 2026
GEMINI_TTS_VOICES = [
    # Female voices
    'Achernar', 'Aoede', 'Autonoe', 'Callirrhoe', 'Despina', 'Erinome', 
    'Gacrux', 'Kore', 'Laomedeia', 'Leda', 'Pulcherrima', 'Sulafat', 
    'Vindemiatrix', 'Zephyr',
    # Male voices
    'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Charon', 'Enceladus', 
    'Fenrir', 'Iapetus', 'Orus', 'Puck', 'Rasalgethi', 'Sadachbia', 
    'Sadaltager', 'Schedar', 'Umbriel', 'Zubenelgenubi'
]

# Map voices to genders (from official Google Cloud TTS documentation)
GEMINI_VOICE_GENDERS = {
    # Female voices
    'Achernar': 'female',
    'Aoede': 'female',
    'Autonoe': 'female',
    'Callirrhoe': 'female',
    'Despina': 'female',
    'Erinome': 'female',
    'Gacrux': 'female',
    'Kore': 'female',
    'Laomedeia': 'female',
    'Leda': 'female',
    'Pulcherrima': 'female',
    'Sulafat': 'female',
    'Vindemiatrix': 'female',
    'Zephyr': 'female',
    # Male voices
    'Achird': 'male',
    'Algenib': 'male',
    'Algieba': 'male',
    'Alnilam': 'male',
    'Charon': 'male',
    'Enceladus': 'male',
    'Fenrir': 'male',
    'Iapetus': 'male',
    'Orus': 'male',
    'Puck': 'male',
    'Rasalgethi': 'male',
    'Sadachbia': 'male',
    'Sadaltager': 'male',
    'Schedar': 'male',
    'Umbriel': 'male',
    'Zubenelgenubi': 'male',
}

# Get voices by gender
GEMINI_FEMALE_VOICES = [v for v, g in GEMINI_VOICE_GENDERS.items() if g == 'female']
GEMINI_MALE_VOICES = [v for v, g in GEMINI_VOICE_GENDERS.items() if g == 'male']

def generate_tts_style_instruction(passage_text: str, passage_name: str = '', selected_region: str = None, formality_choice: str = 'informal', speaker_profile: dict = None) -> str:
    """Generate a style instruction for TTS based on content analysis, dialect, formality, speech rate, and speaker profile
    
    Returns a sentence-long instruction tailored to make the audio unique and engaging.
    Includes speech rate variation, skewed towards faster/colloquial speeds, and speaker characteristics.
    """
    # Extract speaker characteristics if available
    speaker_context = ""
    if speaker_profile:
        age = speaker_profile.get('age', '')
        background = speaker_profile.get('background', '')
        dialect = speaker_profile.get('dialect', '')
        
        # Build speaker context snippet
        age_hint = ""
        if age:
            # Infer age range hints for voice tone
            if any(young in str(age).lower() for young in ['20', '25', '30', 'young']):
                age_hint = "with youthful energy"
            elif any(mid in str(age).lower() for mid in ['35', '40', '45', 'mid']):
                age_hint = "with mature confidence"
            elif any(older in str(age).lower() for older in ['50', '55', '60', 'senior']):
                age_hint = "with experienced wisdom"
        
        background_hint = ""
        if background:
            # Add subtle background context
            background_hint = f"as someone familiar with {background}"
        
        # Combine speaker hints
        speaker_parts = [p for p in [age_hint, background_hint] if p]
        if speaker_parts:
            speaker_context = f", speaking {' and '.join(speaker_parts)}"
    
    # Generate speech rate instruction based on formality and random variation
    # Skewed towards slightly faster/colloquial speeds (how people actually speak)
    if formality_choice == 'informal':
        # For informal: mostly faster speeds (colloquial), some normal
        # Speed options: concise phrases that work well in style instructions
        speed_options = [
            "at a fast conversational pace",
            "at a slightly faster pace",
            "at a brisk pace",
            "at a quick pace",
            "at a natural accelerated pace",
            "at a fast-paced speed",
            "at a quick energetic pace",
            "at a slightly faster conversational speed",
        ]
        # 70% chance of faster speeds, 30% normal-fast
        selected_speed = random.choices(
            speed_options,
            weights=[15, 15, 15, 12, 12, 10, 10, 11]  # Heavily weighted towards faster
        )[0]
    else:
        # For formal: measured but can still vary, slightly slower than informal
        # Speed options: concise phrases
        speed_options = [
            "at a clear measured pace",
            "at a moderate pace",
            "at a slightly slower pace",
            "at a steady pace",
            "at a calm pace",
            "at a normal clear pace",
        ]
        # More balanced distribution for formal, but still some variation
        selected_speed = random.choice(speed_options)
    
    # Analyze content to determine style
    text_lower = (passage_text + ' ' + passage_name).lower()
    
    # Determine tone and style based on keywords (in Kannada)
    style_options = []
    
    if any(word in text_lower for word in ['ಕಥೆ', 'ಕಾದಂಬರಿ', 'ಸಾಹಸ', 'ರೋಮಾಂಚಕ', 'ರಹಸ್ಯ']):
        if formality_choice == 'informal':
            style_options.extend([
                "Expressively narrate with storytelling flair, varying pace naturally like a friend sharing an exciting story.",
                "Use animated, conversational delivery with natural pauses, making the narrative feel engaging and personal.",
                "Speak with casual enthusiasm, bringing characters and events to life through natural vocal expression."
            ])
        else:
            style_options.extend([
                "Narrate with expressive storytelling, varying pace to build suspense and engagement.",
                "Use dramatic pacing with pauses for emphasis, creating an immersive narrative experience.",
                "Speak with animated enthusiasm, bringing characters and events to life through vocal expression."
            ])
    
    if any(word in text_lower for word in ['ವಿಜ್ಞಾನ', 'ತಂತ್ರಜ್ಞಾನ', 'ವಿವರಣೆ', 'ವಿಶ್ಲೇಷಣೆ']):
        if formality_choice == 'informal':
            style_options.extend([
                "Explain clearly and naturally, like teaching a friend, with casual pauses for key points.",
                "Speak conversationally about technical topics, making complex ideas easy to understand.",
                "Use a friendly, approachable tone with natural emphasis on important terms."
            ])
        else:
            style_options.extend([
                "Deliver with clear, measured articulation, emphasizing key concepts with slight pauses.",
                "Speak with professional clarity and confidence, making complex ideas accessible.",
                "Use a calm, informative tone with natural emphasis on important technical terms."
            ])
    
    if any(word in text_lower for word in ['ಆಹಾರ', 'ರುಚಿ', 'ಅಡುಗೆ', 'ಭೋಜನ']):
        if formality_choice == 'informal':
            style_options.extend([
                "Speak warmly and casually about food, like sharing a favorite recipe with a friend.",
                "Use enthusiastic, friendly delivery, naturally emphasizing descriptive words about flavors.",
                "Narrate conversationally, making food descriptions vivid and relatable."
            ])
        else:
            style_options.extend([
                "Speak with warm, inviting tones that evoke the sensory experience of food.",
                "Use enthusiastic and appetizing delivery, emphasizing descriptive words with flavor.",
                "Narrate with a friendly, conversational style that makes culinary descriptions vivid."
            ])
    
    if any(word in text_lower for word in ['ಪ್ರಯಾಣ', 'ಸ್ಥಳ', 'ನಗರ', 'ದೇಶ']):
        if formality_choice == 'informal':
            style_options.extend([
                "Share travel experiences naturally, like telling a friend about an amazing trip, with casual excitement.",
                "Speak with casual enthusiasm about places, making descriptions feel personal and engaging.",
                "Use a friendly, storytelling style with natural pacing for different locations."
            ])
        else:
            style_options.extend([
                "Narrate with a sense of wonder and discovery, varying intonation to highlight destinations.",
                "Speak with adventurous enthusiasm, making geographical descriptions come alive.",
                "Use an engaging travelogue style with expressive pacing for different locations."
            ])
    
    if any(word in text_lower for word in ['ಕುಟುಂಬ', 'ಸ್ನೇಹ', 'ಸಂಬಂಧ', 'ಪ್ರೀತಿ']):
        if formality_choice == 'informal':
            style_options.extend([
                "Speak warmly and casually, like chatting with a close friend about personal moments.",
                "Share heartfelt stories naturally, with genuine emotion and casual pacing.",
                "Use a warm, friendly tone that feels like a personal conversation about relationships."
            ])
        else:
            style_options.extend([
                "Speak with warmth and emotional connection, using gentle pacing for personal moments.",
                "Narrate with heartfelt sincerity, emphasizing emotional depth in relationships.",
                "Use a warm, intimate tone that conveys the closeness and care in relationships."
            ])
    
    # Default styles if no specific match
    if not style_options:
        if formality_choice == 'informal':
            style_options = [
                "Speak naturally and conversationally, like talking to a friend, keeping it engaging and casual.",
                "Use casual pacing with natural emphasis, making it feel like a friendly chat.",
                "Narrate clearly but casually, bringing the content to life through natural expression.",
                "Deliver with a friendly, conversational style that feels natural and relatable.",
                "Speak enthusiastically but casually, using natural pauses to emphasize important points."
            ]
        else:
            style_options = [
                "Speak with natural, engaging delivery that maintains listener interest throughout.",
                "Use varied pacing and emphasis to highlight key points and maintain engagement.",
                "Narrate with clear articulation and expressive intonation that brings the content to life.",
                "Deliver with confident, conversational style that feels natural and compelling.",
                "Speak with enthusiasm and clarity, using pauses strategically to emphasize important information."
            ]
    
    # Add regional dialect instruction
    region_note = ""
    if selected_region:
        # Extract region name for style instruction
        if "ಬೆಂಗಳೂರು" in selected_region or "ಮೈಸೂರು" in selected_region:
            region_note = " with a Bangalore/Mysore regional accent and intonation"
        elif "ಮಂಗಳೂರು" in selected_region:
            region_note = " with a Mangalore regional accent, influenced by Tulu intonation patterns"
        elif "ಹುಬ್ಬಳ್ಳಿ" in selected_region or "ಧಾರವಾಡ" in selected_region:
            region_note = " with a North Karnataka regional accent and intonation"
        elif "ಬೆಳಗಾವಿ" in selected_region:
            region_note = " with a Belagavi regional accent, near the Maharashtra border"
        elif "ಶಿವಮೊಗ್ಗ" in selected_region:
            region_note = " with a Malenadu regional accent and intonation"
        elif "ಮಂಡ್ಯ" in selected_region:
            region_note = " with a rural Mysore region accent and intonation"
        elif "ಚಿತ್ರದುರ್ಗ" in selected_region:
            region_note = " with a Central Karnataka regional accent and intonation"
    
    # Randomly select a style instruction and add speech rate, regional note, and speaker context
    base_style = random.choice(style_options)
    
    # Combine: base style + speech rate + regional note + speaker context
    # Format: "Speak [base_style], [speed_instruction], [region_note][speaker_context]"
    # Make it more concise to avoid overwhelming the TTS API
    combined_style = base_style
    if selected_speed:
        # Add speech rate instruction more naturally
        combined_style = f"{base_style}, speaking {selected_speed}"
    if region_note:
        combined_style = f"{combined_style}{region_note}"
    if speaker_context:
        combined_style = f"{combined_style}{speaker_context}"
    
    # Limit total length to avoid API issues (max ~200 chars for style instruction)
    if len(combined_style) > 200:
        # If too long, prioritize base style and speed, shorten regional note
        if region_note and len(combined_style) > 200:
            # Use shorter regional note
            short_region = region_note.replace(" regional accent and intonation", " accent").replace(" influenced by Tulu intonation patterns", "")
            combined_style = f"{base_style}, speaking {selected_speed}{short_region}" if selected_speed else f"{base_style}{short_region}"
            # Add speaker context if room
            if speaker_context and len(combined_style) + len(speaker_context) <= 200:
                combined_style = f"{combined_style}{speaker_context}"
            # If still too long, just use base style + speed
            if len(combined_style) > 200:
                combined_style = f"{base_style}, speaking {selected_speed}" if selected_speed else base_style
    
    return combined_style


def generate_tts(text: str, language: str = 'kn-IN', voice: str = None, style_instruction: str = None) -> tuple:
    """Generate TTS audio using Gemini 2.5 Flash TTS via google.genai API
    
    Args:
        text: Text to convert to speech (in Kannada script)
        language: Language code (default: 'kn-IN' for Kannada) - not used in new API
        voice: Voice name (if None, randomly selected from GEMINI_TTS_VOICES)
        style_instruction: Optional style instruction for TTS delivery
    
    Returns:
        tuple: (audio_data_dict, voice_used, cost_info)
        audio_data_dict: dict with 'audio_base64' (base64 encoded WAV), 'text', 'voice', 'language', 'response_time'
        cost_info: dict with 'input_characters', 'cost_per_1k_chars', 'total_cost', 'voice_used', 'model', 'response_time'
    """
    if not config.GEMINI_API_KEY:
        return None, None, None
    
    try:
        import time
        # Select voice randomly if not provided
        if voice is None:
            voice = random.choice(GEMINI_TTS_VOICES)
            print(f"[Voice] No voice provided, randomly selected: {voice}")
        else:
            print(f"[Voice] Using provided voice: {voice}")
        
        # Calculate cost (Gemini 2.5 Flash TTS pricing: approximately $4 per 1M characters)
        input_characters = len(text)
        cost_per_1k_chars = 0.004  # $4 per 1M = $0.004 per 1K
        total_cost = (input_characters / 1000) * cost_per_1k_chars
        
        cost_info = {
            'input_characters': input_characters,
            'cost_per_1k_chars': cost_per_1k_chars,
            'total_cost': total_cost,
            'voice_used': voice,
            'model': GEMINI_TTS_MODEL,
            'response_time': 0.0  # Will be updated after TTS call
        }
        
        print(f"TTS Generation (Gemini 2.5 Flash): {input_characters} characters, voice: {voice}, model: {GEMINI_TTS_MODEL}, cost: ${total_cost:.6f}")
        
        # Use google.genai API for Gemini TTS (preferred method)
        if HAS_GOOGLE_GENAI:
            try:
                print(f"Using google.genai API for TTS with model: {GEMINI_TTS_MODEL}, voice: {voice}")
                
                # Prepare text with style instruction if provided
                # Format: "Say [style]: [text]" as shown in the example
                if style_instruction:
                    text_with_style = f"Say {style_instruction.lower()}: {text}"
                    print(f"Applied TTS style instruction: {style_instruction}")
                else:
                    text_with_style = text
                
                # Initialize the genai client
                client = google_genai.Client(api_key=config.GEMINI_API_KEY)
                
                # Track TTS response time
                tts_start_time = time.time()
                
                # Generate audio using Gemini TTS (following the example pattern)
                print(f"[TTS] Calling generate_content with model={GEMINI_TTS_MODEL}, voice={voice}")
                response = client.models.generate_content(
                    model=GEMINI_TTS_MODEL,
                    contents=text_with_style,
                    config=types.GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=types.SpeechConfig(
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                    voice_name=voice,
                                )
                            )
                        ),
                    )
                )
                
                tts_response_time = time.time() - tts_start_time
                print(f"[TTS] Response received in {tts_response_time:.2f}s, checking candidates...")
                
                # Extract audio data from response (following the example)
                if not response.candidates:
                    print(f"[TTS] Error: No candidates in response")
                    raise Exception("No candidates in TTS response")
                
                if not hasattr(response.candidates[0], 'content') or response.candidates[0].content is None:
                    print(f"[TTS] Error: No content in response candidate")
                    raise Exception("No content in TTS response candidate")
                
                if not hasattr(response.candidates[0].content, 'parts') or not response.candidates[0].content.parts:
                    print(f"[TTS] Error: No parts in response content")
                    raise Exception("No audio content in response")
                
                audio_part = response.candidates[0].content.parts[0]
                if not hasattr(audio_part, 'inline_data') or not audio_part.inline_data:
                    raise Exception("No inline_data in audio part")
                
                # Audio data is PCM format (raw audio bytes) - 24kHz, 16-bit, mono
                pcm_data = audio_part.inline_data.data
                audio_size = len(pcm_data)
                
                print(f"TTS Response received: audio size={audio_size} bytes (PCM format)")
                
                if not pcm_data or audio_size < 1000:  # At least 1KB for valid audio
                    raise Exception(f"Generated audio is too short: {audio_size} bytes (expected at least 1000)")
                
                # Convert PCM to WAV format for better browser compatibility
                # WAV header: 44 bytes
                sample_rate = 24000
                channels = 1
                sample_width = 2  # 16-bit
                
                # Create WAV file in memory
                wav_buffer = io.BytesIO()
                # WAV header
                wav_buffer.write(b'RIFF')
                wav_buffer.write(struct.pack('<I', 36 + audio_size))  # File size - 8
                wav_buffer.write(b'WAVE')
                wav_buffer.write(b'fmt ')
                wav_buffer.write(struct.pack('<I', 16))  # fmt chunk size
                wav_buffer.write(struct.pack('<H', 1))  # Audio format (1 = PCM)
                wav_buffer.write(struct.pack('<H', channels))  # Number of channels
                wav_buffer.write(struct.pack('<I', sample_rate))  # Sample rate
                wav_buffer.write(struct.pack('<I', sample_rate * channels * sample_width))  # Byte rate
                wav_buffer.write(struct.pack('<H', channels * sample_width))  # Block align
                wav_buffer.write(struct.pack('<H', sample_width * 8))  # Bits per sample
                wav_buffer.write(b'data')
                wav_buffer.write(struct.pack('<I', audio_size))  # Data chunk size
                wav_buffer.write(pcm_data)  # Audio data
                
                wav_data = wav_buffer.getvalue()
                
                # Encode WAV data as base64 for transmission
                audio_base64 = base64.b64encode(wav_data).decode('utf-8')
                
                print(f"✓ Audio converted to WAV and encoded to base64: {len(audio_base64)} chars from {len(wav_data)} bytes")
                
                audio_data = {
                    'audio_base64': audio_base64,
                    'text': text,
                    'voice': voice,
                    'language': language,
                    'format': 'wav',  # WAV format for browser compatibility
                    'sample_rate': sample_rate,
                    'channels': channels,
                    'sample_width': sample_width,
                    'model': GEMINI_TTS_MODEL,
                    'response_time': tts_response_time,
                    'style_instruction': style_instruction,  # Include for debug
                    'text_with_style': text_with_style if style_instruction else None
                }
                
                cost_info['response_time'] = tts_response_time
                cost_info['style_instruction'] = style_instruction
                cost_info['audio_size_bytes'] = len(wav_data)
                cost_info['audio_base64_length'] = len(audio_base64)
                
                print(f"✓ Generated TTS audio using {GEMINI_TTS_MODEL}: {len(audio_base64)} base64 chars, {len(wav_data)} bytes, time: {tts_response_time:.2f}s")
                return audio_data, voice, cost_info
                
            except Exception as tts_error:
                error_str = str(tts_error)
                print(f"❌ Error with google.genai TTS API: {error_str}")
                import traceback
                traceback.print_exc()
                print("Falling back to text-only mode")
                # Check if it's a quota error
                if '429' in error_str or 'quota' in error_str.lower() or 'RESOURCE_EXHAUSTED' in error_str:
                    print(f"[ERROR] TTS quota exceeded - cannot generate audio")
                audio_data = {
                    'text': text,
                    'voice': voice,
                    'language': language,
                    'format': 'text_only',  # Mark as text-only so caller knows audio failed
                    'model': GEMINI_TTS_MODEL,
                    'response_time': 0.0,
                    'error': error_str  # Include error message for debugging
                }
                cost_info['response_time'] = 0.0
                return audio_data, voice, cost_info
        else:
            # Fallback: return text-only if google.genai is not available
            print("google.genai not available, returning text-only")
            audio_data = {
                'text': text,
                'voice': voice,
                'language': language,
                'format': 'text_only',
                'model': GEMINI_TTS_MODEL,
                'response_time': 0.0
            }
            cost_info['response_time'] = 0.0
            return audio_data, voice, cost_info
        
    except Exception as e:
        print(f"Error generating TTS: {str(e)}")
        import traceback
        traceback.print_exc()
        return None, None, None


async def generate_tts_async(text: str, language: str = 'kn-IN', voice: str = None, style_instruction: str = None, paragraph_index: int = 0) -> tuple:
    """Async wrapper for generate_tts to enable parallel TTS generation
    
    Args:
        text: Text to convert to speech
        language: Language code
        voice: Voice name
        style_instruction: Optional style instruction
        paragraph_index: Index for tracking progress
    
    Returns:
        tuple: (paragraph_index, audio_data_dict, voice_used, cost_info)
    """
    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor() as executor:
        audio_data, voice_used, cost_info = await loop.run_in_executor(
            executor,
            lambda: generate_tts(text, language, voice, style_instruction)
        )
    return paragraph_index, audio_data, voice_used, cost_info


async def generate_all_tts_parallel(paragraphs: list, language: str = 'kn-IN', voice: str = None, style_instruction: str = None, progress_callback=None) -> list:
    """Generate TTS for all paragraphs in parallel using asyncio
    
    Args:
        paragraphs: List of text paragraphs to convert
        language: Language code
        voice: Voice name (same voice for all paragraphs)
        style_instruction: Optional style instruction
        progress_callback: Optional callback function(index, status, result) for progress updates
    
    Returns:
        list: List of tuples (audio_data_dict, voice_used, cost_info) in same order as input paragraphs
    """
    # Create tasks for all paragraphs
    tasks = [
        generate_tts_async(para, language, voice, style_instruction, idx)
        for idx, para in enumerate(paragraphs)
    ]
    
    # Mark all paragraphs as in_progress at start
    if progress_callback:
        print(f"[TTS Parallel] Marking all {len(paragraphs)} paragraphs as 'in_progress'")
        for idx in range(len(paragraphs)):
            progress_callback(idx, 'in_progress', None)
            print(f"[TTS Parallel] Called progress_callback for paragraph {idx}: in_progress")
    
    # Execute all tasks in parallel and gather results
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Sort results by paragraph index and extract data
    output = []
    for idx in range(len(paragraphs)):
        result = results[idx]
        if isinstance(result, Exception):
            # Handle error for this paragraph
            print(f"[TTS Parallel] Error for paragraph {idx}: {str(result)}")
            if progress_callback:
                progress_callback(idx, 'error', str(result))
                print(f"[TTS Parallel] Called progress_callback for paragraph {idx}: error")
            output.append((None, None, None))
        else:
            para_idx, audio_data, voice_used, cost_info = result
            if progress_callback:
                progress_callback(para_idx, 'complete', audio_data)
                print(f"[TTS Parallel] Called progress_callback for paragraph {para_idx}: complete")
            output.append((audio_data, voice_used, cost_info))
    
    return output


def transcribe_audio(audio_data: bytes, language_code: str = 'kn-IN', audio_format: str = None) -> str:
    """Transcribe audio using Google Cloud Speech-to-Text
    
    Args:
        audio_data: Raw audio bytes
        language_code: Google Speech language code (e.g., 'kn-IN')
        audio_format: Optional audio format hint ('wav', 'webm', 'flac', etc.)
    
    Returns:
        Transcribed text or error message
    """
    if not config.GOOGLE_APPLICATION_CREDENTIALS:
        return "Error: GOOGLE_APPLICATION_CREDENTIALS not set"
    
    try:
        client = speech.SpeechClient()
        
        # Determine encoding and sample rate based on format
        # For webm/opus, let Google auto-detect sample rate
        # For wav, we can specify sample rate if known
        if audio_format and audio_format.lower() == 'wav':
            # For WAV files, try to detect sample rate from header
            # Default to 44100 for web recordings, but let Google infer if unsure
            recognition_config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=44100,  # Common for web recordings
                language_code=language_code,
            )
        elif audio_format and audio_format.lower() in ['webm', 'opus']:
            # For WEBM/OPUS, don't specify sample rate - let Google infer from header
            recognition_config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
                language_code=language_code,
                # Don't specify sample_rate_hertz for WEBM_OPUS - let Google infer
            )
        elif audio_format and audio_format.lower() == 'flac':
            recognition_config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.FLAC,
                language_code=language_code,
                # Don't specify sample_rate_hertz for FLAC - let Google infer
            )
        else:
            # Default: try to auto-detect encoding and sample rate
            # Use LINEAR16 as fallback, but don't specify sample rate
            recognition_config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.ENCODING_UNSPECIFIED,
                language_code=language_code,
                # Don't specify sample_rate_hertz - let Google auto-detect
            )
        
        # Check audio size - if larger than ~1MB or longer than 60 seconds, use long_running_recognize
        # Google's limit is 1 minute for synchronous recognition
        audio_size_mb = len(audio_data) / (1024 * 1024)
        
        if audio_size_mb > 1.0:  # If audio is larger than 1MB, likely longer than 1 minute
            # Use long-running recognition for longer audio
            # Need to upload to Google Cloud Storage or use storage_uri
            # For now, we'll try to use the regular method and handle the error
            print(f"Warning: Audio size is {audio_size_mb:.2f} MB, may exceed 1 minute limit")
        
        audio = speech.RecognitionAudio(content=audio_data)
        
        try:
            # Try synchronous recognition first
            response = client.recognize(config=recognition_config, audio=audio)
            
            transcriptions = []
            for result in response.results:
                transcriptions.append(result.alternatives[0].transcript)
            
            return ' '.join(transcriptions) if transcriptions else ""
            
        except Exception as sync_error:
            # If sync fails due to audio being too long, provide helpful error
            error_str = str(sync_error)
            if "too long" in error_str.lower() or "sync input" in error_str.lower():
                return "Error: Audio recording is too long. Please keep recordings under 1 minute."
            else:
                # Re-raise other errors
                raise
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error in transcribe_audio: {error_msg}")
        import traceback
        traceback.print_exc()
        return f"Error transcribing audio: {error_msg}"


# ============================================================================
# Activity Generation Functions
# ============================================================================

def parse_json_response(response_text: str, is_truncated: bool = False) -> dict:
    """Parse JSON response, handling truncation and markdown code blocks"""
    # Handle empty or None response
    if not response_text or not response_text.strip():
        return {
            "_parse_error": "Empty response from API",
            "_raw_response": response_text or ""
        }
    
    # Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
    cleaned_text = response_text.strip()
    original_start = cleaned_text[:50]  # For debugging
    
    # Remove markdown code block markers
    if cleaned_text.startswith('```'):
        # Find the first newline after opening ```
        first_newline = cleaned_text.find('\n')
        if first_newline != -1:
            # Remove opening ```json or ``` and the newline
            cleaned_text = cleaned_text[first_newline + 1:].lstrip()
        else:
            # No newline found, just remove the opening ```
            cleaned_text = cleaned_text[3:].lstrip()
            # Try to remove json/python/etc identifier if present
            if cleaned_text.startswith('json'):
                cleaned_text = cleaned_text[4:].lstrip()
            elif cleaned_text.startswith('python'):
                cleaned_text = cleaned_text[6:].lstrip()
    
    # Remove closing ``` if present
    cleaned_text = cleaned_text.rstrip()
    if cleaned_text.endswith('```'):
        cleaned_text = cleaned_text[:-3].rstrip()
    
    # Additional cleanup: remove any remaining markdown artifacts
    cleaned_text = cleaned_text.strip()
    
    # Strip markdown formatting characters (**, *, backticks, etc.) from the text
    # This helps clean up any markdown that might be in string values
    def strip_markdown_from_strings(obj):
        """Recursively strip markdown from string values in JSON objects"""
        if isinstance(obj, dict):
            return {k: strip_markdown_from_strings(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [strip_markdown_from_strings(item) for item in obj]
        elif isinstance(obj, str):
            # Strip markdown formatting: **bold**, *italic*, `code`, etc.
            text = obj
            # Remove bold (**text**)
            text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
            # Remove italic (*text* or _text_)
            text = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'\1', text)
            text = re.sub(r'_([^_]+)_', r'\1', text)
            # Remove code backticks (`text`)
            text = re.sub(r'`([^`]+)`', r'\1', text)
            # Remove any remaining single asterisks or underscores used for formatting
            text = re.sub(r'(?<!\*)\*(?!\*)', '', text)
            text = re.sub(r'(?<!_)_(?!_)', '', text)
            return text
        return obj
    
    # Debug logging
    if original_start.startswith('```'):
        print(f"[JSON Parse] Stripped markdown block. Original start: {original_start[:30]}...")
        print(f"[JSON Parse] Cleaned start: {cleaned_text[:50]}...")
    
    try:
        parsed_json = json.loads(cleaned_text)
        # Strip markdown from all string values in the parsed JSON
        parsed_json = strip_markdown_from_strings(parsed_json)
        return parsed_json
    except json.JSONDecodeError as e:
        # Always try to fix JSON errors (both truncated and non-truncated)
        error_msg = str(e)
        print(f"JSON parse error: {error_msg}")
        print(f"Attempting to fix JSON...")
        
        # Check if it's an unterminated string error
        is_unterminated_string = "Unterminated string" in error_msg or "Unterminated" in error_msg
        
        fixed_text = cleaned_text
        
        if is_unterminated_string:
            # Find all string positions and check for unterminated ones
            # Strategy: Find the last quote that's not escaped and see if it starts an unterminated string
            quote_positions = []
            i = 0
            while i < len(fixed_text):
                if fixed_text[i] == '"':
                    # Check if it's escaped
                    escape_count = 0
                    j = i - 1
                    while j >= 0 and fixed_text[j] == '\\':
                        escape_count += 1
                        j -= 1
                    if escape_count % 2 == 0:  # Not escaped, this is a real quote
                        quote_positions.append(i)
                i += 1
            
            # If we have an odd number of quotes, the last one starts an unterminated string
            if len(quote_positions) % 2 == 1:
                # Find the last quote position
                last_quote_pos = quote_positions[-1]
                # Check if it's actually part of an unterminated string
                # Look for a colon, comma, or opening brace before it (indicating it's a key or value)
                search_start = max(0, last_quote_pos - 200)  # Look back 200 chars
                context = fixed_text[search_start:last_quote_pos]
                
                # If we see : or , before the quote, it's likely a value that needs closing
                # Close the string by adding a quote at the end (after the last character)
                fixed_text = fixed_text + '"'
                print(f"[JSON Fix] Closed unterminated string starting at position {last_quote_pos}")
        
        # Count unclosed brackets/braces
        open_braces = fixed_text.count('{') - fixed_text.count('}')
        open_brackets = fixed_text.count('[') - fixed_text.count(']')
        
        # Close unclosed structures
        if open_brackets > 0:
            fixed_text += ']' * open_brackets
            print(f"[JSON Fix] Closed {open_brackets} unclosed brackets")
        if open_braces > 0:
            fixed_text += '}' * open_braces
            print(f"[JSON Fix] Closed {open_braces} unclosed braces")
        
        # Try parsing the fixed text
        try:
            parsed_json = json.loads(fixed_text)
            # Strip markdown from all string values in the parsed JSON
            parsed_json = strip_markdown_from_strings(parsed_json)
            print(f"[JSON Fix] Successfully fixed and parsed JSON")
            return parsed_json
        except json.JSONDecodeError as e2:
            print(f"[JSON Fix] Still failed after fixing attempt: {e2}")
            print(f"[JSON Fix] Fixed text preview (first 500 chars): {fixed_text[:500]}")
            
            # Try one more aggressive fix: escape unescaped quotes in string values
            # This is a last resort - try to fix common JSON issues
            try:
                # Find the error position
                error_pos = getattr(e2, 'pos', None)
                if error_pos:
                    # Try to fix quotes around the error position
                    # Look for unescaped quotes in string values (between : and , or })
                    fixed_text2 = fixed_text
                    # Replace unescaped quotes that are inside string values
                    # This is a heuristic: if we see : " followed by text with quotes, escape them
                    # Pattern: find string values and escape quotes inside them
                    # Match: "key": "value with "quotes" here"
                    # Replace inner quotes with escaped quotes
                    def escape_inner_quotes(match):
                        key_part = match.group(1)  # "key":
                        value_start = match.group(2)  # "
                        value_content = match.group(3)  # content
                        value_end = match.group(4)  # "
                        # Escape any unescaped quotes in the content
                        escaped_content = value_content.replace('"', '\\"')
                        return f'{key_part}{value_start}{escaped_content}{value_end}'
                    
                    # Try to fix common pattern: "key": "value with "problematic" quotes"
                    # This regex is more complex, so let's try a simpler approach
                    # Just escape quotes that appear between : " and " (not already escaped)
                    lines = fixed_text2.split('\n')
                    fixed_lines = []
                    in_string = False
                    for i, line in enumerate(lines):
                        if i < len(lines) - 1:  # Not the last line
                            # Check if this line has a colon followed by quote (start of value)
                            if '": "' in line or ': "' in line:
                                # Try to escape quotes in this line that aren't at the start/end
                                # Simple heuristic: if we see "text"text", escape the middle quote
                                fixed_line = re.sub(r'([^\\])"([^",}\]]+)', r'\1\\"\2', line)
                                # But don't escape the first quote after colon
                                fixed_line = re.sub(r'(:\s*)"([^"]*)"', r'\1"\2"', fixed_line)
                                fixed_lines.append(fixed_line)
                            else:
                                fixed_lines.append(line)
                        else:
                            fixed_lines.append(line)
                    
                    fixed_text2 = '\n'.join(fixed_lines)
                    
                    # Try parsing again
                    try:
                        parsed_json = json.loads(fixed_text2)
                        parsed_json = strip_markdown_from_strings(parsed_json)
                        print(f"[JSON Fix] Successfully fixed with aggressive quote escaping")
                        return parsed_json
                    except Exception as inner_e:
                        print(f"[JSON Fix] Inner fix attempt also failed: {inner_e}")
                        # Fall through to final error handling below
            except Exception:
                # If the inner try block fails, fall through to final error handling
                pass
            
            # If all else fails, return partial data with error info
            print(f"JSON parse error (final): {e2}")
            print(f"Response preview (first 1000 chars): {cleaned_text[:1000]}")
            # Try to extract at least the story_name and story fields if possible using regex
            partial_data = {}
            story_name_match = re.search(r'"story_name"\s*:\s*"([^"]*)"', cleaned_text)
            if story_name_match:
                partial_data['story_name'] = story_name_match.group(1)
            
            story_match = re.search(r'"story"\s*:\s*"([^"]*(?:"[^",}]*")*)', cleaned_text, re.DOTALL)
            if story_match:
                # Try to extract the full story (may be multiline)
                story_start = cleaned_text.find('"story"')
                if story_start != -1:
                    # Find the opening quote after story
                    quote_start = cleaned_text.find('"', story_start + 7)
                    if quote_start != -1:
                        # Try to find the closing quote (may span multiple lines)
                        # Look for " followed by , or }
                        quote_end = cleaned_text.find('",', quote_start + 1)
                        if quote_end == -1:
                            quote_end = cleaned_text.find('"}', quote_start + 1)
                        if quote_end != -1:
                            partial_data['story'] = cleaned_text[quote_start + 1:quote_end].replace('\\n', '\n')
            
            if partial_data:
                partial_data['_parse_error'] = str(e2)
                partial_data['_raw_response'] = response_text
                partial_data['_partial_extraction'] = True
                print(f"[JSON Fix] Extracted partial data: {list(partial_data.keys())}")
                return partial_data
            
            return {"_parse_error": str(e2), "_raw_response": response_text}


def generate_speaker_profile(region: str, formality: str, voice: str, language: str = 'kannada') -> dict:
    """Generate a speaker profile using Gemini API based on region, formality, voice, and language
    
    Args:
        region: Regional dialect/variation (e.g., "ಬೆಂಗಳೂರು/ಮೈಸೂರು", "मुंबई/दिल्ली")
        formality: Formality level ("formal" or "informal")
        voice: Voice name used for TTS (used to determine gender)
        language: Target language (kannada, hindi, urdu, tamil, telugu, malayalam, english)
    
    Returns:
        dict with name, gender, age, city, state, country, dialect, background
    """
    # Language-specific defaults for fallback
    language_defaults = {
        'kannada': {
            'male_name': 'ರಾಜೇಶ್',
            'female_name': 'ಪ್ರಿಯಾ',
            'country': 'ಭಾರತ',
            'profession': 'ಸ್ಥಳೀಯ ವೃತ್ತಿಪರ',
            'gender_male': 'ಗಂಡು',
            'gender_female': 'ಹೆಣ್ಣು',
        },
        'hindi': {
            'male_name': 'राजेश',
            'female_name': 'प्रिया',
            'country': 'भारत',
            'profession': 'स्थानीय पेशेवर',
            'gender_male': 'पुरुष',
            'gender_female': 'महिला',
        },
        'urdu': {
            'male_name': 'राजेश',  # Using Devanagari as per project pattern
            'female_name': 'प्रिया',
            'country': 'भारत',
            'profession': 'स्थानीय पेशेवर',
            'gender_male': 'मर्द',
            'gender_female': 'औरत',
        },
        'tamil': {
            'male_name': 'ராஜேஷ்',
            'female_name': 'பிரியா',
            'country': 'இந்தியா',
            'profession': 'உள்ளூர் தொழில்',
            'gender_male': 'ஆண்',
            'gender_female': 'பெண்',
        },
        'telugu': {
            'male_name': 'రాజేష్',
            'female_name': 'ప్రియా',
            'country': 'భారతదేశం',
            'profession': 'స్थానిక వృత్తి',
            'gender_male': 'పురుషుడు',
            'gender_female': 'స్త్రీ',
        },
        'malayalam': {
            'male_name': 'രാജേഷ്',
            'female_name': 'പ്രിയ',
            'country': 'ഇന്ത്യ',
            'profession': 'പ്രാദേശിക പ്രൊഫഷണൽ',
            'gender_male': 'പുരുഷൻ',
            'gender_female': 'സ്ത്രീ',
        },
        'english': {
            'male_name': 'Rajesh',
            'female_name': 'Priya',
            'country': 'India',
            'profession': 'Local Professional',
            'gender_male': 'male',
            'gender_female': 'female',
        }
    }
    
    defaults = language_defaults.get(language, language_defaults['kannada'])
    
    if not config.GEMINI_API_KEY:
        # Fallback if API key not available
        return {
            'name': defaults['male_name'],
            'gender': defaults['gender_male'],
            'age': '25-35',
            'city': region.split('(')[0].strip() if '(' in region else region.split('/')[0].strip(),
            'state': region,
            'country': defaults['country'],
            'dialect': region,
            'background': defaults['profession']
        }
    
    try:
        # Map voice to gender (English format for language-agnostic support)
        voice_lower = (voice or '').lower()
        if any(x in voice_lower for x in ['female', 'woman', 'girl', 'f', 'kore', 'aoede', 'callirrhoe', 'despina', 'erinome', 'gacrux', 'laomedeia', 'leda', 'pulcherrima', 'sulafat', 'vindemiatrix', 'zephyr', 'autonoe']):
            voice_gender = 'female'
        elif any(x in voice_lower for x in ['male', 'man', 'boy', 'm', 'charon', 'fenrir', 'puck', 'achird', 'algenib', 'algieba', 'alnilam', 'enceladus', 'iapetus', 'orus', 'rasalgethi', 'sadachbia', 'sadaltager', 'schedar', 'umbriel', 'zubenelgenubi']):
            voice_gender = 'male'
        else:
            # Default based on common voice patterns
            voice_gender = random.choice(['male', 'female'])
        
        # Language-specific formality instructions
        formality_instructions = {
            'kannada': {
                'formal': "ಔಪಚಾರಿಕ ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡಿ. ಗೌರವಪೂರ್ವಕವಾಗಿ ಮತ್ತು ಸರಿಯಾದ ವ್ಯಾಕರಣದೊಂದಿಗೆ ಪ್ರತಿಕ್ರಿಯಿಸಿ.",
                'informal': "ಅನೌಪಚಾರಿಕ/ಸಾಮಾನ್ಯ ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡಿ. ದಿನನಿತ್ಯದ ಸಂಭಾಷಣೆಯಂತೆ, ಸ್ನೇಹಪರವಾಗಿ ಮತ್ತು ನೈಸರ್ಗಿಕವಾಗಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ."
            },
            'hindi': {
                'formal': "औपचारिक भाषा में बात करें। सम्मानपूर्वक और सही व्याकरण के साथ जवाब दें।",
                'informal': "अनौपचारिक/सामान्य भाषा में बात करें। दैनिक बातचीत की तरह, दोस्ताना और स्वाभाविक रूप से जवाब दें।"
            },
            'urdu': {
                'formal': "رسمی زبان میں بات کریں۔ احترام کے ساتھ اور صحیح گرامر کے ساتھ جواب دیں۔",
                'informal': "غیر رسمی / عام زبان میں بات کریں۔ روزمرہ کی گفتگو کی طرح، دوستانہ اور قدرتی طور پر جواب دیں۔"
            },
            'tamil': {
                'formal': "முறையான மொழியில் பேசுங்கள். மரியாதையுடனும் சரியான இலக்கணத்துடனும் பதிலளியுங்கள்.",
                'informal': "முறைசாரா / சாதாரண மொழியில் பேசுங்கள். தினசரி உரையாடல் போல், நட்புடனும் இயல்பாகவும் பதிலளியுங்கள்."
            },
            'telugu': {
                'formal': "అధికారిక భాషలో మాట్లాడండి. గౌరవంతో మరియు సరైన వ్యాకరణంతో సమాధానం ఇవ్వండి.",
                'informal': "అనధికారిక / సాధారణ భాషలో మాట్లాడండి. రోజువారీ సంభాషణ లాగా, స్నేహపూర్వకంగా మరియు సహజంగా సమాధానం ఇవ్వండి."
            },
            'malayalam': {
                'formal': "ഔപചാരിക ഭാഷയിൽ സംസാരിക്കുക. ബഹുമാനത്തോടെയും ശരിയായ വ്യാകരണത്തോടെയും പ്രതികരിക്കുക.",
                'informal': "അനൗപചാരിക / സാധാരണ ഭാഷയിൽ സംസാരിക്കുക. ദൈനംദിന സംഭാഷണം പോലെ, സൗഹാർദ്ദപരവും സ്വാഭാവികവുമായി പ്രതികരിക്കുക."
            },
            'english': {
                'formal': "Speak in formal language. Respond respectfully and with proper grammar.",
                'informal': "Speak in informal/casual language. Respond like daily conversation, friendly and naturally."
            }
        }
        
        lang_formality = formality_instructions.get(language, formality_instructions['kannada'])
        formality_instruction = lang_formality.get(formality, lang_formality['informal'])
        
        # Convert voice_gender to native script for the template
        voice_gender_native = defaults['gender_male'] if voice_gender == 'male' else defaults['gender_female']
        
        # Generate prompt using template
        prompt = render_template(
            'speaker_profile.txt',
            language=language.capitalize(),
            selected_region=region,
            formality_instruction=formality_instruction,
            formality_level=formality,
            voice_gender=voice_gender_native
        )
        
        # Call Gemini API
        response_text, response_time, token_info, is_truncated, _ = generate_text_with_gemini(prompt)
        
        # Parse JSON response
        result = parse_json_response(response_text, is_truncated)
        
        if "_parse_error" in result:
            # Fallback on parse error
            print(f"Warning: Failed to parse speaker profile JSON: {result['_parse_error']}")
            voice_gender_native = defaults['gender_male'] if voice_gender == 'male' else defaults['gender_female']
            return {
                'name': defaults['male_name'] if voice_gender == 'male' else defaults['female_name'],
                'gender': voice_gender_native,
                'age': '35-45' if formality == 'formal' else '25-35',
                'city': region.split('(')[0].strip() if '(' in region else region.split('/')[0].strip(),
                'state': region,
                'country': defaults['country'],
                'dialect': region,
                'background': defaults['profession'],
                'formality': formality
            }
        
        # Ensure all required fields are present
        # Note: Keep gender as returned by AI (should be in native script now)
        speaker_profile = {
            'name': result.get('name', defaults['male_name'] if voice_gender == 'male' else defaults['female_name']),
            'gender': result.get('gender', voice_gender_native),
            'age': result.get('age', '25-35'),
            'city': result.get('city', region.split('(')[0].strip() if '(' in region else region.split('/')[0].strip()),
            'state': result.get('state', region),
            'country': result.get('country', defaults['country']),
            'dialect': result.get('dialect', region),
            'background': result.get('background', defaults['profession']),
            'formality': result.get('formality', formality)
        }
        
        return speaker_profile
        
    except Exception as e:
        print(f"Error generating speaker profile with Gemini: {str(e)}")
        import traceback
        traceback.print_exc()
        # Fallback on error
        voice_lower = (voice or '').lower()
        if any(x in voice_lower for x in ['female', 'woman', 'girl', 'f', 'kore', 'aoede', 'callirrhoe']):
            voice_gender = 'female'
        elif any(x in voice_lower for x in ['male', 'man', 'boy', 'm', 'charon', 'fenrir', 'puck']):
            voice_gender = 'male'
        else:
            voice_gender = 'male'
        
        voice_gender_native = defaults['gender_male'] if voice_gender == 'male' else defaults['gender_female']
        return {
            'name': defaults['male_name'] if voice_gender == 'male' else defaults['female_name'],
            'gender': voice_gender_native,
            'age': '25-35',
            'city': region.split('(')[0].strip() if '(' in region else region.split('/')[0].strip(),
            'state': region,
            'country': defaults['country'],
            'dialect': region,
            'background': defaults['profession'],
            'formality': formality
        }


def extract_words_from_text(text: str, word_bank: list) -> list:
    """Extract vocabulary words from text"""
    if not text:
        return []
    
    # Extract Kannada words
    kannada_words = re.findall(r'[\u0C80-\u0CFF]+', text)
    unique_words = list(set(kannada_words))
    unique_words.sort(key=len, reverse=True)  # Longer words first
    
    matched_words = []
    matched_ids = set()
    
    for kannada_word in unique_words[:100]:  # Limit to 100
        for word_entry in word_bank:
            if word_entry.get('id') in matched_ids:
                continue
            
            translation = word_entry.get('translation', '').strip()
            variants = translation.split(' /')
            
            for variant in variants:
                variant = variant.strip()
                if kannada_word == variant or kannada_word in variant or variant in kannada_word:
                    matched_words.append(word_entry)
                    matched_ids.add(word_entry.get('id'))
                    break
            
            if word_entry.get('id') in matched_ids:
                break
    
    return matched_words


def generate_reading_activity(word_bank: list, learned_words: list, language: str, required_learning_words: list = None, user_cefr_level: str = 'A1', custom_topic: str = None, user_interests: list = None) -> dict:
    """Generate a reading activity with story and questions
    
    Args:
        word_bank: List of vocabulary words
        learned_words: Legacy parameter (not used)
        language: Language code
        required_learning_words: Words that must be included
        user_cefr_level: User's CEFR level
        custom_topic: Optional custom topic provided by user
        user_interests: List of user's interests from profile
    """
    if not config.GEMINI_API_KEY:
        return None
    
    try:
        # Format word lists
        def format_word_list(words):
            if not words:
                return ""
            return "\n".join([
                f"- {w.get('english_word', '')} ({w.get('translation', '')})"
                for w in words[:50]  # Limit to 50 words
            ])
        
        learned_str = format_word_list([w for w in word_bank if w.get('mastery_level') == 'mastered'][:200])
        required_learning_words = required_learning_words or []
        required_learning_words_str = format_word_list(required_learning_words[:10])
        
        # Determine topic
        if custom_topic:
            # Use user's custom topic
            selected_topic = custom_topic
            print(f"Using custom topic: {custom_topic}")
        else:
            # Pick a random topic, considering user interests if available
            base_topics = [
                "daily life and routines", "travel and adventure", "food and cooking", 
                "technology and modern life", "hobbies and interests", "work and career",
                "nature and environment", "culture and traditions", "family and relationships",
                "education and learning", "health and wellness", "shopping and markets",
                "sports and activities", "music and arts", "cities and places",
                "festivals and celebrations", "weather and seasons", "transportation",
                "entertainment and media", "science and discovery", "history and heritage",
                "art and creativity", "business and economy", "social issues"
            ]
            
            # If user has interests, weight selection toward those interests
            if user_interests and len(user_interests) > 0:
                # Convert interests to potential topics (lowercase for matching)
                interest_topics = [interest.lower() for interest in user_interests]
                
                # Try to find matching topics
                matching_topics = [topic for topic in base_topics if any(interest_word in topic for interest_word in interest_topics)]
                
                if matching_topics:
                    # 70% chance to pick from matching topics, 30% from all topics
                    if random.random() < 0.7:
                        selected_topic = random.choice(matching_topics)
                        print(f"Selected topic based on user interests: {selected_topic}")
                    else:
                        selected_topic = random.choice(base_topics)
                        print(f"Selected random topic (not interest-based): {selected_topic}")
                else:
                    # No matching topics, pick randomly
                    selected_topic = random.choice(base_topics)
                    print(f"No matching interests, selected random topic: {selected_topic}")
            else:
                # No user interests, pick completely randomly
                selected_topic = random.choice(base_topics)
                print(f"No user interests, selected random topic: {selected_topic}")
        
        # Randomly select between fiction and non-fiction
        story_type = random.choice(["fiction", "non-fiction"])
        
        # Build prompt
        type_instruction = f"This should be a {story_type} text."
        if story_type == "fiction":
            type_instruction += " It should tell an engaging story with characters, events, and a narrative arc."
        else:
            type_instruction += " It should describe real experiences, explain concepts, provide information, or narrate actual events in a meaningful and engaging way."
        
        if learned_str:
            learned_section = f"LEARNED WORDS (MASTERED - Use these as the PRIMARY vocabulary):\n{learned_str}"
            usage_instruction = "Use the LEARNED WORDS as your primary vocabulary."
        else:
            learned_section = ""
            usage_instruction = ""
        
        if required_learning_words_str:
            learning_section = f"\n\nMANDATORY LEARNING WORDS (MUST include all of these in the story):\n{required_learning_words_str}"
            learning_instruction = "You MUST include ALL of the MANDATORY LEARNING WORDS naturally in the story. This is required."
        else:
            learning_section = ""
            learning_instruction = ""
        
        # For Urdu activities we want the activity to be authored in Devanagari
        # (so transliteration to Perso-Arabic/Urdu and to Roman can be derived).
        language_for_template = 'Devanagari' if (language and language.lower() == 'urdu') else language
        prompt = render_template(
            'reading_activity.txt',
            language=language,
            language_for_template=language_for_template,
            script_requirement=get_script_requirement(language),
            user_cefr_level=user_cefr_level,
            type_instruction=type_instruction,
            selected_topic=selected_topic,
            learned_section=learned_section,
            learning_section=learning_section,
            usage_instruction=usage_instruction,
            learning_instruction=learning_instruction
        )
        

        # Try up to 2 times to get valid JSON
        max_retries = 2
        result = None
        response_text = None
        response_time = 0
        token_info = {}
        is_truncated = False
        
        for attempt in range(max_retries):
            try:
                response_text, response_time, token_info, is_truncated, _ = generate_text_with_gemini(prompt)
                
                # Parse JSON
                result = parse_json_response(response_text, is_truncated)
                
                if "_parse_error" not in result:
                    # Successfully parsed JSON
                    break
                else:
                    print(f"Attempt {attempt + 1}/{max_retries}: Failed to parse JSON: {result['_parse_error']}")
                    if attempt < max_retries - 1:
                        print(f"Retrying with a new request...")
                        # Add a small delay before retry
                        import time
                        time.sleep(1)
                    else:
                        # Last attempt failed, return error
                        print(f"All {max_retries} attempts failed to parse JSON")
                        return {
                            '_error': f"Failed to parse JSON after {max_retries} attempts: {result.get('_parse_error', 'Unknown error')}",
                            '_error_type': 'json_parse_error',
                            '_parse_error': result.get('_parse_error'),
                            '_raw_response': response_text or '',
                            '_prompt': prompt,
                            '_response_time': response_time,
                            '_token_info': token_info,
                        }
            except Exception as e:
                print(f"Attempt {attempt + 1}/{max_retries}: Error generating reading activity: {str(e)}")
                if attempt < max_retries - 1:
                    import time
                    time.sleep(1)
                else:
                    import traceback
                    traceback.print_exc()
                    return {
                        '_error': f"Error generating reading activity after {max_retries} attempts: {str(e)}",
                        '_error_type': 'generation_error',
                        '_prompt': prompt,
                        '_response_time': response_time,
                        '_token_info': token_info,
                    }
        
        if result is None or "_parse_error" in result:
            return {
                '_error': f"Failed to generate valid JSON: {result.get('_parse_error', 'Unknown error') if result else 'No response'}",
                '_error_type': 'json_parse_error',
                '_parse_error': result.get('_parse_error') if result else 'No response',
                '_raw_response': response_text or '',
                '_prompt': prompt,
                '_response_time': response_time,
                '_token_info': token_info,
            }
        
        # Extract words from story, story_name, and questions
        story_text = result.get('story', '')
        story_name = result.get('story_name', '')
        questions_text = ''
        if result.get('questions'):
            for q in result.get('questions', []):
                if q.get('question'):
                    questions_text += ' ' + q.get('question', '')
                if q.get('options'):
                    for opt in q.get('options', []):
                        if opt:
                            questions_text += ' ' + opt
        
        # Combine all text for word extraction
        all_text = story_text + ' ' + story_name + ' ' + questions_text
        words_used = extract_words_from_text(all_text, word_bank)
        
        # Add debug info
        result['_prompt'] = prompt
        result['_words'] = [w.get('english_word') for w in words_used]
        result['_words_used_data'] = words_used
        result['_response_time'] = response_time
        result['_raw_response'] = response_text
        result['_learned_words'] = [w.get('english_word') for w in word_bank if w.get('mastery_level') == 'mastered'][:10]
        result['_required_learning_words'] = [w.get('english_word') for w in required_learning_words]
        result['_token_info'] = token_info
        result['_parse_error'] = result.get('_parse_error')
        
        return result
        
    except Exception as e:
        print(f"Error generating reading activity: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def generate_listening_activity(word_bank: list, language: str, required_learning_words: list = None, user_cefr_level: str = 'A1', session_id: str = None, progress_store: dict = None, custom_topic: str = None, user_interests: list = None) -> dict:
    """Generate a listening activity with paragraphs and TTS audio
    
    Args:
        word_bank: List of available words
        language: Target language
        required_learning_words: Words that must be used
        user_cefr_level: User's CEFR level
        session_id: Unique session ID for progress tracking
        progress_store: Dictionary to store progress trackers
        custom_topic: Custom topic provided by user
        user_interests: User's interests for topic selection
    """
    if not config.GEMINI_API_KEY:
        return {
            '_error': 'GEMINI_API_KEY not set',
            '_error_type': 'missing_api_key',
            '_prompt': '',
            '_response_time': 0,
            '_raw_response': '',
            '_learned_words': [],
            '_required_learning_words': [],
            '_token_info': {},
        }
    
    try:
        # Language-specific UI labels
        LANGUAGE_LABELS = {
            'Kannada': {
                'learned_label': 'ಕಲಿತ ಪದಗಳು (ಮಾಸ್ಟರ್ ಮಾಡಿದ - ಇವುಗಳನ್ನು ಪ್ರಾಥಮಿಕ ಪದಕೋಶವಾಗಿ ಬಳಸಿ):',
                'learning_label': '\n\nಕಡ್ಡಾಯ ಕಲಿಯುವ ಪದಗಳು (ಎಲ್ಲವನ್ನೂ ಸೇರಿಸಬೇಕು):',
                'usage_instruction': 'ಕಲಿತ ಪದಗಳನ್ನು ನಿಮ್ಮ ಪ್ರಾಥಮಿಕ ಪದಕೋಶವಾಗಿ ಬಳಸಿ.',
                'learning_instruction': 'ನೀವು ಕಡ್ಡಾಯ ಕಲಿಯುವ ಪದಗಳನ್ನು ಎಲ್ಲವನ್ನೂ ನೈಸರ್ಗಿಕವಾಗಿ ಪಠ್ಯದಲ್ಲಿ ಸೇರಿಸಬೇಕು. ಇದು ಅಗತ್ಯವಾಗಿದೆ.',
                'informal_instruction': 'ಅನೌಪಚಾರಿಕ/ಸಾಮಾನ್ಯ ಭಾಷೆಯಲ್ಲಿ ಬರೆಯಿರಿ. ದಿನನಿತ್ಯದ ಸಂಭಾಷಣೆಯಂತೆ, ಸ್ನೇಹಪರವಾಗಿ ಮತ್ತು ನೈಸರ್ಗಿಕವಾಗಿ ಬರೆಯಿರಿ. ಸಾಮಾನ್ಯವಾಗಿ ಬಳಸುವ ಸಂಕ್ಷಿಪ್ತ ರೂಪಗಳು, ಸ್ಥಳೀಯ ಅಭಿವ್ಯಕ್ತಿಗಳು ಮತ್ತು ಸಾಂದರ್ಭಿಕ ಭಾಷೆಯನ್ನು ಬಳಸಿ.',
                'formal_instruction': 'ಔಪಚಾರಿಕ ಭಾಷೆಯಲ್ಲಿ ಬರೆಯಿರಿ. ಗೌರವಪೂರ್ವಕವಾಗಿ ಮತ್ತು ಸರಿಯಾದ ವ್ಯಾಕರಣದೊಂದಿಗೆ ಬರೆಯಿರಿ. ಸಂಪೂರ್ಣ ಪದಗಳು ಮತ್ತು ಸರಿಯಾದ ಸಂಬೋಧನೆಗಳನ್ನು ಬಳಸಿ.'
            },
            'Hindi': {
                'learned_label': 'सीखे हुए शब्द (मास्टर किए गए - इन्हें प्राथमिक शब्दावली के रूप में उपयोग करें):',
                'learning_label': '\n\nअनिवार्य सीखने वाले शब्द (सभी को शामिल करें):',
                'usage_instruction': 'सीखे हुए शब्दों को अपनी प्राथमिक शब्दावली के रूप में उपयोग करें।',
                'learning_instruction': 'आपको अनिवार्य सीखने वाले शब्दों को स्वाभाविक रूप से पाठ में शामिल करना होगा। यह आवश्यक है।',
                'informal_instruction': 'अनौपचारिक/सामान्य भाषा में लिखें। रोजमर्रा की बातचीत की तरह, मित्रवत और स्वाभाविक रूप से लिखें। आमतौर पर इस्तेमाल किए जाने वाले संक्षिप्त रूपों, स्थानीय अभिव्यक्तियों और आकस्मिक भाषा का उपयोग करें।',
                'formal_instruction': 'औपचारिक भाषा में लिखें। सम्मानपूर्वक और सही व्याकरण के साथ लिखें। पूर्ण शब्दों और सही संबोधनों का उपयोग करें।'
            },
            'Urdu': {
                'learned_label': 'سیکھے ہوئے الفاظ (مہارت حاصل کردہ - انہیں بنیادی ذخیرہ الفاظ کے طور پر استعمال کریں):',
                'learning_label': '\n\nلازمی سیکھنے والے الفاظ (سبھی کو شامل کریں):',
                'usage_instruction': 'سیکھے ہوئے الفاظ کو اپنی بنیادی ذخیرہ الفاظ کے طور پر استعمال کریں۔',
                'learning_instruction': 'آپ کو لازمی سیکھنے والے الفاظ کو قدرتی طور پر متن میں شامل کرنا ہوگا۔ یہ ضروری ہے۔',
                'informal_instruction': 'غیر رسمی/عام زبان میں لکھیں۔ روزمرہ کی گفتگو کی طرح، دوستانہ اور قدرتی انداز میں لکھیں۔ عام طور پر استعمال ہونے والی مختصرات، مقامی تاثرات اور آرام دہ زبان استعمال کریں۔',
                'formal_instruction': 'رسمی زبان میں لکھیں۔ احترام کے ساتھ اور صحیح گرامر کے ساتھ لکھیں۔ مکمل الفاظ اور صحیح خطابات استعمال کریں۔'
            },
            # Default fallback (English)
            'default': {
                'learned_label': 'Learned Words (Mastered - use these as primary vocabulary):',
                'learning_label': '\n\nRequired Learning Words (must include all):',
                'usage_instruction': 'Use learned words as your primary vocabulary.',
                'learning_instruction': 'You must naturally incorporate all required learning words into the text. This is mandatory.',
                'informal_instruction': 'Write in informal/casual language. Like everyday conversation, friendly and natural. Use commonly used contractions, local expressions, and casual language.',
                'formal_instruction': 'Write in formal language. Respectfully and with proper grammar. Use complete words and proper forms of address.'
            }
        }
        
        # Get language-specific labels or fall back to default
        labels = LANGUAGE_LABELS.get(language, LANGUAGE_LABELS['default'])
        
        # Format word lists (similar to reading activity)
        def format_word_list(words):
            if not words:
                return ""
            return "\n".join([
                f"- {w.get('english_word', '')} ({w.get('translation', '')})"
                for w in words[:50]
            ])
        
        # Format word lists (translation only for target language)
        def format_word_list_target_language(words):
            if not words:
                return ""
            return "\n".join([
                f"- {w.get('translation', '')}"
                for w in words[:50]
            ])
        
        learned_str = format_word_list_target_language([w for w in word_bank if w.get('mastery_level') == 'mastered'][:200])
        required_learning_words = required_learning_words or []
        required_learning_words_str = format_word_list_target_language(required_learning_words[:10])
        
        # Handle topic selection
        if custom_topic:
            selected_topic = custom_topic
            print(f"[Listening Activity] Using custom topic: {custom_topic}")
        else:
            base_topics = [
                "daily life and routines", "travel and adventure", "food and cooking", 
                "technology and modern life", "hobbies and interests", "work and career",
                "nature and environment", "culture and traditions", "family and relationships",
                "education and learning", "health and wellness", "shopping and markets",
                "sports and activities", "music and arts", "cities and places",
                "festivals and celebrations", "weather and seasons", "transportation",
                "entertainment and media", "science and discovery", "history and heritage",
                "art and creativity", "business and economy", "social issues"
            ]
            
            if user_interests and len(user_interests) > 0:
                interest_topics = [interest.lower() for interest in user_interests]
                matching_topics = [topic for topic in base_topics 
                                  if any(interest_word in topic for interest_word in interest_topics)]
                
                if matching_topics:
                    if random.random() < 0.7:
                        selected_topic = random.choice(matching_topics)
                        print(f"[Listening Activity] Selected topic from user interests: {selected_topic}")
                    else:
                        selected_topic = random.choice(base_topics)
                        print(f"[Listening Activity] Selected random topic (30% chance): {selected_topic}")
                else:
                    selected_topic = random.choice(base_topics)
                    print(f"[Listening Activity] No matching topics, selected random: {selected_topic}")
            else:
                selected_topic = random.choice(base_topics)
                print(f"[Listening Activity] No user interests, selected random topic: {selected_topic}")
        
        # Regional varieties (for language-specific dialects)
        language_regions = {
            'Kannada': [
                "ಬೆಂಗಳೂರು/ಮೈಸೂರು (ಬೆಂಗಳೂರು/ಮೈಸೂರು ಪ್ರದೇಶದ ಉಪಭಾಷೆ)",
                "ಮಂಗಳೂರು (ತುಳು ಪ್ರಭಾವದ ಕನ್ನಡ)",
                "ಹುಬ್ಬಳ್ಳಿ-ಧಾರವಾಡ (ಉತ್ತರ ಕರ್ನಾಟಕದ ಉಪಭಾಷೆ)",
                "ಬೆಳಗಾವಿ (ಮಹಾರಾಷ್ಟ್ರ ಗಡಿಯ ಬಳಿಯ ಕನ್ನಡ)",
                "ಮೈಸೂರು (ದಕ್ಷಿಣ ಕರ್ನಾಟಕದ ಶಾಸ್ತ್ರೀಯ ಕನ್ನಡ)",
                "ಶಿವಮೊಗ್ಗ (ಮಲೆನಾಡು ಪ್ರದೇಶದ ಕನ್ನಡ)",
                "ಮಂಡ್ಯ (ಮೈಸೂರು ಪ್ರದೇಶದ ಗ್ರಾಮೀಣ ಕನ್ನಡ)",
                "ಚಿತ್ರದುರ್ಗ (ಮಧ್ಯ ಕರ್ನಾಟಕದ ಉಪಭಾಷೆ)"
            ],
            'Hindi': [
                'Delhi (Standard Hindi)', 'Mumbai (Bombay Hindi)', 'Lucknow (Awadhi-influenced)', 
                'Kanpur (Eastern UP Hindi)', 'Jaipur (Rajasthani-influenced)', 
                'Bhopal (Malwa Hindi)', 'Agra (Braj-influenced)', 'Varanasi (Bhojpuri-influenced)'
            ],
            'Urdu': [
                'Delhi (Dakhini/Deccani)', 'Lucknow (Lakhnavi Urdu)', 'Hyderabad (Deccani)', 
                'Karachi (Pakistani Urdu)', 'Lahore (Punjabi-influenced)', 
                'Islamabad (Standard Pakistani Urdu)', 'Multan (Multani)', 'Peshawar (Pashto-influenced)'
            ]
        }
        
        selected_region = random.choice(language_regions.get(language, ['General']))
        
        # Randomly select formality level (heavy weightage towards informal: 80% informal, 20% formal)
        formality_choice = random.choices(
            ['informal', 'formal'],
            weights=[80, 20]
        )[0]
        
        # Randomly select preferred gender for speaker (50/50 split)
        preferred_gender = random.choice(['male', 'female'])
        print(f"[Listening Activity] Preferred gender for speaker: {preferred_gender}")
        
        if formality_choice == 'informal':
            formality_instruction = labels['informal_instruction']
        else:
            formality_instruction = labels['formal_instruction']
        
        # Build prompt for listening activity
        if learned_str:
            learned_section = f"{labels['learned_label']}\n{learned_str}"
            usage_instruction = labels['usage_instruction']
        else:
            learned_section = ""
            usage_instruction = ""
        
        if required_learning_words_str:
            learning_section = f"{labels['learning_label']}\n{required_learning_words_str}"
            learning_instruction = labels['learning_instruction']
        else:
            learning_section = ""
            learning_instruction = ""
        
        # For Urdu activities we want the activity to be authored in Devanagari
        # (so transliteration to Perso-Arabic/Urdu and to Roman can be derived from Devanagari).
        # This matches the pattern used in reading activities.
        language_for_template = 'Devanagari' if (language and language.lower() == 'urdu') else language
        
        prompt = render_template(
            'listening_activity.txt',
            language=language,
            language_for_template=language_for_template,
            user_cefr_level=user_cefr_level,
            selected_topic=selected_topic,
            selected_region=selected_region,
            formality_instruction=formality_instruction,
            learned_section=learned_section,
            learning_section=learning_section,
            usage_instruction=usage_instruction,
            learning_instruction=learning_instruction,
            preferred_gender=preferred_gender
        )

        # Initialize debug tracking
        debug_steps = []
        debug_steps.append({'step': 'prompt_generated', 'status': 'success', 'prompt_length': len(prompt), 'topic': selected_topic})
        
        try:
            debug_steps.append({'step': 'calling_gemini_api', 'status': 'in_progress'})
            response_text, response_time, token_info, is_truncated, api_debug_info = generate_text_with_gemini(prompt)
            debug_steps.append({'step': 'gemini_api_response', 'status': 'success', 'details': api_debug_info})
        except Exception as gen_error:
            error_msg = f"Error calling Gemini API: {str(gen_error)}"
            print(error_msg)
            import traceback
            traceback.print_exc()
            return {
                '_error': error_msg,
                '_error_type': 'api_error',
                '_error_traceback': traceback.format_exc(),
                '_prompt': prompt,
                '_response_time': 0,
                '_raw_response': '',
                '_learned_words': [w.get('english_word') for w in word_bank if w.get('mastery_level') == 'mastered'][:10],
                '_required_learning_words': [w.get('english_word') for w in required_learning_words],
                '_token_info': {},
            }
        
        # Check if response is empty
        if not response_text or not response_text.strip():
            return {
                '_error': 'Empty response from Gemini API',
                '_error_type': 'empty_response',
                '_prompt': prompt,
                '_response_time': response_time,
                '_raw_response': response_text or '',
                '_learned_words': [w.get('english_word') for w in word_bank if w.get('mastery_level') == 'mastered'][:10],
                '_required_learning_words': [w.get('english_word') for w in required_learning_words],
                '_token_info': token_info,
            }
        
        # Parse JSON
        result = parse_json_response(response_text, is_truncated)
        
        # Add debug info early so errors are captured
        result['_prompt'] = prompt
        result['_response_time'] = response_time
        result['_raw_response'] = response_text
        result['_learned_words'] = [w.get('english_word') for w in word_bank if w.get('mastery_level') == 'mastered'][:10]
        result['_required_learning_words'] = [w.get('english_word') for w in required_learning_words]
        result['_token_info'] = token_info
        # Store dialect and formality for TTS generation
        result['_selected_region'] = selected_region
        result['_formality_choice'] = formality_choice
        
        if "_parse_error" in result:
            print(f"Failed to parse JSON: {result['_parse_error']}")
            print(f"Raw response (first 1000 chars): {response_text[:1000]}")
            print(f"Raw response (last 500 chars): {response_text[-500:] if len(response_text) > 500 else response_text}")
            result['_error'] = f"JSON parsing failed: {result['_parse_error']}"
            result['_error_type'] = "parse_error"
            debug_steps.append({
                'step': 'json_parse_failed', 
                'status': 'error', 
                'error': result['_parse_error'],
                'raw_response_preview': response_text[:500] if response_text else '',
                'raw_response_end': response_text[-200:] if len(response_text) > 200 else response_text
            })
            result['_debug_steps'] = debug_steps
            return result
        
        # Generate TTS audio for each paragraph
        debug_steps.append({'step': 'extracting_passage', 'status': 'in_progress'})
        passage_text = result.get('passage', '')
        if not passage_text:
            debug_steps.append({'step': 'extracting_passage', 'status': 'error', 'error': 'No passage text in response'})
            result['_error'] = "No passage text in response"
            result['_error_type'] = "missing_passage"
            result['_debug_steps'] = debug_steps
            return result
        
        paragraphs = passage_text.split('\n\n') if passage_text else []
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        
        # Limit to maximum 5 paragraphs
        original_count = len(paragraphs)
        if len(paragraphs) > 5:
            paragraphs = paragraphs[:5]
            print(f"⚠️ Passage had {original_count} paragraphs, limited to 5")
            # Update passage_text to reflect the limited paragraphs
            result['passage'] = '\n\n'.join(paragraphs)
        
        debug_steps.append({'step': 'extracting_passage', 'status': 'success', 'paragraph_count': len(paragraphs), 'passage_length': len(passage_text)})
        
        if not paragraphs:
            debug_steps.append({'step': 'paragraph_validation', 'status': 'error', 'error': 'No paragraphs found'})
            result['_error'] = "No paragraphs found in passage"
            result['_error_type'] = "no_paragraphs"
            result['_debug_steps'] = debug_steps
            return result
        
        # Select voice based on speaker profile gender (if available)
        # Get speaker profile from Gemini response, or fallback to generated one
        speaker_profile = result.get('speaker_profile')
        if not speaker_profile:
            # Fallback: Generate speaker profile if not in response
            speaker_profile = generate_speaker_profile(selected_region, formality_choice, None, language)
        
        # Select voice based on speaker profile gender
        # Gender should now be in English ("male" or "female") for language-agnostic support
        speaker_gender = speaker_profile.get('gender', '').lower()
        speaker_age = speaker_profile.get('age', '')
        
        print(f"[Voice Selection] Speaker profile - Gender: {speaker_gender}, Age: {speaker_age}")
        
        # Normalize gender to English
        if speaker_gender in ['female', 'ಹೆಣ್ಣು', 'महिला', 'औरत', 'பெண்', 'స్త్రీ', 'സ്ത്രീ']:
            available_voices = GEMINI_FEMALE_VOICES
            gender_label = 'female'
            print(f"[Voice Selection] Gender: {speaker_gender} -> Selected female voice pool")
            print(f"[Voice Selection] Available female voices ({len(GEMINI_FEMALE_VOICES)}): {', '.join(GEMINI_FEMALE_VOICES[:5])}...")
        elif speaker_gender in ['male', 'ಗಂಡು', 'पुरुष', 'मर्द', 'ஆண்', 'పురుషుడు', 'പുരുഷൻ']:
            available_voices = GEMINI_MALE_VOICES
            gender_label = 'male'
            print(f"[Voice Selection] Gender: {speaker_gender} -> Selected male voice pool")
            print(f"[Voice Selection] Available male voices ({len(GEMINI_MALE_VOICES)}): {', '.join(GEMINI_MALE_VOICES[:5])}...")
        else:
            # Fallback: random selection from all voices
            available_voices = GEMINI_TTS_VOICES
            gender_label = 'unknown'
            print(f"[Voice Selection] WARNING: Unknown gender '{speaker_gender}' -> Using all voices")
        
        # Select voice from available pool
        selected_voice = random.choice(available_voices)
        print(f"[Voice Selection] FINAL SELECTION: {selected_voice} (gender: {gender_label}, from pool of {len(available_voices)} voices)")
        print(f"[Voice Selection] This voice will be used consistently for ALL paragraphs in this listening activity")
        
        debug_steps.append({
            'step': 'voice_selection',
            'status': 'success',
            'speaker_gender': speaker_gender,
            'speaker_age': speaker_age,
            'selected_voice': selected_voice,
            'voice_gender': GEMINI_VOICE_GENDERS.get(selected_voice, 'unknown'),
            'available_pool_size': len(available_voices)
        })
        
        audio_data_list = []
        total_tts_cost = 0.0
        tts_errors = []
        tts_debug_info = []
        
        # Generate style instruction for TTS based on content, dialect, formality, and speaker profile
        debug_steps.append({'step': 'generating_tts_style', 'status': 'in_progress'})
        style_instruction = generate_tts_style_instruction(
            passage_text, 
            result.get('passage_name', ''),
            selected_region=selected_region,
            formality_choice=formality_choice,
            speaker_profile=speaker_profile
        )
        debug_steps.append({'step': 'generating_tts_style', 'status': 'success', 'style_instruction': style_instruction, 'speaker_profile': speaker_profile})
        
        debug_steps.append({'step': 'tts_generation', 'status': 'in_progress', 'paragraph_count': len(paragraphs), 'selected_voice': selected_voice})
        
        # Get the existing progress tracker for this session
        if session_id and progress_store is not None:
            progress_tracker = progress_store.get(session_id)
            if progress_tracker:
                # Update the tracker if the actual paragraph count differs from the initial estimate
                actual_paragraph_count = len(paragraphs)
                if progress_tracker.total_paragraphs != actual_paragraph_count:
                    print(f"[TTS Progress] Updating tracker from {progress_tracker.total_paragraphs} to {actual_paragraph_count} paragraphs")
                    progress_tracker.total_paragraphs = actual_paragraph_count
                    progress_tracker.progress = {i: 'pending' for i in range(actual_paragraph_count)}
                    # Notify all connected SSE clients about the updated paragraph count
                    for queue in progress_tracker.queues:
                        try:
                            queue.put_nowait({
                                'type': 'update_count',
                                'total_paragraphs': actual_paragraph_count,
                                'progress': progress_tracker.progress.copy()
                            })
                        except:
                            pass
                print(f"[TTS Progress] Using tracker for session {session_id} with {actual_paragraph_count} paragraphs")
            else:
                print(f"[TTS Progress] Warning: No tracker found for session {session_id}")
                progress_tracker = None
        else:
            progress_tracker = None
        
        # Generate TTS for all paragraphs in parallel using asyncio
        print(f"Starting parallel TTS generation for {len(paragraphs)} paragraphs...")
        tts_start_time = time.time()
        
        # Track progress for each paragraph
        tts_progress = {}
        def progress_callback(idx, status, result):
            tts_progress[idx] = {'status': status, 'result': result}
            print(f"[TTS Progress] Paragraph {idx + 1}: {status}")
            
            # Update progress tracker for SSE clients
            if progress_tracker:
                print(f"[TTS Progress] Updating tracker for session {session_id}, paragraph {idx}: {status}")
                progress_tracker.update(idx, status)
                print(f"[TTS Progress] Tracker updated. Current progress: {progress_tracker.progress}")
            else:
                print(f"[TTS Progress] WARNING: No progress_tracker available for updates")
        
        # Run parallel TTS generation
        try:
            print(f"[Voice Consistency Check] Starting parallel TTS generation with voice: {selected_voice}")
            print(f"[Voice Consistency Check] This voice will be used for all {len(paragraphs)} paragraphs")
            
            # Map language names to Google TTS language codes
            language_code_map = {
                'kannada': 'kn-IN',
                'hindi': 'hi-IN',
                'urdu': 'ur-PK',
                'tamil': 'ta-IN',
                'telugu': 'te-IN',
                'malayalam': 'ml-IN',
                'english': 'en-US'
            }
            language_code = language_code_map.get(language.lower(), 'kn-IN')
            print(f"[Language] Using language code: {language_code} for language: {language}")
            
            tts_results = asyncio.run(generate_all_tts_parallel(
                paragraphs,
                language=language_code,
                voice=selected_voice,
                style_instruction=style_instruction,
                progress_callback=progress_callback
            ))
        except Exception as parallel_error:
            print(f"[TTS Parallel] Error in parallel generation: {str(parallel_error)}")
            # Fallback to sequential if parallel fails
            print("[TTS Parallel] Falling back to sequential generation...")
            
            # Map language names to Google TTS language codes
            language_code_map = {
                'kannada': 'kn-IN',
                'hindi': 'hi-IN',
                'urdu': 'ur-PK',
                'tamil': 'ta-IN',
                'telugu': 'te-IN',
                'malayalam': 'ml-IN',
                'english': 'en-US'
            }
            language_code = language_code_map.get(language.lower(), 'kn-IN')
            
            tts_results = []
            for idx, para in enumerate(paragraphs):
                try:
                    audio_data, voice_used, cost_info = generate_tts(para, language=language_code, voice=selected_voice, style_instruction=style_instruction)
                    tts_results.append((audio_data, voice_used, cost_info))
                except Exception as e:
                    tts_results.append((None, None, None))
        
        total_tts_time = time.time() - tts_start_time
        print(f"✓ Parallel TTS generation completed in {total_tts_time:.2f}s (vs ~{sum([r[2].get('response_time', 0) if r[2] else 0 for r in tts_results]):.2f}s sequential)")
        
        # Process results
        audio_data_list = []
        total_tts_cost = 0.0
        total_tts_response_time = 0.0
        tts_errors = []
        tts_debug_info = []
        
        for idx, (audio_data, voice_used, cost_info) in enumerate(tts_results):
            para_debug = {
                'paragraph_index': idx + 1,
                'paragraph_length': len(paragraphs[idx]),
                'paragraph_preview': paragraphs[idx][:100] + '...' if len(paragraphs[idx]) > 100 else paragraphs[idx],
                'paragraph_text': paragraphs[idx],  # Full text for debug
            }
            
            if audio_data and cost_info:
                # Track TTS response time
                if cost_info.get('response_time'):
                    total_tts_response_time += cost_info.get('response_time', 0.0)
                
                para_debug['tts_api_call'] = {
                    'model': GEMINI_TTS_MODEL,
                    'voice': voice_used,
                    'language_code': language_code,
                    'style_instruction': cost_info.get('style_instruction'),
                    'input_characters': cost_info.get('input_characters', 0),
                    'cost_per_1k_chars': cost_info.get('cost_per_1k_chars', 0.0),
                    'total_cost': cost_info.get('total_cost', 0.0),
                    'response_time': cost_info.get('response_time', 0.0),
                }
                
                para_debug['tts_result'] = {
                    'has_audio_data': audio_data is not None,
                    'format': audio_data.get('format') if audio_data else None,
                    'audio_base64_length': len(audio_data.get('audio_base64', '')) if audio_data else 0,
                    'audio_size_bytes': cost_info.get('audio_size_bytes', 0),
                    'sample_rate': audio_data.get('sample_rate') if audio_data else None,
                    'channels': audio_data.get('channels') if audio_data else None,
                    'voice_used': voice_used,
                }
                
                if audio_data.get('format') != 'text_only':
                    audio_data_list.append(audio_data)
                    total_tts_cost += cost_info.get('total_cost', 0.0)
                    para_debug['status'] = 'success'
                    debug_steps.append({'step': f'tts_paragraph_{idx + 1}', 'status': 'success', 'details': para_debug})
                else:
                    error_msg = f"Paragraph {idx + 1}: TTS generation failed or returned text-only"
                    tts_errors.append(error_msg)
                    para_debug['status'] = 'failed'
                    para_debug['error'] = error_msg
                    para_debug['tts_error_details'] = audio_data.get('error', 'Unknown error') if audio_data else None
                    debug_steps.append({'step': f'tts_paragraph_{idx + 1}', 'status': 'failed', 'details': para_debug})
            else:
                error_msg = f"Paragraph {idx + 1}: TTS generation returned None"
                tts_errors.append(error_msg)
                para_debug['status'] = 'error'
                para_debug['error'] = error_msg
                debug_steps.append({'step': f'tts_paragraph_{idx + 1}', 'status': 'error', 'details': para_debug})
            
            tts_debug_info.append(para_debug)
        
        debug_steps.append({
            'step': 'tts_generation_complete',
            'status': 'success' if audio_data_list else 'error',
            'total_paragraphs': len(paragraphs),
            'successful_tts': len(audio_data_list),
            'failed_tts': len(tts_errors),
            'total_time': total_tts_time,
            'tts_details': tts_debug_info,
        })
        
        # Speaker profile should already be set above when selecting voice
        # Store it in result if not already there
        if 'speaker_profile' not in result:
            result['_speaker_profile'] = speaker_profile
        
        # Store TTS results and errors
        result['_audio_data'] = audio_data_list
        result['_voice_used'] = selected_voice
        result['_tts_cost'] = total_tts_cost
        result['_tts_response_time'] = total_tts_response_time
        result['_speaker_profile'] = speaker_profile
        
        if tts_errors:
            result['_tts_errors'] = tts_errors
            result['_warning'] = f"Some TTS generation failed: {len(tts_errors)}/{len(paragraphs)} paragraphs"
            print(f"Warning: TTS errors occurred: {tts_errors}")
        
        if not audio_data_list:
            debug_steps.append({'step': 'tts_validation', 'status': 'error', 'error': 'All TTS generation failed'})
            result['_error'] = "All TTS generation failed"
            result['_error_type'] = "tts_failure"
            result['_tts_errors'] = tts_errors
            result['_debug_steps'] = debug_steps
            return result
        
        debug_steps.append({'step': 'activity_complete', 'status': 'success'})
        result['_debug_steps'] = debug_steps
        
        return result
        
    except Exception as e:
        error_msg = f"Error generating listening activity: {str(e)}"
        print(error_msg)
        import traceback
        traceback_str = traceback.format_exc()
        traceback.print_exc()
        
        # Return error info instead of None
        return {
            '_error': error_msg,
            '_error_type': 'exception',
            '_error_traceback': traceback_str,
            '_prompt': prompt if 'prompt' in locals() else '',
            '_response_time': response_time if 'response_time' in locals() else 0,
            '_raw_response': response_text if 'response_text' in locals() else '',
            '_learned_words': [w.get('english_word') for w in word_bank if w.get('mastery_level') == 'mastered'][:10] if 'word_bank' in locals() else [],
            '_required_learning_words': [w.get('english_word') for w in required_learning_words] if 'required_learning_words' in locals() else [],
            '_token_info': token_info if 'token_info' in locals() else {},
        }


def generate_writing_activity(word_bank: list, language: str, required_learning_words: list = None, user_cefr_level: str = 'A1', custom_topic: str = None, user_interests: list = None) -> dict:
    """Generate a writing activity with detailed prompt and criteria"""
    if not config.GEMINI_API_KEY:
        return {
            '_error': 'GEMINI_API_KEY not set',
            '_error_type': 'missing_api_key',
            '_prompt': '',
            '_response_time': 0,
            '_raw_response': '',
            '_required_learning_words': [],
            '_token_info': {},
        }
    
    # Initialize debug tracking
    debug_steps = []
    
    try:
        # Format required words (extract translations in target language)
        required_learning_words = required_learning_words or []
        required_words_target_lang = [w.get('translation', '').split(' /')[0].strip() for w in required_learning_words[:10]]
        
        # Handle topic selection
        if custom_topic:
            selected_topic = custom_topic
            print(f"Using custom topic: {custom_topic}")
        else:
            # Pick a random topic (ensures unique theme each time)
            base_topics = [
                "daily life and routines", "travel and adventure", "food and cooking", 
                "technology and modern life", "hobbies and interests", "work and career",
                "nature and environment", "culture and traditions", "family and relationships",
                "education and learning", "health and wellness", "shopping and markets",
                "sports and activities", "music and arts", "cities and places",
                "festivals and celebrations", "weather and seasons", "transportation",
                "entertainment and media", "science and discovery", "history and heritage",
                "art and creativity", "business and economy", "social issues"
            ]
            
            # If user has interests, use weighted selection
            if user_interests and len(user_interests) > 0:
                interest_topics = [interest.lower() for interest in user_interests]
                matching_topics = [topic for topic in base_topics 
                                  if any(interest_word in topic for interest_word in interest_topics)]
                
                if matching_topics:
                    # 70% chance to pick from matching topics, 30% from all
                    if random.random() < 0.7:
                        selected_topic = random.choice(matching_topics)
                        print(f"Selected topic from user interests: {selected_topic}")
                    else:
                        selected_topic = random.choice(base_topics)
                        print(f"Selected random topic (30% chance): {selected_topic}")
                else:
                    selected_topic = random.choice(base_topics)
                    print(f"No matching topics, selected random: {selected_topic}")
            else:
                selected_topic = random.choice(base_topics)
                print(f"No user interests, selected random topic: {selected_topic}")
        
        # Select a unique rubric focus to vary the writing skills emphasized (random each time)
        rubric_focuses = [
            {
                "focus": "creativity_and_imagination",
                "description": "Focus on creative expression, vivid descriptions, and imaginative storytelling. Emphasize originality and engaging narrative style.",
                "skills": ["creativity", "vivid descriptions", "narrative flow", "originality", "engagement"]
            },
            {
                "focus": "precision_and_accuracy",
                "description": "Focus on grammatical precision, word choice accuracy, and clear communication. Emphasize correctness and clarity.",
                "skills": ["grammatical accuracy", "precise word usage", "clarity", "correctness", "technical precision"]
            },
            {
                "focus": "complexity_and_depth",
                "description": "Focus on using complex sentence structures, advanced vocabulary, and deeper analysis. Emphasize sophistication and depth of thought.",
                "skills": ["complex sentences", "advanced vocabulary", "analytical thinking", "sophistication", "depth"]
            },
            {
                "focus": "coherence_and_organization",
                "description": "Focus on logical flow, clear structure, and well-organized ideas. Emphasize how ideas connect and build upon each other.",
                "skills": ["logical flow", "structure", "organization", "coherence", "idea connections"]
            },
            {
                "focus": "naturalness_and_fluency",
                "description": "Focus on natural language use, conversational flow, and authentic expression. Emphasize how native-like the writing feels.",
                "skills": ["natural expression", "fluency", "authenticity", "conversational style", "native-like usage"]
            },
            {
                "focus": "detail_and_specificity",
                "description": "Focus on providing specific details, concrete examples, and thorough explanations. Emphasize completeness and specificity.",
                "skills": ["specific details", "concrete examples", "thoroughness", "completeness", "specificity"]
            },
            {
                "focus": "persuasion_and_argumentation",
                "description": "Focus on building arguments, using persuasive language, and supporting claims. Emphasize logical reasoning and convincing expression.",
                "skills": ["argumentation", "persuasive language", "logical reasoning", "supporting evidence", "convincing expression"]
            },
            {
                "focus": "emotion_and_expression",
                "description": "Focus on emotional expression, tone variation, and expressive language. Emphasize how feelings and attitudes are conveyed.",
                "skills": ["emotional expression", "tone variation", "expressive language", "feeling conveyance", "attitude"]
            }
        ]
        
        selected_focus = random.choice(rubric_focuses)
        
        # Get language-specific general guidelines (3 sentences)
        general_guidelines = WRITING_GUIDELINES.get(language, WRITING_GUIDELINES['english'])
        
        prompt = render_template(
            'writing_activity.txt',
            language=language,
            script_requirement=get_script_requirement(language),
            user_cefr_level=user_cefr_level,
            selected_topic=selected_topic,
            required_words_list=', '.join(required_words_target_lang),
            required_words_json=json.dumps(required_words_target_lang)
        )

        debug_steps.append({'step': 'prompt_generated', 'status': 'success', 'prompt_length': len(prompt), 'topic': selected_topic})
        
        try:
            debug_steps.append({'step': 'calling_gemini_api', 'status': 'in_progress'})
            response_text, response_time, token_info, is_truncated, api_debug_info = generate_text_with_gemini(prompt)
            debug_steps.append({'step': 'gemini_api_response', 'status': 'success', 'details': api_debug_info})
        except Exception as gen_error:
            error_msg = f"Error calling Gemini API: {str(gen_error)}"
            print(error_msg)
            import traceback
            error_traceback = traceback.format_exc()
            debug_steps.append({'step': 'gemini_api_error', 'status': 'error', 'error': error_msg, 'traceback': error_traceback})
            return {
                '_error': error_msg,
                '_error_type': 'api_error',
                '_error_traceback': error_traceback,
                '_prompt': prompt,
                '_response_time': 0,
                '_raw_response': '',
                '_required_learning_words': [w.get('english_word') for w in required_learning_words],
                '_token_info': {},
                '_debug_steps': debug_steps,
            }
        
        # Parse JSON
        debug_steps.append({'step': 'parsing_json', 'status': 'in_progress'})
        result = parse_json_response(response_text, is_truncated)
        
        if "_parse_error" in result:
            error_msg = f"JSON parsing failed: {result['_parse_error']}"
            print(error_msg)
            debug_steps.append({'step': 'json_parse_error', 'status': 'error', 'error': error_msg, 'raw_response_preview': response_text[:500]})
            return {
                '_error': error_msg,
                '_error_type': 'parse_error',
                '_prompt': prompt,
                '_response_time': response_time,
                '_raw_response': response_text,
                '_required_learning_words': [w.get('english_word') for w in required_learning_words],
                '_token_info': token_info,
                '_parse_error': result.get('_parse_error'),
                '_debug_steps': debug_steps,
            }
        
        debug_steps.append({'step': 'json_parsed', 'status': 'success', 'has_writing_prompt': 'writing_prompt' in result})
        
        # Add general guidelines (predetermined rubric)
        result['_general_guidelines'] = general_guidelines
        
        # Add debug info
        result['_prompt'] = prompt
        result['_response_time'] = response_time
        result['_raw_response'] = response_text
        result['_required_learning_words'] = [w.get('english_word') for w in required_learning_words]
        result['_token_info'] = token_info
        result['_parse_error'] = result.get('_parse_error')
        result['_debug_steps'] = debug_steps
        
        return result
        
    except Exception as e:
        error_msg = f"Error generating writing activity: {str(e)}"
        print(error_msg)
        import traceback
        error_traceback = traceback.format_exc()
        traceback.print_exc()
        debug_steps.append({'step': 'general_error', 'status': 'error', 'error': error_msg, 'traceback': error_traceback})
        return {
            '_error': error_msg,
            '_error_type': 'general_error',
            '_error_traceback': error_traceback,
            '_prompt': prompt if 'prompt' in locals() else '',
            '_response_time': 0,
            '_raw_response': '',
            '_required_learning_words': [w.get('english_word') for w in required_learning_words] if 'required_learning_words' in locals() else [],
            '_token_info': {},
            '_debug_steps': debug_steps,
        }


def generate_speaking_activity(word_bank: list, language: str, required_learning_words: list = None, user_cefr_level: str = 'A1', custom_topic: str = None, user_interests: list = None) -> dict:
    """Generate a speaking activity with topic and instructions"""
    if not config.GEMINI_API_KEY:
        return {
            '_error': 'GEMINI_API_KEY not set',
            '_error_type': 'missing_api_key',
            '_prompt': '',
            '_response_time': 0,
            '_raw_response': '',
            '_required_learning_words': [],
            '_token_info': {},
        }
    
    # Initialize debug tracking
    debug_steps = []
    
    try:
        # Handle topic selection
        if custom_topic:
            selected_topic = custom_topic
            print(f"Using custom topic: {custom_topic}")
        else:
            base_topics = [
                "daily life and routines", "travel and adventure", "food and cooking", 
                "technology and modern life", "hobbies and interests", "work and career",
                "nature and environment", "culture and traditions", "family and relationships",
                "education and learning", "health and wellness", "shopping and markets",
                "sports and activities", "music and arts", "cities and places",
                "festivals and celebrations", "weather and seasons", "transportation",
                "entertainment and media", "science and discovery", "history and heritage",
                "art and creativity", "business and economy", "social issues"
            ]
            
            if user_interests and len(user_interests) > 0:
                interest_topics = [interest.lower() for interest in user_interests]
                matching_topics = [topic for topic in base_topics 
                                  if any(interest_word in topic for interest_word in interest_topics)]
                
                if matching_topics:
                    if random.random() < 0.7:
                        selected_topic = random.choice(matching_topics)
                        print(f"Selected topic from user interests: {selected_topic}")
                    else:
                        selected_topic = random.choice(base_topics)
                        print(f"Selected random topic (30% chance): {selected_topic}")
                else:
                    selected_topic = random.choice(base_topics)
                    print(f"No matching topics, selected random: {selected_topic}")
            else:
                selected_topic = random.choice(base_topics)
                print(f"No user interests, selected random topic: {selected_topic}")
        
        # Format word lists (Kannada only - minimize English)
        def format_word_list_kannada(words):
            if not words:
                return ""
            return "\n".join([
                f"- {w.get('translation', '')}"
                for w in words[:50]
            ])
        
        learned_str = format_word_list_kannada([w for w in word_bank if w.get('mastery_level') == 'mastered'][:200])
        required_learning_words = required_learning_words or []
        required_learning_words_str = format_word_list_kannada(required_learning_words[:10])
        
        if learned_str:
            learned_section = f"ಕಲಿತ ಪದಗಳು (ಮಾಸ್ಟರ್ ಮಾಡಿದ - ಇವುಗಳನ್ನು ಪ್ರಾಥಮಿಕ ಪದಕೋಶವಾಗಿ ಬಳಸಿ):\n{learned_str}"
            usage_instruction = "ಕಲಿತ ಪದಗಳನ್ನು ನಿಮ್ಮ ಪ್ರಾಥಮಿಕ ಪದಕೋಶವಾಗಿ ಬಳಸಿ."
        else:
            learned_section = ""
            usage_instruction = ""
        
        if required_learning_words_str:
            learning_section = f"\n\nಕಡ್ಡಾಯ ಕಲಿಯುವ ಪದಗಳು (ಎಲ್ಲವನ್ನೂ ಸೇರಿಸಬೇಕು):\n{required_learning_words_str}"
            learning_instruction = "ನೀವು ಕಡ್ಡಾಯ ಕಲಿಯುವ ಪದಗಳನ್ನು ಎಲ್ಲವನ್ನೂ ನೈಸರ್ಗಿಕವಾಗಿ ವಿಷಯದಲ್ಲಿ ಸೇರಿಸಬೇಕು. ಇದು ಅಗತ್ಯವಾಗಿದೆ."
        else:
            learning_section = ""
            learning_instruction = ""
        
        prompt = render_template(
            'speaking_activity.txt',
            language=language,
            script_requirement=get_script_requirement(language),
            user_cefr_level=user_cefr_level,
            selected_topic=selected_topic,
            learned_section=learned_section,
            learning_section=learning_section,
            usage_instruction=usage_instruction,
            learning_instruction=learning_instruction
        )

        debug_steps.append({'step': 'prompt_generated', 'status': 'success', 'prompt_length': len(prompt), 'topic': selected_topic})
        
        try:
            debug_steps.append({'step': 'calling_gemini_api', 'status': 'in_progress'})
            response_text, response_time, token_info, is_truncated, api_debug_info = generate_text_with_gemini(prompt)
            debug_steps.append({'step': 'gemini_api_response', 'status': 'success', 'details': api_debug_info})
        except Exception as gen_error:
            error_msg = f"Error calling Gemini API: {str(gen_error)}"
            print(error_msg)
            import traceback
            error_traceback = traceback.format_exc()
            debug_steps.append({'step': 'gemini_api_error', 'status': 'error', 'error': error_msg, 'traceback': error_traceback})
            return {
                '_error': error_msg,
                '_error_type': 'api_error',
                '_error_traceback': error_traceback,
                '_prompt': prompt,
                '_response_time': 0,
                '_raw_response': '',
                '_required_learning_words': [w.get('english_word') for w in required_learning_words],
                '_token_info': {},
                '_debug_steps': debug_steps,
            }
        
        # Parse JSON
        debug_steps.append({'step': 'parsing_json', 'status': 'in_progress'})
        result = parse_json_response(response_text, is_truncated)
        
        if "_parse_error" in result:
            error_msg = f"JSON parsing failed: {result['_parse_error']}"
            print(error_msg)
            debug_steps.append({'step': 'json_parse_error', 'status': 'error', 'error': error_msg, 'raw_response_preview': response_text[:500]})
            return {
                '_error': error_msg,
                '_error_type': 'parse_error',
                '_prompt': prompt,
                '_response_time': response_time,
                '_raw_response': response_text,
                '_required_learning_words': [w.get('english_word') for w in required_learning_words],
                '_token_info': token_info,
                '_parse_error': result.get('_parse_error'),
                '_debug_steps': debug_steps,
            }
        
        debug_steps.append({'step': 'json_parsed', 'status': 'success', 'has_topic': 'topic' in result, 'has_instructions': 'instructions' in result})
        
        # Extract words from topic and instructions for dictionary
        # For now, use required_learning_words as words_used_data
        # The frontend will handle word extraction from the displayed text
        words_used = []
        for word_obj in required_learning_words:
            words_used.append({
                "id": word_obj.get("id", 0),
                "word": word_obj.get("english_word", ""),
                "kannada": word_obj.get("translation", ""),
                "transliteration": word_obj.get("transliteration", ""),
                "word_class": word_obj.get("word_class", ""),
                "level": word_obj.get("level", ""),
                "mastery_level": word_obj.get("mastery_level", "new"),
                "verb_transitivity": word_obj.get("verb_transitivity", ""),
            })
        
        # Add required_words (Kannada translations) to result for frontend display
        required_words_kannada = [w.get('translation', '').split(' /')[0].strip() for w in required_learning_words[:10]]
        result['required_words'] = required_words_kannada
        
        # Add general guidelines (similar to writing activity)
        general_guidelines = [
            "ನೀಡಲಾದ ಎಲ್ಲಾ ಅನಿವಾರ್ಯ ಪದಗಳನ್ನು ಬಳಸಬೇಕು ಮತ್ತು ಸಾಧ್ಯವಾದಷ್ಟು ಕಲಿತ ಮತ್ತು ಕಲಿಯುತ್ತಿರುವ ಪದಗಳನ್ನು ಸಹೃದಯವಾಗಿ ಬಳಸಬೇಕು.",
            "ವ್ಯಾಕರಣದ ನಿಖರತೆ, ಪದಗಳ ಸರಿಯಾದ ಬಳಕೆ, ಮತ್ತು ಸ್ಪಷ್ಟತೆಯನ್ನು ಕಾಪಾಡಿಕೊಳ್ಳಬೇಕು.",
            "ಭಾಷಣವು ಸಂಬಂಧಿತವಾಗಿರಬೇಕು, ಸ್ಪಷ್ಟವಾಗಿರಬೇಕು, ಮತ್ತು ಪೂರ್ಣವಾಗಿರಬೇಕು.",
            "ಕಾರ್ಯಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಬೇಕು ಮತ್ತು ನೀಡಲಾದ ವಿಷಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದಂತೆ ಮಾತನಾಡಬೇಕು."
        ]
        result['_general_guidelines'] = general_guidelines
        
        # Add debug info
        result['_prompt'] = prompt
        result['_response_time'] = response_time
        result['_raw_response'] = response_text
        result['_required_learning_words'] = [w.get('english_word') for w in required_learning_words]
        result['_learned_words'] = [w.get('english_word') for w in word_bank if w.get('mastery_level') == 'mastered'][:10]
        result['_token_info'] = token_info
        result['_parse_error'] = result.get('_parse_error')
        result['_debug_steps'] = debug_steps
        result['_words_used_data'] = words_used
        result['_words'] = [w.get('english_word') for w in words_used]
        
        return result
        
    except Exception as e:
        error_msg = f"Error generating speaking activity: {str(e)}"
        print(error_msg)
        import traceback
        error_traceback = traceback.format_exc()
        traceback.print_exc()
        debug_steps.append({'step': 'general_error', 'status': 'error', 'error': error_msg, 'traceback': error_traceback})
        return {
            '_error': error_msg,
            '_error_type': 'general_error',
            '_error_traceback': error_traceback,
            '_prompt': prompt if 'prompt' in locals() else '',
            '_response_time': 0,
            '_raw_response': '',
            '_required_learning_words': [w.get('english_word') for w in required_learning_words] if 'required_learning_words' in locals() else [],
            '_token_info': {},
            '_debug_steps': debug_steps,
        }


def generate_translation_activity(
    target_language: str,
    target_level: str,
    source_languages: list,
    source_language_levels: dict,
    sentences_per_language: dict,
    custom_topic: str = None
) -> dict:
    """Generate a translation activity with sentences from other languages"""
    if not config.GEMINI_API_KEY:
        return {
            '_error': 'GEMINI_API_KEY not set',
            '_error_type': 'missing_api_key',
            '_prompt': '',
            '_response_time': 0,
            '_raw_response': '',
            '_token_info': {},
        }
    
    # Mapping of language codes to native script names
    LANGUAGE_NATIVE_NAMES = {
        'hindi': 'हिंदी',
        'telugu': 'తెలుగు',
        'kannada': 'ಕನ್ನಡ',
        'tamil': 'தமிழ்',
        'urdu': 'اردو',
        'bengali': 'বাংলা',
        'marathi': 'मराठी',
        'gujarati': 'ગુજરાતી',
        'malayalam': 'മലയാളം',
        'punjabi': 'ਪੰਜਾਬੀ',
        'english': 'English',
        'spanish': 'Español',
        'french': 'Français',
        'german': 'Deutsch',
        'italian': 'Italiano',
        'portuguese': 'Português',
        'russian': 'Русский',
        'japanese': '日本語',
        'korean': '한국어',
        'chinese': '中文',
        'arabic': 'العربية',
    }
    
    try:
        # Handle topic selection
        if custom_topic:
            selected_topic = custom_topic
            print(f"Using custom topic: {custom_topic}")
        else:
            base_topics = [
                "daily life and routines", "travel and adventure", "food and cooking", 
                "technology and modern life", "hobbies and interests", "work and career",
                "nature and environment", "culture and traditions", "family and relationships",
                "education and learning", "health and wellness", "shopping and markets"
            ]
            selected_topic = random.choice(base_topics)
            print(f"Selected random topic: {selected_topic}")
        
        # Build source language descriptions
        source_lang_descriptions = []
        for lang in source_languages:
            count = sentences_per_language.get(lang, 0)
            level = source_language_levels.get(lang, 'A1')
            display_name = lang.replace('_', ' ').title()
            source_lang_descriptions.append(
                f"- {display_name}: {count} sentences at {level} level"
            )
        
        source_languages_text = "\n".join(source_lang_descriptions)
        
        # Create prompt for translation activity
        prompt = render_template(
            'translation_activity.txt',
            target_language=target_language,
            target_script_requirement=get_script_requirement(target_language),
            target_level=target_level,
            source_languages_text=source_languages_text,
            selected_topic=selected_topic,
            total_sentences=sum(sentences_per_language.values())
        )
        
        print(f"Generated translation activity prompt for {target_language}")
        
        # Call Gemini API
        try:
            response_text, response_time, token_info, is_truncated, api_debug_info = generate_text_with_gemini(prompt)
        except Exception as gen_error:
            error_msg = f"Error calling Gemini API: {str(gen_error)}"
            print(error_msg)
            import traceback
            traceback.print_exc()
            return {
                '_error': error_msg,
                '_error_type': 'api_error',
                '_prompt': prompt,
                '_response_time': 0,
                '_raw_response': '',
                '_token_info': {},
            }
        
        # Parse JSON response
        result = parse_json_response(response_text, is_truncated)
        
        if "_parse_error" in result:
            error_msg = f"JSON parsing failed: {result['_parse_error']}"
            print(error_msg)
            return {
                '_error': error_msg,
                '_error_type': 'parse_error',
                '_parse_error': result['_parse_error'],
                '_prompt': prompt,
                '_response_time': response_time,
                '_raw_response': response_text,
                '_token_info': token_info,
            }
        
        # Post-process sentences to ensure language_display is in native script
        if result.get('sentences'):
            for sentence in result['sentences']:
                lang_code = sentence.get('language', '').lower()
                # If language_display is missing or in English, replace with native name
                if lang_code in LANGUAGE_NATIVE_NAMES:
                    sentence['language_display'] = LANGUAGE_NATIVE_NAMES[lang_code]
                    print(f"Set language_display for {lang_code} to {LANGUAGE_NATIVE_NAMES[lang_code]}")
                elif not sentence.get('language_display'):
                    # Fallback: capitalize language code
                    sentence['language_display'] = lang_code.title()
                
                # Validate transliteration: check if it's the same as original text (common AI mistake)
                original_text = sentence.get('text', '')
                transliteration = sentence.get('transliteration', '')
                
                # If transliteration exists and matches the original text, it's likely wrong
                if transliteration and transliteration.strip() == original_text.strip():
                    print(f"WARNING: Transliteration matches original text for {lang_code}, clearing it: {transliteration[:50]}")
                    sentence['transliteration'] = ''
                
                # Check if transliteration contains non-Latin characters (another common mistake)
                if transliteration:
                    # Check for common non-Latin scripts
                    has_devanagari = bool(re.search(r'[\u0900-\u097F]', transliteration))
                    has_telugu = bool(re.search(r'[\u0C00-\u0C7F]', transliteration))
                    has_kannada = bool(re.search(r'[\u0C80-\u0CFF]', transliteration))
                    has_malayalam = bool(re.search(r'[\u0D00-\u0D7F]', transliteration))
                    has_tamil = bool(re.search(r'[\u0B80-\u0BFF]', transliteration))
                    has_arabic = bool(re.search(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]', transliteration))
                    has_bengali = bool(re.search(r'[\u0980-\u09FF]', transliteration))
                    
                    if any([has_devanagari, has_telugu, has_kannada, has_malayalam, has_tamil, has_arabic, has_bengali]):
                        print(f"WARNING: Transliteration for {lang_code} contains non-Latin characters, clearing it: {transliteration[:50]}")
                        sentence['transliteration'] = ''
                    
                    # Additional check: verify transliteration is mostly Latin characters
                    # Allow basic Latin (a-z, A-Z), diacritics, spaces, and common punctuation
                    latin_pattern = re.compile(r'^[a-zA-Z\u0100-\u017F\u1E00-\u1EFF\s\'\-\.]+$')
                    if not latin_pattern.match(transliteration):
                        # Check what percentage is non-Latin
                        total_chars = len(transliteration.replace(' ', ''))
                        if total_chars > 0:
                            latin_chars = len(re.findall(r'[a-zA-Z\u0100-\u017F\u1E00-\u1EFF]', transliteration))
                            latin_percentage = (latin_chars / total_chars) * 100
                            if latin_percentage < 80:  # If less than 80% Latin, it's probably wrong
                                print(f"WARNING: Transliteration for {lang_code} is only {latin_percentage:.0f}% Latin characters, clearing it: {transliteration[:50]}")
                                sentence['transliteration'] = ''
        
        # Add metadata
        result['id'] = f"translation_{target_language}_{int(time.time())}"
        result['activity_type'] = 'translation'
        result['language'] = target_language
        result['_prompt'] = prompt
        result['_response_time'] = response_time
        result['_raw_response'] = response_text
        result['_token_info'] = token_info
        
        return result
        
    except Exception as e:
        error_msg = f"Error generating translation activity: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        return {
            '_error': error_msg,
            '_error_type': 'general_error',
            '_prompt': prompt if 'prompt' in locals() else '',
            '_response_time': 0,
            '_raw_response': '',
            '_token_info': {},
        }


def grade_writing_activity(user_text: str, writing_prompt: str, required_words: list, evaluation_criteria: str, language: str, learned_words: list = None, learning_words: list = None, user_cefr_level: str = 'A1') -> dict:
    """Grade a writing activity using Gemini 2.5 Flash"""
    if not config.GEMINI_API_KEY:
        return None
    
    try:
        # Format learning context for Gemini
        learned_context = ""
        learning_context = ""
        if learned_words:
            learned_list = [w.get('english_word', '') for w in learned_words[:20]]
            learned_context = f"\nUser's learned/mastered words (use these as reference for appropriate level): {', '.join(learned_list)}"
        if learning_words:
            learning_list = [w.get('english_word', '') for w in learning_words[:20]]
            learning_context = f"\nUser's learning/review words (encourage usage of these): {', '.join(learning_list)}"
        
        prompt = render_template(
            'writing_grading.txt',
            language=language,
            script_requirement=get_script_requirement(language),
            user_cefr_level=user_cefr_level,
            writing_prompt=writing_prompt,
            user_text=user_text,
            required_words_list=', '.join(required_words),
            learned_context=learned_context,
            learning_context=learning_context,
            evaluation_criteria=evaluation_criteria
        )

        response_text, response_time, token_info, is_truncated, _ = generate_text_with_gemini(prompt)
        
        # Validate response_text
        if response_text is None:
            return {
                "_error": "Failed to generate response from Gemini API. Response text is None.",
                "_error_type": "APIError",
                "_prompt": prompt,
                "_response_time": response_time or 0,
                "_token_info": token_info or {},
            }
        
        if not response_text.strip():
            return {
                "_error": "Empty response from Gemini API.",
                "_error_type": "APIError",
                "_prompt": prompt,
                "_response_time": response_time or 0,
                "_token_info": token_info or {},
            }
        
        # Parse JSON
        result = parse_json_response(response_text, is_truncated)
        
        if "_parse_error" in result:
            print(f"Failed to parse JSON: {result['_parse_error']}")
            print(f"Raw response (first 500 chars): {response_text[:500]}")
            # Return error details instead of None so frontend can display them
            return {
                "_parse_error": result['_parse_error'],
                "_raw_response": response_text,
                "_prompt": prompt,
                "_response_time": response_time,
                "_token_info": token_info,
            }
        
        # Add debug info
        result['_prompt'] = prompt
        result['_response_time'] = response_time
        result['_raw_response'] = response_text
        result['_token_info'] = token_info
        result['_parse_error'] = result.get('_parse_error')
        
        return result
        
    except Exception as e:
        print(f"Error grading writing activity: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return error details instead of None
        return {
            "_error": str(e),
            "_error_type": type(e).__name__,
            "_prompt": prompt if 'prompt' in locals() else "",
            "_response_time": response_time if 'response_time' in locals() else 0,
            "_token_info": token_info if 'token_info' in locals() else {},
        }


def grade_translation_activity(translations: list, target_language: str, user_cefr_level: str = 'A1') -> dict:
    """Grade a translation activity using Gemini 2.5 Flash"""
    if not config.GEMINI_API_KEY:
        return None
    
    try:
        # Format translations for the prompt
        translations_text = []
        for i, trans in enumerate(translations, 1):
            translations_text.append(
                f"{i}. Source ({trans['source_language']}): {trans['source_text']}\n"
                f"   User translation: {trans['user_translation']}\n"
                f"   Expected translation: {trans['expected_translation']}"
            )
        
        translations_formatted = "\n\n".join(translations_text)
        
        prompt = render_template(
            'translation_grading.txt',
            target_language=target_language,
            target_script_requirement=get_script_requirement(target_language),
            user_cefr_level=user_cefr_level,
            translations_formatted=translations_formatted,
            num_sentences=len(translations)
        )
        
        # Call Gemini API
        response_text, response_time, token_info, is_truncated, api_debug_info = generate_text_with_gemini(prompt)
        
        # Parse JSON response
        result = parse_json_response(response_text, is_truncated)
        
        if "_parse_error" in result:
            print(f"JSON parse error: {result['_parse_error']}")
            return {
                "_error": "Failed to parse grading response",
                "_parse_error": result["_parse_error"],
                "_prompt": prompt,
                "_response_time": response_time,
                "_raw_response": response_text,
                "_token_info": token_info,
            }
        
        # Add metadata
        result["_prompt"] = prompt
        result["_response_time"] = response_time
        result["_raw_response"] = response_text
        result["_token_info"] = token_info
        
        return result
        
    except Exception as e:
        print(f"Error grading translation activity: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "_error": str(e),
            "_error_type": type(e).__name__,
            "_prompt": prompt if 'prompt' in locals() else "",
            "_response_time": response_time if 'response_time' in locals() else 0,
            "_token_info": token_info if 'token_info' in locals() else {},
        }


def grade_speaking_activity(user_transcript: str, speaking_topic: str, tasks: list, required_words: list, language: str, learned_words: list = None, learning_words: list = None, user_cefr_level: str = 'A1') -> dict:
    """Grade a speaking activity using Gemini 2.5 Flash"""
    if not config.GEMINI_API_KEY:
        return None
    
    try:
        # Format learning context for Gemini
        learned_context = ""
        learning_context = ""
        if learned_words:
            learned_list = [w.get('english_word', '') for w in learned_words[:20]]
            learned_context = f"\nUser's learned/mastered words (use these as reference for appropriate level): {', '.join(learned_list)}"
        if learning_words:
            learning_list = [w.get('english_word', '') for w in learning_words[:20]]
            learning_context = f"\nUser's learning/review words (encourage usage of these): {', '.join(learning_list)}"
        
        # Format tasks list
        tasks_list = '\n'.join([f"- {task}" for task in tasks]) if tasks else ""
        
        prompt = render_template(
            'speaking_grading.txt',
            language=language,
            script_requirement=get_script_requirement(language),
            user_cefr_level=user_cefr_level,
            speaking_topic=speaking_topic,
            tasks_list=tasks_list,
            user_transcript=user_transcript,
            required_words_list=', '.join(required_words),
            learned_context=learned_context,
            learning_context=learning_context
        )

        response_text, response_time, token_info, is_truncated, _ = generate_text_with_gemini(prompt)
        
        # Validate response_text
        if response_text is None:
            return {
                "_error": "Failed to generate response from Gemini API. Response text is None.",
                "_error_type": "APIError",
                "_prompt": prompt,
                "_response_time": response_time or 0,
                "_token_info": token_info or {},
            }
        
        if not response_text.strip():
            return {
                "_error": "Empty response from Gemini API.",
                "_error_type": "APIError",
                "_prompt": prompt,
                "_response_time": response_time or 0,
                "_token_info": token_info or {},
            }
        
        # Parse JSON
        result = parse_json_response(response_text, is_truncated)
        
        if "_parse_error" in result:
            print(f"Failed to parse JSON: {result['_parse_error']}")
            print(f"Raw response (first 500 chars): {response_text[:500]}")
            return {
                "_parse_error": result['_parse_error'],
                "_raw_response": response_text,
                "_prompt": prompt,
                "_response_time": response_time,
                "_token_info": token_info,
            }
        
        # Validate and ensure scores are present and non-zero if feedback exists
        if result.get('feedback') and len(result.get('feedback', '')) > 50:
            # If we have substantial feedback, ensure we have reasonable scores
            if not result.get('score') or result.get('score') == 0:
                # Calculate from component scores or use a default
                component_scores = [
                    result.get('vocabulary_score', 0),
                    result.get('grammar_score', 0),
                    result.get('fluency_score', 0),
                    result.get('task_completion_score', 0)
                ]
                non_zero_scores = [s for s in component_scores if s and s > 0]
                if non_zero_scores:
                    result['score'] = sum(non_zero_scores) / len(non_zero_scores)
                    print(f"[DEBUG] Calculated overall score from components: {result['score']}")
                else:
                    result['score'] = 50
                    print(f"[DEBUG] All scores were 0 despite having feedback, using fallback: 50")
            
            # Ensure component scores exist
            for score_key in ['vocabulary_score', 'grammar_score', 'fluency_score', 'task_completion_score']:
                if not result.get(score_key) or result.get(score_key) == 0:
                    result[score_key] = result.get('score', 50)
                    print(f"[DEBUG] Missing {score_key}, using overall score: {result[score_key]}")
        
        # Add debug info
        result['_prompt'] = prompt
        result['_response_time'] = response_time
        result['_raw_response'] = response_text
        result['_token_info'] = token_info
        result['_parse_error'] = result.get('_parse_error')
        
        return result
        
    except Exception as e:
        print(f"Error grading speaking activity: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "_error": str(e),
            "_error_type": type(e).__name__,
            "_prompt": prompt if 'prompt' in locals() else "",
            "_response_time": response_time if 'response_time' in locals() else 0,
            "_token_info": token_info if 'token_info' in locals() else {},
        }


def grade_speaking_activity_with_audio(audio_data: bytes, audio_format: str, speaking_topic: str, tasks: list, required_words: list, language: str, learned_words: list = None, learning_words: list = None, user_cefr_level: str = 'A1') -> dict:
    """Grade a speaking activity using Gemini 2.5 Flash with direct audio input"""
    import tempfile
    import os
    
    if not config.GEMINI_API_KEY:
        return None
    
    try:
        # Format learning context for Gemini
        learned_context = ""
        learning_context = ""
        if learned_words:
            learned_list = [w.get('english_word', '') for w in learned_words[:20]]
            learned_context = f"\nUser's learned/mastered words (use these as reference for appropriate level): {', '.join(learned_list)}"
        if learning_words:
            learning_list = [w.get('english_word', '') for w in learning_words[:20]]
            learning_context = f"\nUser's learning/review words (encourage usage of these): {', '.join(learning_list)}"
        
        # Format tasks list
        tasks_list = '\n'.join([f"- {task}" for task in tasks]) if tasks else ""
        
        # Create prompt for audio grading
        prompt = render_template(
            'speaking_grading.txt',
            language=language,
            script_requirement=get_script_requirement(language),
            user_cefr_level=user_cefr_level,
            speaking_topic=speaking_topic,
            tasks_list=tasks_list,
            user_transcript="[AUDIO INPUT - Listen to the user's spoken response]",
            required_words_list=', '.join(required_words),
            learned_context=learned_context,
            learning_context=learning_context
        )
        
        # Save audio to temporary file
        file_extension = audio_format if audio_format else 'webm'
        with tempfile.NamedTemporaryFile(suffix=f'.{file_extension}', delete=False) as temp_audio:
            temp_audio.write(audio_data)
            temp_audio_path = temp_audio.name
        
        try:
            # Upload audio file to Gemini with explicit audio mime type
            # This prevents Gemini from trying to process it as video
            mime_type_map = {
                'webm': 'audio/webm',
                'wav': 'audio/wav',
                'mp3': 'audio/mpeg',
                'ogg': 'audio/ogg',
                'flac': 'audio/flac',
                'm4a': 'audio/mp4',
            }
            mime_type = mime_type_map.get(file_extension.lower(), 'audio/webm')
            
            print(f"Uploading audio file ({len(audio_data)} bytes) for grading...")
            print(f"File extension: {file_extension}, MIME type: {mime_type}")
            uploaded_file = genai.upload_file(temp_audio_path, mime_type=mime_type)
            print(f"Audio uploaded: {uploaded_file.name}")
            
            # Wait for file to be processed
            import time
            max_wait = 60  # 60 seconds max wait
            wait_time = 0
            while uploaded_file.state.name == "PROCESSING" and wait_time < max_wait:
                print(f"Waiting for audio processing... ({wait_time}s)")
                time.sleep(2)
                wait_time += 2
                uploaded_file = genai.get_file(uploaded_file.name)
            
            print(f"Audio file state after processing: {uploaded_file.state.name}")
            
            if uploaded_file.state.name == "FAILED":
                error_detail = getattr(uploaded_file, 'error', 'Unknown error')
                print(f"Audio file processing failed with error: {error_detail}")
                return {
                    "_error": f"Audio file processing failed: {error_detail}",
                    "_error_type": "FileProcessingError",
                    "_prompt": prompt,
                }
            
            # Generate content with audio + text prompt
            model = genai.GenerativeModel(GEMINI_MODEL)
            
            start_time = time.time()
            response = model.generate_content(
                [uploaded_file, prompt],
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=8192,  # Increased from 4096 to handle longer transcripts and feedback
                )
            )
            response_time = time.time() - start_time
            
            # Get token usage
            token_info = {}
            if hasattr(response, 'usage_metadata'):
                usage = response.usage_metadata
                token_info = {
                    'prompt_tokens': usage.prompt_token_count,
                    'output_tokens': usage.candidates_token_count,
                    'total_tokens': usage.total_token_count,
                    'input_cost': (usage.prompt_token_count / 1_000_000) * 0.00015,  # $0.15 per 1M input tokens
                    'output_cost': (usage.candidates_token_count / 1_000_000) * 0.0006,  # $0.60 per 1M output tokens
                    'total_cost': ((usage.prompt_token_count / 1_000_000) * 0.00015) + ((usage.candidates_token_count / 1_000_000) * 0.0006),
                }
            
            response_text = response.text
            is_truncated = False
            
            # Clean up uploaded file
            try:
                genai.delete_file(uploaded_file.name)
                print(f"Deleted uploaded file: {uploaded_file.name}")
            except:
                pass
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_audio_path):
                os.unlink(temp_audio_path)
        
        # Validate response_text
        if response_text is None:
            return {
                "_error": "Failed to generate response from Gemini API. Response text is None.",
                "_error_type": "APIError",
                "_prompt": prompt,
                "_response_time": response_time or 0,
                "_token_info": token_info or {},
            }
        
        if not response_text.strip():
            return {
                "_error": "Empty response from Gemini API.",
                "_error_type": "APIError",
                "_prompt": prompt,
                "_response_time": response_time or 0,
                "_token_info": token_info or {},
            }
        
        # Parse JSON
        result = parse_json_response(response_text, is_truncated)
        
        if "_parse_error" in result:
            print(f"Failed to parse JSON: {result['_parse_error']}")
            print(f"Raw response (first 500 chars): {response_text[:500]}")
            return {
                "_parse_error": result['_parse_error'],
                "_raw_response": response_text,
                "_prompt": prompt,
                "_response_time": response_time,
                "_token_info": token_info,
            }
        
        # Debug: Log the parsed scores (speaking activity with audio)
        print(f"[DEBUG] Parsed grading scores from AI (audio grading):")
        print(f"  - score: {result.get('score')}")
        print(f"  - vocabulary_score: {result.get('vocabulary_score')}")
        print(f"  - grammar_score: {result.get('grammar_score')}")
        print(f"  - fluency_score: {result.get('fluency_score')}")
        print(f"  - task_completion_score: {result.get('task_completion_score')}")
        print(f"  - feedback length: {len(result.get('feedback', ''))}")
        print(f"  - user_transcript length: {len(result.get('user_transcript', ''))}")
        
        # Validate and ensure scores are present and non-zero if feedback exists
        # Sometimes the AI provides feedback but returns 0 scores - this is incorrect
        if result.get('feedback') and len(result.get('feedback', '')) > 50:
            # If we have substantial feedback, ensure we have reasonable scores
            if not result.get('score') or result.get('score') == 0:
                # Calculate from component scores or use a default
                component_scores = [
                    result.get('vocabulary_score', 0),
                    result.get('grammar_score', 0),
                    result.get('fluency_score', 0),
                    result.get('task_completion_score', 0)
                ]
                non_zero_scores = [s for s in component_scores if s and s > 0]
                if non_zero_scores:
                    result['score'] = sum(non_zero_scores) / len(non_zero_scores)
                    print(f"[DEBUG] Calculated overall score from components: {result['score']}")
                else:
                    # If all scores are 0 but we have feedback, set a reasonable default
                    result['score'] = 50  # Middle-range score as fallback
                    print(f"[DEBUG] All scores were 0 despite having feedback, using fallback: 50")
            
            # Ensure component scores exist
            for score_key in ['vocabulary_score', 'grammar_score', 'fluency_score', 'task_completion_score']:
                if not result.get(score_key) or result.get(score_key) == 0:
                    result[score_key] = result.get('score', 50)
                    print(f"[DEBUG] Missing {score_key}, using overall score: {result[score_key]}")
        
        # Add debug info
        result['_prompt'] = prompt
        result['_response_time'] = response_time
        result['_raw_response'] = response_text
        result['_token_info'] = token_info
        result['_parse_error'] = result.get('_parse_error')
        
        return result
        
    except Exception as e:
        print(f"Error grading speaking activity with audio: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "_error": str(e),
            "_error_type": type(e).__name__,
            "_prompt": prompt if 'prompt' in locals() else "",
            "_response_time": response_time if 'response_time' in locals() else 0,
            "_token_info": token_info if 'token_info' in locals() else {},
        }


def generate_conversation_activity(words: list, language: str, user_cefr_level: str = 'A1', custom_topic: str = None, user_interests: list = None) -> dict:
    """Generate a conversation activity with topic and tasks
    
    Args:
        words: List of vocabulary words to use
        language: Language code
        user_cefr_level: User's CEFR level
        custom_topic: Custom topic provided by user
        user_interests: User's interests for topic selection
    
    Returns:
        dict with topic, tasks, speaker profile, and initial setup
    """
    if not config.GEMINI_API_KEY:
        return {
            '_error': 'GEMINI_API_KEY not set',
            '_error_type': 'missing_api_key',
        }
    
    try:
        # Format words for context (target language translation)
        words_context = "\n".join([
            f"- {w.get('translation', '')}"
            for w in words[:20]
        ])
        
        # Handle topic selection
        if custom_topic:
            topic = custom_topic
            print(f"Using custom topic: {custom_topic}")
        else:
            base_topics = [
                "daily life and routines", "travel and adventure", "food and cooking", 
                "technology and modern life", "hobbies and interests", "work and career",
                "nature and environment", "culture and traditions", "family and relationships",
                "education and learning", "health and wellness", "shopping and markets",
                "sports and activities", "music and arts", "cities and places",
                "festivals and celebrations", "weather and seasons", "transportation",
                "entertainment and media", "science and discovery", "history and heritage",
                "art and creativity", "business and economy", "social issues"
            ]
            
            if user_interests and len(user_interests) > 0:
                interest_topics = [interest.lower() for interest in user_interests]
                matching_topics = [topic for topic in base_topics 
                                  if any(interest_word in topic for interest_word in interest_topics)]
                
                if matching_topics:
                    if random.random() < 0.7:
                        topic = random.choice(matching_topics)
                        print(f"Selected topic from user interests: {topic}")
                    else:
                        topic = random.choice(base_topics)
                        print(f"Selected random topic (30% chance): {topic}")
                else:
                    topic = random.choice(base_topics)
                    print(f"No matching topics, selected random: {topic}")
            else:
                topic = random.choice(base_topics)
                print(f"No user interests, selected random topic: {topic}")
        
        # Language-specific regional varieties (for language-agnostic support)
        language_regions = {
            'Kannada': [
                "ಬೆಂಗಳೂರು/ಮೈಸೂರು (ಬೆಂಗಳೂರು/ಮೈಸೂರು ಪ್ರದೇಶದ ಉಪಭಾಷೆ)",
                "ಮಂಗಳೂರು (ತುಳು ಪ್ರಭಾವದ ಕನ್ನಡ)",
                "ಹುಬ್ಬಳ್ಳಿ-ಧಾರವಾಡ (ಉತ್ತರ ಕರ್ನಾಟಕದ ಉಪಭಾಷೆ)",
                "ಬೆಳಗಾವಿ (ಮಹಾರಾಷ್ಟ್ರ ಗಡಿಯ ಬಳಿಯ ಕನ್ನಡ)",
                "ಮೈಸೂರು (ದಕ್ಷಿಣ ಕರ್ನಾಟಕದ ಶಾಸ್ತ್ರೀಯ ಕನ್ನಡ)",
                "ಶಿವಮೊಗ್ಗ (ಮಲೆನಾಡು ಪ್ರದೇಶದ ಕನ್ನಡ)",
                "ಮಂಡ್ಯ (ಮೈಸೂರು ಪ್ರದೇಶದ ಗ್ರಾಮೀಣ ಕನ್ನಡ)",
                "ಚಿತ್ರದುರ್ಗ (ಮಧ್ಯ ಕರ್ನಾಟಕದ ಉಪಭಾಷೆ)"
            ],
            'Hindi': [
                'Delhi (Standard Hindi)', 'Mumbai (Bombay Hindi)', 'Lucknow (Awadhi-influenced)', 
                'Kanpur (Eastern UP Hindi)', 'Jaipur (Rajasthani-influenced)', 
                'Bhopal (Malwa Hindi)', 'Agra (Braj-influenced)', 'Varanasi (Bhojpuri-influenced)'
            ],
            'Urdu': [
                'Delhi (Dakhini/Deccani)', 'Lucknow (Lakhnavi Urdu)', 'Hyderabad (Deccani)', 
                'Karachi (Pakistani Urdu)', 'Lahore (Punjabi-influenced)', 
                'Islamabad (Standard Pakistani Urdu)', 'Multan (Multani)', 'Peshawar (Pashto-influenced)'
            ],
            'Tamil': [
                'Chennai (Madras Tamil)', 'Coimbatore (Kongu Tamil)', 'Madurai (Madurai Tamil)',
                'Thanjavur (Thanjavur Tamil)', 'Tirunelveli (Southern Tamil)', 'Trichy (Central Tamil)'
            ],
            'Telugu': [
                'Hyderabad (Telangana Telugu)', 'Vijayawada (Coastal Andhra)', 'Visakhapatnam (North Coastal)',
                'Tirupati (Rayalaseema)', 'Warangal (Telangana)', 'Guntur (Central Andhra)'
            ],
            'Malayalam': [
                'Thiruvananthapuram (Southern Kerala)', 'Kochi (Central Kerala)', 'Kozhikode (Malabar)',
                'Thrissur (Central Kerala)', 'Kollam (Southern Kerala)', 'Kannur (Northern Kerala)'
            ],
            'English': [
                'General', 'Indian English', 'American English', 'British English'
            ]
        }
        
        selected_region = random.choice(language_regions.get(language, ['General']))
        formality_choice = random.choices(['informal', 'formal'], weights=[80, 20])[0]
        
        # Language-agnostic formality instructions (will be used in template)
        # The template will handle language-specific formality instructions
        
        prompt = render_template(
            'conversation_activity.txt',
            language=language,
            user_cefr_level=user_cefr_level,
            topic=topic,
            selected_region=selected_region,
            formality_choice=formality_choice,
            words_context=words_context
        )

        response_text, response_time, token_info, is_truncated, _ = generate_text_with_gemini(prompt)
        
        # Parse JSON
        result = parse_json_response(response_text, is_truncated)
        
        if "_parse_error" in result:
            return {
                '_error': f"JSON parsing failed: {result['_parse_error']}",
                '_error_type': "parse_error",
                '_raw_response': response_text,
            }
        
        # Get speaker profile from Gemini response, or fallback to generated one
        speaker_profile = result.get('speaker_profile')
        if not speaker_profile:
            # Fallback: Generate speaker profile if not in response
            speaker_profile = generate_speaker_profile(selected_region, formality_choice, None, language)
        
        # Select voice based on speaker profile gender (for future TTS if needed)
        # For Gemini Live API, voice will be handled by the model directly
        voice = None
        speaker_gender = speaker_profile.get('gender', '').lower()
        
        # Normalize gender to English for voice selection
        if speaker_gender in ['female', 'ಹೆಣ್ಣು', 'महिला', 'औरत', 'பெண்', 'స్త్రీ', 'സ്ത്രീ']:
            voice = random.choice(GEMINI_FEMALE_VOICES) if GEMINI_FEMALE_VOICES else None
        elif speaker_gender in ['male', 'ಗಂಡು', 'पुरुष', 'मर्द', 'ஆண்', 'పురుషుడు', 'പുരുഷൻ']:
            voice = random.choice(GEMINI_MALE_VOICES) if GEMINI_MALE_VOICES else None
        
        # Note: Gemini Live API will be used for real-time conversations
        # Traditional TTS is kept as fallback for non-live scenarios
        
        # DO NOT generate TTS for introduction - wait for user to start conversation
        # Audio will be generated on-demand when user clicks "Start Conversation"
        
        # Add metadata
        result['_topic'] = topic
        result['_voice_used'] = voice
        result['_selected_region'] = selected_region
        result['_formality_choice'] = formality_choice
        result['_speaker_profile'] = speaker_profile
        result['_introduction_audio'] = None  # No audio until user starts conversation
        result['_token_info'] = token_info
        result['_response_time'] = response_time
        result['_prompt'] = prompt  # Store prompt for debug
        result['_raw_response'] = response_text  # Store raw response for debug
        result['_tasks_completed'] = []  # Track which tasks are completed
        result['messages'] = []  # Initialize conversation history
        
        return result
        
    except Exception as e:
        print(f"Error generating conversation activity: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            '_error': str(e),
            '_error_type': type(e).__name__,
        }


def generate_conversation_response(message: str, words: list, language: str, user_cefr_level: str = 'A1', voice: str = None, conversation_history: list = None, tasks: list = None, topic: str = None, speaker_profile: dict = None, selected_region: str = None, formality_choice: str = None) -> dict:
    """Generate a conversation response using vocabulary words
    
    Args:
        message: User's message
        words: List of vocabulary words
        language: Language code
        user_cefr_level: User's CEFR level
        voice: Voice to use for TTS (if None, randomly selected)
        conversation_history: Optional list of previous messages/responses for context
        tasks: List of tasks to complete in the conversation
        topic: Conversation topic
    
    Returns:
        dict with response, voice used, dialect, formality, and metadata
    """
    if not config.GEMINI_API_KEY:
        return None
    
    try:
        # Format words for context (target language translation)
        words_context = "\n".join([
            f"- {w.get('translation', '')}"
            for w in words[:20]
        ])
        
        # Language-specific regional varieties (for language-agnostic support)
        language_regions = {
            'Kannada': [
                "ಬೆಂಗಳೂರು/ಮೈಸೂರು (ಬೆಂಗಳೂರು/ಮೈಸೂರು ಪ್ರದೇಶದ ಉಪಭಾಷೆ)",
                "ಮಂಗಳೂರು (ತುಳು ಪ್ರಭಾವದ ಕನ್ನಡ)",
                "ಹುಬ್ಬಳ್ಳಿ-ಧಾರವಾಡ (ಉತ್ತರ ಕರ್ನಾಟಕದ ಉಪಭಾಷೆ)",
                "ಬೆಳಗಾವಿ (ಮಹಾರಾಷ್ಟ್ರ ಗಡಿಯ ಬಳಿಯ ಕನ್ನಡ)",
                "ಮೈಸೂರು (ದಕ್ಷಿಣ ಕರ್ನಾಟಕದ ಶಾಸ್ತ್ರೀಯ ಕನ್ನಡ)",
                "ಶಿವಮೊಗ್ಗ (ಮಲೆನಾಡು ಪ್ರದೇಶದ ಕನ್ನಡ)",
                "ಮಂಡ್ಯ (ಮೈಸೂರು ಪ್ರದೇಶದ ಗ್ರಾಮೀಣ ಕನ್ನಡ)",
                "ಚಿತ್ರದುರ್ಗ (ಮಧ್ಯ ಕರ್ನಾಟಕದ ಉಪಭಾಷೆ)"
            ],
            'Hindi': [
                'Delhi (Standard Hindi)', 'Mumbai (Bombay Hindi)', 'Lucknow (Awadhi-influenced)', 
                'Kanpur (Eastern UP Hindi)', 'Jaipur (Rajasthani-influenced)', 
                'Bhopal (Malwa Hindi)', 'Agra (Braj-influenced)', 'Varanasi (Bhojpuri-influenced)'
            ],
            'Urdu': [
                'Delhi (Dakhini/Deccani)', 'Lucknow (Lakhnavi Urdu)', 'Hyderabad (Deccani)', 
                'Karachi (Pakistani Urdu)', 'Lahore (Punjabi-influenced)', 
                'Islamabad (Standard Pakistani Urdu)', 'Multan (Multani)', 'Peshawar (Pashto-influenced)'
            ],
            'Tamil': [
                'Chennai (Madras Tamil)', 'Coimbatore (Kongu Tamil)', 'Madurai (Madurai Tamil)',
                'Thanjavur (Thanjavur Tamil)', 'Tirunelveli (Southern Tamil)', 'Trichy (Central Tamil)'
            ],
            'Telugu': [
                'Hyderabad (Telangana Telugu)', 'Vijayawada (Coastal Andhra)', 'Visakhapatnam (North Coastal)',
                'Tirupati (Rayalaseema)', 'Warangal (Telangana)', 'Guntur (Central Andhra)'
            ],
            'Malayalam': [
                'Thiruvananthapuram (Southern Kerala)', 'Kochi (Central Kerala)', 'Kozhikode (Malabar)',
                'Thrissur (Central Kerala)', 'Kollam (Southern Kerala)', 'Kannur (Northern Kerala)'
            ],
            'English': [
                'General', 'Indian English', 'American English', 'British English'
            ]
        }
        
        # Use provided speaker profile, region, and formality if available (from activity data)
        # Otherwise, try to get from conversation history
        # Priority: 1) Function parameters, 2) First message in history, 3) Random generation
        existing_speaker_profile = speaker_profile  # Use provided speaker profile first
        if selected_region is None or formality_choice is None or existing_speaker_profile is None:
            if conversation_history and len(conversation_history) > 0:
                # Get dialect, formality, and speaker profile from first message in history
                first_msg = conversation_history[0]
                if isinstance(first_msg, dict):
                    if selected_region is None:
                        selected_region = first_msg.get('_selected_region')
                    if formality_choice is None:
                        formality_choice = first_msg.get('_formality_choice')
                    if existing_speaker_profile is None:
                        existing_speaker_profile = first_msg.get('_speaker_profile')
        
        # If not found in history or parameters, select randomly
        if selected_region is None:
            selected_region = random.choice(language_regions.get(language, ['General']))
        
        if formality_choice is None:
            # Randomly select formality level (heavy weightage towards informal: 80% informal, 20% formal)
            formality_choice = random.choices(
                ['informal', 'formal'],
                weights=[80, 20]
            )[0]
        
        # Generate or get speaker profile FIRST (before selecting voice)
        # This ensures voice matches gender and persona is established
        if existing_speaker_profile:
            speaker_profile = existing_speaker_profile
            print(f"[DEBUG] Using existing speaker profile: {speaker_profile.get('name', 'N/A')}")
        else:
            # Generate speaker profile first - determine gender from voice if provided, otherwise random
            voice_gender_for_profile = None
            if voice:
                voice_lower = voice.lower()
                if any(x in voice_lower for x in ['kore', 'aoede', 'callirrhoe', 'female', 'woman', 'girl', 'f']):
                    voice_gender_for_profile = "female"
                elif any(x in voice_lower for x in ['charon', 'fenrir', 'puck', 'male', 'man', 'boy', 'm']):
                    voice_gender_for_profile = "male"
            speaker_profile = generate_speaker_profile(selected_region, formality_choice, voice_gender_for_profile, language)
        
        # Select voice based on speaker profile gender (if voice not already provided)
        if voice is None:
            speaker_gender = speaker_profile.get('gender', '').lower()
            # Normalize gender to English for voice selection
            if speaker_gender in ['female', 'ಹೆಣ್ಣು', 'महिला', 'औरत', 'பெண்', 'స్త్రీ', 'സ്ത്രീ']:
                voice = random.choice(GEMINI_FEMALE_VOICES) if GEMINI_FEMALE_VOICES else None
            elif speaker_gender in ['male', 'ಗಂಡು', 'पुरुष', 'मर्द', 'ஆண்', 'పురుషుడు', 'പുരുഷൻ']:
                voice = random.choice(GEMINI_MALE_VOICES) if GEMINI_MALE_VOICES else None
        
        # Build conversation context from history if available
        conversation_context = ""
        if conversation_history and len(conversation_history) > 0:
            context_parts = []
            for msg in conversation_history[-5:]:  # Last 5 messages for context
                if isinstance(msg, dict):
                    user_msg = msg.get('user_message', '')
                    ai_response = msg.get('ai_response', '')
                    if user_msg:
                        context_parts.append(f"User: {user_msg}")
                    if ai_response:
                        context_parts.append(f"AI: {ai_response}")
            if context_parts:
                conversation_context = "\n\nPrevious conversation:\n" + "\n".join(context_parts) + "\n"
        
        # Add tasks context if provided
        tasks_context = ""
        if tasks:
            tasks_list = "\n".join([f"- {task}" for task in tasks])
            tasks_context = f"\n\nConversation tasks (try to naturally incorporate these tasks into the conversation):\n{tasks_list}"
        
        # Add topic context if provided
        topic_context = ""
        if topic:
            topic_context = f"\n\nTopic: {topic}"
        
        # Format speaker profile for prompt - the template will handle language-specific formatting
        # Debug logging: Print speaker profile to verify it's being used
        if speaker_profile:
            print(f"[DEBUG] Speaker Profile for conversation:")
            print(f"  Name: {speaker_profile.get('name', 'N/A')}")
            print(f"  Age: {speaker_profile.get('age', 'N/A')}")
            print(f"  City: {speaker_profile.get('city', 'N/A')}")
            print(f"  State: {speaker_profile.get('state', 'N/A')}")
            print(f"  Background: {speaker_profile.get('background', 'N/A')}")
            print(f"  Dialect: {speaker_profile.get('dialect', 'N/A')}")
            print(f"  Gender: {speaker_profile.get('gender', 'N/A')}")
        
        # Flatten speaker_profile for template rendering (Python format doesn't support nested dicts)
        speaker_profile_flat = {}
        if speaker_profile:
            speaker_profile_flat = {
                'speaker_name': speaker_profile.get('name', ''),
                'speaker_gender': speaker_profile.get('gender', ''),
                'speaker_age': speaker_profile.get('age', ''),
                'speaker_city': speaker_profile.get('city', ''),
                'speaker_state': speaker_profile.get('state', ''),
                'speaker_country': speaker_profile.get('country', ''),
                'speaker_dialect': speaker_profile.get('dialect', ''),
                'speaker_background': speaker_profile.get('background', ''),
            }
        
        prompt = render_template(
            'conversation_response.txt',
            language=language,
            user_cefr_level=user_cefr_level,
            topic_context=topic_context,
            selected_region=selected_region,
            formality_choice=formality_choice,
            tasks_context=tasks_context,
            conversation_context=conversation_context,
            message=message,
            words_context=words_context,
            **speaker_profile_flat
        )

        try:
            response_text, response_time, token_info, is_truncated, _ = generate_text_with_gemini(prompt)
        except Exception as e:
            # Handle API errors gracefully
            error_msg = str(e)
            print(f"[ERROR] Failed to generate conversation response: {error_msg}")
            import traceback
            traceback.print_exc()
            
            # Language-agnostic error messages
            error_messages = {
                'Kannada': 'ಕ್ಷಮಿಸಿ, ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಉತ್ಪಾದಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
                'Hindi': 'क्षमा करें, प्रतिक्रिया उत्पन्न नहीं कर सके। कृपया पुनः प्रयास करें।',
                'Urdu': 'معاف کیجیے، جواب پیدا نہیں ہو سکا۔ براہ کرم دوبارہ کوشش کریں۔',
                'Tamil': 'மன்னிக்கவும், பதில் உருவாக்க முடியவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.',
                'Telugu': 'క్షమించండి, ప్రతిస్పందనను రూపొందించడం సాధ్యం కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.',
                'Malayalam': 'ക്ഷമിക്കണം, പ്രതികരണം സൃഷ്ടിക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.',
                'English': 'Sorry, could not generate response. Please try again.'
            }
            error_response = error_messages.get(language, error_messages['English'])
            
            # Return error response instead of crashing
            return {
                "response": error_response,
                "_response_time": 0,
                "_token_info": {},
                "_voice_used": voice if voice else None,
                "_selected_region": selected_region,
                "_formality_choice": formality_choice,
                "_audio_data": None,
                "_tts_cost": 0.0,
                "_tts_response_time": 0.0,
                "_speaker_profile": speaker_profile,
                "_prompt": prompt,
                "_error": error_msg,
                "_error_type": type(e).__name__,
            }
        
        # Generate TTS audio for the response (voice already selected based on speaker profile gender)
        # Wrap TTS generation with error handling
        audio_data = None
        voice_used = voice
        tts_cost_info = {}
        tts_error_message = None
        
        # Only generate TTS if response text is valid and non-empty
        response_text_clean = response_text.strip() if response_text else ""
        if response_text_clean:
            # Retry TTS generation up to 3 times
            max_retries = 3
            retry_delay = 1  # 1 second delay between retries
            audio_data = None
            voice_used = voice
            tts_cost_info = {}
            tts_error_message = None
            
            for attempt in range(max_retries):
                try:
                    print(f"[TTS] Attempt {attempt + 1}/{max_retries} for TTS generation...")
                    
                    # Map language names to Google TTS language codes
                    language_code_map = {
                        'kannada': 'kn-IN',
                        'hindi': 'hi-IN',
                        'urdu': 'ur-PK',
                        'tamil': 'ta-IN',
                        'telugu': 'te-IN',
                        'malayalam': 'ml-IN',
                        'english': 'en-US'
                    }
                    language_code = language_code_map.get(language.lower(), 'kn-IN')
                    
                    @with_timeout(TTS_TIMEOUT)
                    def generate_tts_with_timeout():
                        return generate_tts(
                            response_text_clean,
                            language=language_code,
                            voice=voice,
                            style_instruction=generate_tts_style_instruction(
                                response_text_clean,
                                '',
                                selected_region=selected_region,
                                formality_choice=formality_choice
                            )
                        )
                    
                    audio_data, voice_used, tts_cost_info = generate_tts_with_timeout()
                    
                    # Check if audio_data has format='text_only' (quota exceeded or other error)
                    if audio_data is None:
                        print(f"[WARNING] TTS generation returned None (no audio data) on attempt {attempt + 1}")
                        if attempt < max_retries - 1:
                            print(f"[TTS] Retrying in {retry_delay}s...")
                            time.sleep(retry_delay)
                            continue
                        tts_error_message = "TTS generation returned None after all retries"
                    elif audio_data.get('format') == 'text_only':
                        # TTS failed but returned text-only fallback (quota exceeded, etc.)
                        error_detail = audio_data.get('error', 'Unknown error')
                        print(f"[WARNING] TTS generation failed on attempt {attempt + 1}, using text-only fallback. Error: {error_detail}")
                        
                        # Don't retry on quota errors - these won't succeed
                        if '429' in error_detail or 'quota' in error_detail.lower() or 'RESOURCE_EXHAUSTED' in error_detail:
                            tts_error_message = f"TTS quota exceeded - audio generation unavailable. Error: {error_detail[:200]}"
                            audio_data = None
                            break  # Don't retry quota errors
                        else:
                            # Retry on other errors
                            if attempt < max_retries - 1:
                                print(f"[TTS] Retrying in {retry_delay}s...")
                                time.sleep(retry_delay)
                                continue
                            tts_error_message = f"TTS API error - audio generation unavailable after all retries. Error: {error_detail[:200]}"
                            audio_data = None
                    elif not audio_data.get('audio_base64'):
                        # Audio data exists but no base64 audio
                        print(f"[WARNING] TTS returned audio_data but no audio_base64 on attempt {attempt + 1}")
                        if attempt < max_retries - 1:
                            print(f"[TTS] Retrying in {retry_delay}s...")
                            time.sleep(retry_delay)
                            continue
                        tts_error_message = "TTS returned invalid audio data after all retries"
                        audio_data = None
                    else:
                        # Success! Audio was generated
                        print(f"[TTS] ✓ Successfully generated audio on attempt {attempt + 1}")
                        break
                        
                except TimeoutError as timeout_err:
                    # TTS timeout - retry if not last attempt
                    print(f"[ERROR] TTS generation timed out after {TTS_TIMEOUT}s on attempt {attempt + 1}")
                    if attempt < max_retries - 1:
                        print(f"[TTS] Retrying in {retry_delay}s...")
                        time.sleep(retry_delay)
                        continue
                    tts_error_message = f"TTS generation timed out after {TTS_TIMEOUT}s after all retries: {str(timeout_err)}"
                    print(f"[ERROR] {tts_error_message}")
                    import traceback
                    traceback.print_exc()
                    audio_data = None
                    tts_cost_info = {}
                except Exception as tts_error:
                    # TTS failure - retry if not last attempt
                    error_str = str(tts_error)
                    print(f"[ERROR] TTS generation failed on attempt {attempt + 1}: {error_str}")
                    print(f"[ERROR] Response text length: {len(response_text_clean)} chars")
                    print(f"[ERROR] Voice used: {voice}")
                    print(f"[ERROR] Response text preview: {response_text_clean[:200]}...")
                    
                    # Don't retry on quota errors
                    if '429' in error_str or 'quota' in error_str.lower() or 'RESOURCE_EXHAUSTED' in error_str:
                        tts_error_message = f"TTS quota exceeded - audio generation unavailable. Error: {error_str[:200]}"
                        print(f"[ERROR] Quota error detected, not retrying")
                        audio_data = None
                        tts_cost_info = {}
                        break
                    
                    if attempt < max_retries - 1:
                        print(f"[TTS] Retrying in {retry_delay}s...")
                        import traceback
                        traceback.print_exc()
                        time.sleep(retry_delay)
                        continue
                    
                    # Last attempt failed
                    tts_error_message = f"TTS generation failed after all retries: {error_str}"
                    print(f"[ERROR] {tts_error_message}")
                    import traceback
                    traceback.print_exc()
                    audio_data = None
                    tts_cost_info = {}
        else:
            tts_error_message = "Response text is empty, skipping TTS generation"
            print(f"[WARNING] {tts_error_message}")
        
        # Speaker profile already generated/retrieved above, no need to regenerate
        
        return {
            "response": response_text.strip(),
            "_response_time": response_time,
            "_token_info": token_info,
            "_voice_used": voice_used,
            "_selected_region": selected_region,
            "_formality_choice": formality_choice,
            "_audio_data": audio_data if audio_data else None,
            "_tts_cost": tts_cost_info.get('total_cost', 0.0) if tts_cost_info else 0.0,
            "_tts_response_time": tts_cost_info.get('response_time', 0.0) if tts_cost_info else 0.0,
            "_tts_error": tts_error_message,  # Include TTS error message if any
            "_speaker_profile": speaker_profile,
            "_prompt": prompt,  # Include full prompt for debugging
            "_speaker_profile_flat": speaker_profile_flat,  # Include speaker profile flat dict for debugging
        }
        
    except Exception as e:
        print(f"Error generating conversation response: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "response": "ಕ್ಷಮಿಸಿ, ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಉತ್ಪಾದಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
            "_response_time": 0,
            "_token_info": {},
            "_voice_used": None,
            "_selected_region": None,
            "_formality_choice": None,
            "_audio_data": None,
            "_tts_cost": 0.0,
            "_tts_response_time": 0.0,
            "_speaker_profile": None,
            "_prompt": "",
            "_speaker_profile_context": "",
            "_error": str(e),
            "_error_type": type(e).__name__,
        }


def rate_conversation_performance(conversation_transcript: str, tasks: list, topic: str, words: list, language: str, learned_words: list = None, learning_words: list = None, user_cefr_level: str = 'A1') -> dict:
    """Rate conversation performance based on transcript and tasks completion
    
    Args:
        conversation_transcript: Full conversation transcript (user and AI messages)
        tasks: List of tasks that should have been completed
        topic: Conversation topic
        words: List of vocabulary words available
        language: Language code
        learned_words: List of learned/mastered words
        learning_words: List of learning/review words
        user_cefr_level: User's CEFR level
    
    Returns:
        dict with scores, feedback, and task completion assessment
    """
    if not config.GEMINI_API_KEY:
        return {
            "_error": "GEMINI_API_KEY not set",
            "_error_type": "missing_api_key",
        }
    
    try:
        # Format word lists
        learned_context = ""
        learning_context = ""
        if learned_words:
            learned_list = [w.get('english_word', '') for w in learned_words[:20]]
            learned_context = f"\nಬಳಕೆದಾರರ ಕಲಿತ/ಮಾಸ್ಟರ್ ಮಾಡಿದ ಪದಗಳು (ಈ ಮಟ್ಟಕ್ಕೆ ಸೂಕ್ತವಾದ ಪದಗಳು): {', '.join(learned_list)}"
        if learning_words:
            learning_list = [w.get('english_word', '') for w in learning_words[:20]]
            learning_context = f"\nಬಳಕೆದಾರರ ಕಲಿಯುವ/ರಿವ್ಯೂ ಪದಗಳು (ಈ ಪದಗಳ ಬಳಕೆಯನ್ನು ಪ್ರೋತ್ಸಾಹಿಸಿ): {', '.join(learning_list)}"
        
        tasks_list = "\n".join([f"- {task}" for task in tasks])
        
        prompt = render_template(
            'conversation_rating.txt',
            language=language,
            user_cefr_level=user_cefr_level,
            topic=topic,
            conversation_transcript=conversation_transcript,
            tasks_list=tasks_list,
            learned_context=learned_context,
            learning_context=learning_context
        )

        response_text, response_time, token_info, is_truncated, _ = generate_text_with_gemini(prompt)
        
        # Validate response_text
        if response_text is None or not response_text.strip():
            return {
                "_error": "Failed to generate response from Gemini API. Response text is None or empty.",
                "_error_type": "APIError",
                "_prompt": prompt,
                "_response_time": response_time or 0,
                "_token_info": token_info or {},
            }
        
        # Parse JSON
        result = parse_json_response(response_text, is_truncated)
        
        if "_parse_error" in result:
            print(f"Failed to parse JSON: {result['_parse_error']}")
            print(f"Raw response (first 500 chars): {response_text[:500]}")
            return {
                "_parse_error": result['_parse_error'],
                "_raw_response": response_text,
                "_prompt": prompt,
                "_response_time": response_time,
                "_token_info": token_info,
            }
        
        # Add debug info
        result['_prompt'] = prompt
        result['_response_time'] = response_time
        result['_raw_response'] = response_text
        result['_token_info'] = token_info
        
        return result
        
    except Exception as e:
        print(f"Error rating conversation: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "_error": str(e),
            "_error_type": type(e).__name__,
            "_prompt": prompt if 'prompt' in locals() else "",
            "_response_time": response_time if 'response_time' in locals() else 0,
            "_token_info": token_info if 'token_info' in locals() else {},
        }
