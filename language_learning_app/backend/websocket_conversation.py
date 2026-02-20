"""
WebSocket Server for Gemini Live Conversations
Handles real-time bidirectional audio streaming between frontend and Gemini Live API
"""

import asyncio
import base64
import json
import uuid
from typing import Dict, Optional, Set
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime

from .gemini_live_client import GeminiLiveClient
from . import db
from . import config as app_config


class ConversationSession:
    """Manages a single conversation session"""
    
    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.gemini_client: Optional[GeminiLiveClient] = None
        self.conversation_id: Optional[int] = None
        self.language: str = "kannada"
        self.is_active: bool = False
        self.messages: list = []
        
    async def start_gemini_session(self, config: Dict):
        """
        Start Gemini Live session with provided configuration
        
        Args:
            config: Dict containing language, context, voice, etc.
        """
        try:
            self.language = config.get("language", "kannada")
            conversation_context = config.get("context", {})
            voice_name = config.get("voice", "Kore")
            
            # Initialize Gemini Live client
            self.gemini_client = GeminiLiveClient()
            
            # Start session
            success = await self.gemini_client.start_session(
                language=self.language,
                conversation_context=conversation_context,
                voice_name=voice_name
            )
            
            if success:
                self.is_active = True
                
                # Load conversation from database if conversation_id provided
                if config.get("conversation_id"):
                    self.conversation_id = config["conversation_id"]
                    await self._load_conversation_history()
                
                # Send setup complete message
                await self.send_message({
                    "type": "setup_complete",
                    "session_id": self.session_id,
                    "message": "Gemini Live session started"
                })
                
                return True
            else:
                await self.send_message({
                    "type": "error",
                    "message": "Failed to start Gemini Live session"
                })
                return False
                
        except Exception as e:
            print(f"[WebSocket] Error starting Gemini session: {e}")
            await self.send_message({
                "type": "error",
                "message": f"Error: {str(e)}"
            })
            return False
    
    async def _load_conversation_history(self):
        """Load previous conversation messages from database"""
        try:
            # Get activity data from database
            import sqlite3
            from . import config
            
            conn = sqlite3.connect(config.DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT activity_data FROM activity_history
                WHERE id = ? AND activity_type = 'conversation'
            ''', (self.conversation_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row and row['activity_data']:
                activity_data = json.loads(row['activity_data'])
                self.messages = activity_data.get('messages', [])
                
                # Send conversation history to frontend
                await self.send_message({
                    "type": "history_loaded",
                    "messages": self.messages,
                    "count": len(self.messages)
                })
                
        except Exception as e:
            print(f"[WebSocket] Error loading conversation history: {e}")
    
    async def handle_audio_chunk(self, audio_data: bytes):
        """
        Handle incoming audio chunk from frontend
        
        Args:
            audio_data: Raw PCM audio data
        """
        if not self.is_active or not self.gemini_client:
            await self.send_message({
                "type": "error",
                "message": "Session not active"
            })
            return
        
        try:
            # Send audio to Gemini Live
            await self.gemini_client.send_audio(audio_data)
            
        except Exception as e:
            print(f"[WebSocket] Error handling audio chunk: {e}")
            await self.send_message({
                "type": "error",
                "message": f"Error processing audio: {str(e)}"
            })
    
    async def handle_text_message(self, text: str):
        """
        Handle incoming text message from frontend
        
        Args:
            text: Text message
        """
        if not self.is_active or not self.gemini_client:
            await self.send_message({
                "type": "error",
                "message": "Session not active"
            })
            return
        
        try:
            # Send text to Gemini Live
            await self.gemini_client.send_text(text)
            
            # Store user message
            self.messages.append({
                "user_message": text,
                "ai_response": None,
                "timestamp": app_config.get_current_time().isoformat()
            })
            
        except Exception as e:
            print(f"[WebSocket] Error handling text message: {e}")
            await self.send_message({
                "type": "error",
                "message": f"Error sending message: {str(e)}"
            })
    
    async def stream_gemini_responses(self):
        """
        Stream responses from Gemini Live to frontend
        Runs in background task
        """
        if not self.gemini_client:
            return
        
        try:
            audio_buffer = []
            text_buffer = []
            
            async for response in self.gemini_client.receive_responses():
                response_type = response.get("type")
                
                if response_type == "response":
                    # Collect audio chunks
                    if response.get("audio_chunks"):
                        audio_buffer.extend(response["audio_chunks"])
                    
                    # Collect text chunks
                    if response.get("text_chunks"):
                        text_buffer.extend(response["text_chunks"])
                    
                    # Send audio chunks to frontend
                    for audio_chunk in response.get("audio_chunks", []):
                        await self.send_message({
                            "type": "audio_chunk",
                            "data": base64.b64encode(audio_chunk).decode('utf-8'),
                            "is_final": response.get("is_final", False)
                        })
                    
                    # If response is final, send complete message
                    if response.get("is_final"):
                        full_text = " ".join(text_buffer)
                        full_audio = b"".join(audio_buffer)
                        
                        # Update last message with AI response
                        if self.messages and self.messages[-1]["ai_response"] is None:
                            self.messages[-1]["ai_response"] = full_text
                            self.messages[-1]["audio_data"] = base64.b64encode(full_audio).decode('utf-8')
                        
                        # Send completion message
                        await self.send_message({
                            "type": "response_complete",
                            "text": full_text,
                            "audio": base64.b64encode(full_audio).decode('utf-8')
                        })
                        
                        # Clear buffers
                        audio_buffer = []
                        text_buffer = []
                
                elif response_type == "interrupted":
                    await self.send_message({
                        "type": "interrupted",
                        "message": response.get("message", "Response interrupted")
                    })
                    audio_buffer = []
                    text_buffer = []
                
                elif response_type == "setup_complete":
                    await self.send_message({
                        "type": "status",
                        "status": "ready",
                        "message": "Ready to start conversation"
                    })
                    
        except Exception as e:
            print(f"[WebSocket] Error streaming responses: {e}")
            await self.send_message({
                "type": "error",
                "message": f"Error receiving responses: {str(e)}"
            })
    
    async def send_message(self, message: Dict):
        """
        Send message to frontend via WebSocket
        
        Args:
            message: Message dict to send
        """
        try:
            await self.websocket.send_json(message)
        except Exception as e:
            print(f"[WebSocket] Error sending message: {e}")
    
    async def save_conversation(self):
        """Save conversation to database"""
        if not self.conversation_id or not self.messages:
            return
        
        try:
            # Prepare activity data
            activity_data = {
                "messages": self.messages,
                "session_id": self.session_id,
                "language": self.language
            }
            
            # Update database
            db.update_conversation_messages(
                self.conversation_id,
                self.messages
            )
            
            print(f"[WebSocket] Saved {len(self.messages)} messages to conversation {self.conversation_id}")
            
        except Exception as e:
            print(f"[WebSocket] Error saving conversation: {e}")
    
    async def close(self):
        """Close session and cleanup"""
        self.is_active = False
        
        # Save conversation before closing
        await self.save_conversation()
        
        # Close Gemini Live session
        if self.gemini_client:
            await self.gemini_client.close_session()
        
        print(f"[WebSocket] Session {self.session_id} closed")


class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        self.active_sessions: Dict[str, ConversationSession] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str):
        """
        Accept new WebSocket connection
        
        Args:
            websocket: WebSocket connection
            session_id: Unique session ID
        """
        await websocket.accept()
        session = ConversationSession(websocket, session_id)
        self.active_sessions[session_id] = session
        print(f"[WebSocket] Session {session_id} connected")
        return session
    
    def disconnect(self, session_id: str):
        """
        Remove session
        
        Args:
            session_id: Session ID to remove
        """
        if session_id in self.active_sessions:
            del self.active_sessions[session_id]
            print(f"[WebSocket] Session {session_id} disconnected")
    
    def get_session(self, session_id: str) -> Optional[ConversationSession]:
        """Get session by ID"""
        return self.active_sessions.get(session_id)


# Global connection manager
manager = ConnectionManager()


async def handle_websocket_conversation(websocket: WebSocket):
    """
    Main WebSocket endpoint handler for Gemini Live conversations
    
    Args:
        websocket: WebSocket connection
    """
    session_id = str(uuid.uuid4())
    session = await manager.connect(websocket, session_id)
    
    # Start background task for streaming Gemini responses
    response_task = None
    
    try:
        while True:
            # Receive message from frontend
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "start_session":
                # Start Gemini Live session
                config = data.get("config", {})
                success = await session.start_gemini_session(config)
                
                if success:
                    # Start streaming responses in background
                    response_task = asyncio.create_task(
                        session.stream_gemini_responses()
                    )
            
            elif message_type == "audio_chunk":
                # Handle audio chunk
                audio_b64 = data.get("data")
                if audio_b64:
                    audio_data = base64.b64decode(audio_b64)
                    await session.handle_audio_chunk(audio_data)
            
            elif message_type == "text_message":
                # Handle text message
                text = data.get("text")
                if text:
                    await session.handle_text_message(text)
            
            elif message_type == "end_session":
                # End session
                await session.save_conversation()
                await session.send_message({
                    "type": "session_ended",
                    "message": "Session ended successfully"
                })
                break
            
            elif message_type == "ping":
                # Keepalive
                await session.send_message({"type": "pong"})
    
    except WebSocketDisconnect:
        print(f"[WebSocket] Client disconnected: {session_id}")
    
    except Exception as e:
        print(f"[WebSocket] Error in websocket handler: {e}")
        await session.send_message({
            "type": "error",
            "message": f"Server error: {str(e)}"
        })
    
    finally:
        # Cleanup
        if response_task and not response_task.done():
            response_task.cancel()
        
        await session.close()
        manager.disconnect(session_id)
