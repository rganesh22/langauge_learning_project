"""
Firebase Auth integration for Fluo backend.
Verifies Firebase ID tokens and maps to internal user_id (user_profile.id).
"""
import os
from typing import Optional, Tuple

_firebase_app = None


def _get_credential_path() -> str:
    """Path to service account JSON. Prefer env for deployment."""
    path = os.getenv(
        "FIREBASE_SERVICE_ACCOUNT_PATH",
        os.path.join(os.path.dirname(__file__), "firebase", "agentic-language-learning-firebase-adminsdk-fbsvc-cb5c3fc9c7.json"),
    )
    return path


def init_firebase():
    """Initialize Firebase Admin SDK. Safe to call multiple times."""
    global _firebase_app
    if _firebase_app is not None:
        return
    try:
        import firebase_admin
        from firebase_admin import credentials

        path = _get_credential_path()
        if not os.path.isfile(path):
            print(f"[Firebase] Service account file not found: {path}")
            return
        cred = credentials.Certificate(path)
        _firebase_app = firebase_admin.initialize_app(cred)
        print("[Firebase] Admin SDK initialized")
    except Exception as e:
        print(f"[Firebase] Init failed: {e}")
        _firebase_app = None


def verify_id_token(id_token: str) -> Optional[dict]:
    """
    Verify a Firebase ID token and return decoded claims, or None if invalid.
    Claims include: uid, email, name, etc.
    """
    init_firebase()
    if _firebase_app is None:
        return None
    try:
        from firebase_admin import auth
        decoded = auth.verify_id_token(id_token)
        return decoded
    except Exception:
        return None


def get_uid_and_email(id_token: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Verify token and return (firebase_uid, email, display_name).
    Returns (None, None, None) if token is invalid.
    """
    decoded = verify_id_token(id_token)
    if not decoded:
        return None, None, None
    uid = decoded.get("uid")
    email = decoded.get("email") or (decoded.get("firebase") or {}).get("identities", {}).get("email")
    if isinstance(email, list):
        email = email[0] if email else None
    name = decoded.get("name") or (email.split("@")[0] if email else "Learner")
    return uid, email, name
