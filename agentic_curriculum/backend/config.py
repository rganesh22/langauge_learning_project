"""
Configuration management for Agentic Curriculum System
"""

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field

# Find the .env file relative to this config.py file
_ENV_FILE = str(Path(__file__).parent / ".env")

class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # API Keys - support both GOOGLE_API_KEY and GEMINI_API_KEY for compatibility
    google_api_key: str = Field(
        default_factory=lambda: os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY", ""),
        env="GOOGLE_API_KEY"
    )
    
    # Model Configuration
    default_model: str = Field("gemini-2.5-flash", env="DEFAULT_MODEL")
    max_iterations: int = Field(10, env="MAX_ITERATIONS")
    temperature: float = Field(0.7, env="TEMPERATURE")
    max_tokens: Optional[int] = Field(None, env="MAX_TOKENS")
    
    # Server Configuration
    host: str = Field("0.0.0.0", env="HOST")
    port: int = Field(8000, env="PORT")
    cors_origins: list = Field(["*"], env="CORS_ORIGINS")
    
    # Storage Configuration
    task_storage_path: str = Field("./storage/tasks", env="TASK_STORAGE_PATH")
    checkpoint_enabled: bool = Field(True, env="CHECKPOINT_ENABLED")
    
    # Safety Configuration
    sandbox_mode: bool = Field(False, env="SANDBOX_MODE")
    require_approval: bool = Field(False, env="REQUIRE_APPROVAL")
    max_cost_per_task: float = Field(10.0, env="MAX_COST_PER_TASK")
    
    # Lesson Paths
    lessons_base_path: str = Field("../backend/lessons", env="LESSONS_BASE_PATH")
    
    class Config:
        env_file = _ENV_FILE
        case_sensitive = False

# Model pricing (cost per 1M tokens)
MODEL_PRICING = {
    "gemini-2.5-flash": {
        "input": 0.30,  # $0.30 per 1M tokens
        "output": 2.50,  # $2.50 per 1M tokens
        "description": "Fast, cost-effective for most tasks"
    },
    "gemini-2.5-flash-lite": {
        "input": 0.10,  # $0.10 per 1M tokens
        "output": 0.40,  # $0.40 per 1M tokens
        "description": "Ultra-fast and economical for simple tasks"
    },
    "gemini-2.5-pro": {
        "input": 1.25,  # $1.25 per 1M tokens (≤200K context)
        "input_high": 2.50,  # $2.50 per 1M tokens (>200K context)
        "output": 10.00,  # $10.00 per 1M tokens (≤200K context)
        "output_high": 15.00,  # $15.00 per 1M tokens (>200K context)
        "context_threshold": 200000,
        "description": "Higher quality, complex reasoning"
    },
    "gemini-3-flash-preview": {
        "input": 0.50,  # $0.50 per 1M tokens
        "output": 3.00,  # $3.00 per 1M tokens
        "description": "Next-gen flash model with improved performance"
    },
    "gemini-3-pro-preview": {
        "input": 2.00,  # $2.00 per 1M tokens (≤200K context)
        "input_high": 4.00,  # $4.00 per 1M tokens (>200K context)
        "output": 12.00,  # $12.00 per 1M tokens (≤200K context)
        "output_high": 18.00,  # $18.00 per 1M tokens (>200K context)
        "context_threshold": 200000,
        "description": "Next-gen pro model with enhanced reasoning"
    }
}

def get_model_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate cost for a model call"""
    if model not in MODEL_PRICING:
        return 0.0
    
    pricing = MODEL_PRICING[model]
    
    # Check if this model has context-based pricing
    if "context_threshold" in pricing:
        threshold = pricing["context_threshold"]
        if input_tokens > threshold:
            # Use high-context pricing
            input_cost = (input_tokens / 1_000_000) * pricing["input_high"]
            output_cost = (output_tokens / 1_000_000) * pricing["output_high"]
        else:
            # Use standard pricing
            input_cost = (input_tokens / 1_000_000) * pricing["input"]
            output_cost = (output_tokens / 1_000_000) * pricing["output"]
    else:
        # Flat pricing regardless of context
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
    
    return input_cost + output_cost

def get_available_models():
    """Get list of available models with metadata"""
    return [
        {
            "id": model_id,
            "name": model_id.replace("-exp", "").replace("-", " ").title(),
            "pricing": pricing,
        }
        for model_id, pricing in MODEL_PRICING.items()
    ]

# Global settings instance
settings = Settings()
