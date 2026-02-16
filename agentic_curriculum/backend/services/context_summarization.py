"""
Context Summarization Service
Handles intelligent summarization of conversation history to prevent context overflow
"""
import json
from typing import List, Dict, Any
import google.generativeai as genai
from backend.config import settings

class ContextSummarizer:
    """
    Summarizes conversation history when it gets too long.
    Not too aggressive - preserves critical information while condensing repetitive actions.
    """
    
    def __init__(
        self,
        model_name: str = "gemini-2.5-flash",
        token_threshold: int = 100000,
        target_token_count: int = 50000,
        min_messages: int = 15,
        compression_ratio: int = 50
    ):
        """
        Initialize the summarizer with configuration
        
        Args:
            model_name: Gemini model to use for summarization
            token_threshold: Summarize when conversation exceeds this many tokens
            target_token_count: Try to compress to around this many tokens
            min_messages: Don't summarize if fewer than this many messages
            compression_ratio: Target compression ratio (40-60% recommended)
        """
        genai.configure(api_key=settings.google_api_key)
        self.model = genai.GenerativeModel(model_name)
        
        # Thresholds for summarization
        self.token_threshold = token_threshold
        self.target_token_count = target_token_count
        self.min_messages_before_summarize = min_messages
        self.compression_ratio = compression_ratio
    
    def should_summarize(self, conversation_history: list) -> bool:
        """
        Determine if conversation history should be summarized.
        
        Args:
            conversation_history: List of conversation messages (strings or dicts)
            
        Returns:
            bool: True if summarization is needed
        """
        # Count messages (excluding system prompt - first message)
        message_count = len(conversation_history) - 1 if len(conversation_history) > 1 else 0
        
        if message_count < self.min_messages_before_summarize:
            return False
        
        # Rough token estimate: ~4 chars per token
        total_chars = sum(
            len(msg) if isinstance(msg, str) else len(json.dumps(msg))
            for msg in conversation_history
        )
        estimated_tokens = total_chars / 4
        
        return estimated_tokens > self.token_threshold
    
    def summarize_conversation(
        self,
        conversation_history: list,
        preserve_recent: int = 3
    ) -> list:
        """
        Summarize conversation history while preserving critical information.
        
        IMPORTANT: The system prompt is NEVER summarized - it must always remain intact.
        Plan data is ALWAYS preserved verbatim during summarization.
        
        Args:
            conversation_history: Full conversation history (list of strings)
            preserve_recent: Number of recent messages to keep unsummarized
            
        Returns:
            Summarized conversation history
        """
        if not conversation_history:
            return conversation_history
        
        # System prompt is always the first item
        system_prompt = conversation_history[0] if conversation_history else None
        
        # Separate messages to summarize from recent ones
        remaining = conversation_history[1:]  # Everything after system prompt
        
        # Keep recent messages as-is
        preserve_count = preserve_recent * 2  # pairs of request/response
        if len(remaining) <= preserve_count:
            return conversation_history  # Not enough to summarize
        
        messages_to_summarize = remaining[:-preserve_count]
        recent_messages = remaining[-preserve_count:]
        
        # If nothing to summarize, return original
        if not messages_to_summarize:
            return conversation_history
        
        # Extract plan data that must be preserved verbatim
        plan_data = self._extract_plan_data(messages_to_summarize + recent_messages)
        
        # Build summarization prompt
        try:
            from backend.prompting.prompts import CONTEXT_SUMMARIZATION_PROMPT
        except ImportError:
            CONTEXT_SUMMARIZATION_PROMPT = "Summarize the following conversation history, preserving key actions taken, files modified, and important observations. Target {compression_ratio}% compression.\n\n{conversation_history}"
        
        history_text = self._format_history_for_summarization(messages_to_summarize)
        summary_prompt = CONTEXT_SUMMARIZATION_PROMPT.format(
            conversation_history=history_text,
            compression_ratio=self.compression_ratio
        )
        
        try:
            # Generate summary
            response = self.model.generate_content(summary_prompt)
            summary_text = response.text
            
            # Create summarized history
            summarized_history = []
            
            # ALWAYS include system prompt first
            if system_prompt:
                summarized_history.append(system_prompt)
            
            # Add summary as a context message
            summarized_history.append(
                '[CONTEXT SUMMARY - Previous conversation summarized for efficiency]\n\n' + summary_text
            )
            
            # If we extracted plan data, inject it explicitly so it's never lost
            if plan_data:
                plan_context = '[PRESERVED PLAN DATA - These plans are active and must not be lost]\n\n' + plan_data
                summarized_history.append(plan_context)
            
            # Add recent messages
            summarized_history.extend(recent_messages)
            
            return summarized_history
            
        except Exception as e:
            print(f"Warning: Context summarization failed: {e}")
            return self._fallback_truncate(conversation_history, preserve_recent)
    
    def _extract_plan_data(self, messages: list) -> str:
        """Extract all plan-related data from messages to preserve verbatim"""
        import re
        plan_fragments = []
        
        for msg in messages:
            if not isinstance(msg, str):
                continue
            
            # Look for plan creation results
            if '"plan_id"' in msg and '"goal"' in msg and '"steps"' in msg:
                # Try to extract the JSON plan object
                try:
                    # Find JSON objects that look like plans
                    for match in re.finditer(r'\{[^{}]*"plan_id"[^{}]*"goal"[^{}]*"steps"[^{}]*\[.*?\][^{}]*\}', msg, re.DOTALL):
                        plan_fragments.append(f"Plan data: {match.group(0)}")
                except Exception:
                    pass
            
            # Look for plan status results
            if '"overall_status"' in msg and '"total_steps"' in msg:
                try:
                    for match in re.finditer(r'\{[^{}]*"plan"[^{}]*\{.*?\}[^{}]*"summary"[^{}]*\{.*?\}[^{}]*\}', msg, re.DOTALL):
                        plan_fragments.append(f"Plan status: {match.group(0)}")
                except Exception:
                    pass
            
            # Look for step completion results  
            if '"step_number"' in msg and '"new_status"' in msg and '"progress"' in msg:
                try:
                    for match in re.finditer(r'\{[^{}]*"step_number".*?"new_status".*?"progress".*?\}', msg, re.DOTALL):
                        plan_fragments.append(f"Step update: {match.group(0)}")
                except Exception:
                    pass
        
        return "\n\n".join(plan_fragments) if plan_fragments else ""
    
    def _format_history_for_summarization(self, messages: list) -> str:
        """Format conversation history for summarization"""
        formatted = []
        
        for msg in messages:
            if isinstance(msg, str):
                # Truncate very long messages for summarization
                if len(msg) > 2000:
                    formatted.append(msg[:2000] + "\n[...truncated...]")
                else:
                    formatted.append(msg)
            elif isinstance(msg, dict):
                role = msg.get('role', 'unknown')
                parts = msg.get('parts', [])
                content = parts[0] if isinstance(parts, list) and parts else str(parts)
                formatted.append(f"**{role.upper()}**: {content}\n")
        
        return "\n---\n".join(formatted)
    
    def _fallback_truncate(
        self,
        conversation_history: list,
        preserve_recent: int
    ) -> list:
        """
        Fallback truncation strategy if summarization fails.
        Keep system prompt + recent messages.
        """
        if not conversation_history:
            return conversation_history
        
        result = []
        
        # Keep system prompt (first item)
        result.append(conversation_history[0])
        
        # Keep recent messages
        preserve_count = preserve_recent * 2
        recent_start = max(1, len(conversation_history) - preserve_count)
        result.extend(conversation_history[recent_start:])
        
        return result
    
    def get_context_stats(self, conversation_history: list) -> Dict[str, Any]:
        """Get statistics about current context usage"""
        total_chars = sum(
            len(msg) if isinstance(msg, str) else len(json.dumps(msg))
            for msg in conversation_history
        )
        estimated_tokens = total_chars / 4
        message_count = len(conversation_history) - 1 if len(conversation_history) > 1 else 0
        
        return {
            'total_messages': message_count,
            'estimated_tokens': int(estimated_tokens),
            'token_threshold': self.token_threshold,
            'should_summarize': self.should_summarize(conversation_history),
            'compression_ratio': (estimated_tokens / self.token_threshold) if estimated_tokens > 0 else 0
        }
