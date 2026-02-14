"""
Gemini 2.5 Live API Client for Real-time Audio Conversations
Handles bidirectional audio streaming with Gemini Live
"""

import asyncio
import base64
import json
import os
from typing import Optional, AsyncIterator, Dict, Any
from google import genai
from google.genai import types


class GeminiLiveClient:
    """
    Client for Gemini 2.5 Live API with real-time audio streaming
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Gemini Live client
        
        Args:
            api_key: Google AI API key (defaults to GEMINI_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        
        # Initialize client
        self.client = genai.Client(api_key=self.api_key)
        self.model_id = "gemini-2.5-flash-native-audio-preview-12-2025"  # Gemini Live model
        
        # Session state
        self.session = None
        self._session_manager = None
        self.conversation_context = None
        self.language = "kannada"
        self.voice_name = "Kore"  # Default voice
        
    async def start_session(
        self,
        language: str = "kannada",
        conversation_context: Optional[Dict[str, Any]] = None,
        voice_name: str = "Kore"
    ):
        """
        Start a new Gemini Live session
        
        Args:
            language: Target language for conversation
            conversation_context: Context including speaker profile, tasks, topic
            voice_name: Voice to use for TTS (Puck, Charon, Kore, Fenrir, Aoede)
        """
        self.language = language
        self.conversation_context = conversation_context or {}
        self.voice_name = voice_name
        
        # Build system instruction from context
        system_instruction = self._build_system_instruction()
        
        # Configure generation
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=voice_name
                    )
                )
            ),
            system_instruction=system_instruction
        )
        
        # Start session
        try:
            # connect() returns an async context manager, we need to enter it
            session_manager = self.client.aio.live.connect(
                model=self.model_id,
                config=config
            )
            # Enter the context manager to get the actual session
            self.session = await session_manager.__aenter__()
            # Store the context manager for cleanup
            self._session_manager = session_manager
            
            print(f"[GeminiLive] Session started for {language} with voice {voice_name}")
            return True
        except Exception as e:
            error_msg = str(e)
            print(f"[GeminiLive] Error starting session: {error_msg}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Failed to start Gemini Live session: {error_msg}")
    
    def _build_system_instruction(self) -> str:
        """
        Build system instruction from conversation context
        
        Returns:
            System instruction text with speaker profile, tasks, etc.
        """
        instruction_parts = []
        
        # Base instruction
        instruction_parts.append(f"You are a native {self.language} speaker having a natural conversation.")
        
        # Speaker profile
        if self.conversation_context.get("speaker_profile"):
            profile = self.conversation_context["speaker_profile"]
            instruction_parts.append(f"\nYour profile:")
            instruction_parts.append(f"- Name: {profile.get('name', 'Unknown')}")
            instruction_parts.append(f"- Age: {profile.get('age', 'Unknown')}")
            instruction_parts.append(f"- From: {profile.get('city', 'Unknown')}, {profile.get('state', 'Unknown')}")
            instruction_parts.append(f"- Background: {profile.get('background', 'Unknown')}")
            
            if profile.get("dialect"):
                instruction_parts.append(f"- Dialect: {profile.get('dialect')}")
        
        # Topic/scenario
        if self.conversation_context.get("topic"):
            instruction_parts.append(f"\nConversation topic: {self.conversation_context['topic']}")
        
        if self.conversation_context.get("introduction"):
            instruction_parts.append(f"\nScenario: {self.conversation_context['introduction']}")
        
        # Tasks for learner
        if self.conversation_context.get("tasks"):
            instruction_parts.append(f"\nThe learner should complete these tasks:")
            for i, task in enumerate(self.conversation_context["tasks"], 1):
                instruction_parts.append(f"{i}. {task}")
            instruction_parts.append("\nGuide the conversation naturally to help them complete these tasks.")
        
        # Language level
        if self.conversation_context.get("cefr_level"):
            level = self.conversation_context["cefr_level"]
            instruction_parts.append(f"\nLearner's {self.language} level: {level}")
            instruction_parts.append(f"Adjust your language complexity to match their level.")
        
        # Formality
        if self.conversation_context.get("formality"):
            formality = self.conversation_context["formality"]
            instruction_parts.append(f"\nUse {formality} language style.")
        
        # Important rules
        instruction_parts.append("\nImportant:")
        instruction_parts.append(f"- Speak ONLY in {self.language}")
        instruction_parts.append("- Keep responses conversational and natural")
        instruction_parts.append("- Ask follow-up questions to keep the conversation flowing")
        instruction_parts.append("- Gently correct mistakes when appropriate")
        instruction_parts.append("- Be encouraging and supportive")
        
        return "\n".join(instruction_parts)
    
    async def send_audio(self, audio_data: bytes):
        """
        Send audio chunk to Gemini Live
        
        Args:
            audio_data: Raw PCM audio data (16-bit, 16kHz, mono)
        """
        if not self.session:
            raise RuntimeError("Session not started. Call start_session() first.")
        
        try:
            # Send audio chunk
            await self.session.send(
                types.LiveClientRealtimeInput(
                    media_chunks=[
                        types.Blob(
                            data=audio_data,
                            mime_type="audio/pcm"
                        )
                    ]
                )
            )
        except Exception as e:
            print(f"[GeminiLive] Error sending audio: {e}")
            raise
    
    async def send_text(self, text: str):
        """
        Send text message to Gemini Live
        
        Args:
            text: Text message to send
        """
        if not self.session:
            raise RuntimeError("Session not started. Call start_session() first.")
        
        try:
            await self.session.send(text)
        except Exception as e:
            print(f"[GeminiLive] Error sending text: {e}")
            raise
    
    async def receive_responses(self) -> AsyncIterator[Dict[str, Any]]:
        """
        Receive responses from Gemini Live
        
        Yields:
            Dict containing response data (audio, text, status)
        """
        if not self.session:
            raise RuntimeError("Session not started. Call start_session() first.")
        
        try:
            async for response in self.session.receive():
                # Parse response
                parsed_response = self._parse_response(response)
                if parsed_response:
                    yield parsed_response
        except Exception as e:
            print(f"[GeminiLive] Error receiving response: {e}")
            raise
    
    def _parse_response(self, response) -> Optional[Dict[str, Any]]:
        """
        Parse Gemini Live response
        
        Args:
            response: Raw response from Gemini Live
            
        Returns:
            Parsed response dict or None
        """
        try:
            # Check response type
            if hasattr(response, 'server_content'):
                server_content = response.server_content
                
                # Check if it has model turn (response with audio/text)
                if hasattr(server_content, 'model_turn'):
                    model_turn = server_content.model_turn
                    
                    result = {
                        "type": "response",
                        "audio_chunks": [],
                        "text_chunks": [],
                        "is_final": False
                    }
                    
                    # Extract audio parts
                    if hasattr(model_turn, 'parts'):
                        for part in model_turn.parts:
                            if hasattr(part, 'inline_data'):
                                # Audio data
                                audio_data = part.inline_data.data
                                result["audio_chunks"].append(audio_data)
                            elif hasattr(part, 'text'):
                                # Text data
                                result["text_chunks"].append(part.text)
                    
                    # Check if turn is complete
                    if hasattr(server_content, 'turn_complete'):
                        result["is_final"] = server_content.turn_complete
                    
                    return result
                
                # Check for interrupted response
                elif hasattr(server_content, 'interrupted'):
                    return {
                        "type": "interrupted",
                        "message": "Response was interrupted"
                    }
            
            # Tool call response (not expected in audio conversation)
            elif hasattr(response, 'tool_call'):
                return {
                    "type": "tool_call",
                    "data": response.tool_call
                }
            
            # Setup complete
            elif hasattr(response, 'setup_complete'):
                return {
                    "type": "setup_complete",
                    "message": "Session setup complete"
                }
            
            return None
            
        except Exception as e:
            print(f"[GeminiLive] Error parsing response: {e}")
            return None
    
    async def close_session(self):
        """Close the Gemini Live session"""
        if self._session_manager:
            try:
                # Exit the context manager properly
                await self._session_manager.__aexit__(None, None, None)
                print("[GeminiLive] Session closed")
            except Exception as e:
                print(f"[GeminiLive] Error closing session: {e}")
            finally:
                self.session = None
                self._session_manager = None


# Example usage (for testing)
async def test_gemini_live():
    """Test Gemini Live client"""
    client = GeminiLiveClient()
    
    # Start session with context
    context = {
        "speaker_profile": {
            "name": "ರಾಜು",
            "age": "45-55",
            "city": "ಮಂಡ್ಯ",
            "state": "ಕರ್ನಾಟಕ",
            "background": "ಸಣ್ಣ ವ್ಯಾಪಾರಿ"
        },
        "topic": "ಬಸ್ ನಿಲ್ದಾಣದಲ್ಲಿ ಸಂಭಾಷಣೆ",
        "tasks": [
            "ನಿಮ್ಮ ಹೆಸರು ಹೇಳಿ",
            "ಯಾವ ಊರಿಗೆ ಹೋಗುತ್ತಿದ್ದೀರಿ ಎಂದು ಕೇಳಿ"
        ],
        "cefr_level": "A2",
        "formality": "casual"
    }
    
    await client.start_session(
        language="kannada",
        conversation_context=context,
        voice_name="Kore"
    )
    
    # Send text message
    await client.send_text("ನಮಸ್ಕಾರ!")
    
    # Receive responses
    async for response in client.receive_responses():
        print(f"Response: {response}")
        if response.get("is_final"):
            break
    
    await client.close_session()


if __name__ == "__main__":
    asyncio.run(test_gemini_live())
