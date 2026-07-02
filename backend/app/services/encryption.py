"""Field-level encryption service.

G13: Ghana Card numbers, payout details, and document URLs must be encrypted
at rest.  This module wraps Fernet (AES-128-CBC + HMAC-SHA256) from the
``cryptography`` package.

Setup
-----
1. Add ``cryptography`` to requirements.txt (``pip install cryptography``).
2. Generate a Fernet key once:
       python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
3. Set the key in the environment:  FIELD_ENCRYPTION_KEY=<base64-url-safe-key>
4. Restart the server — existing plaintext values remain readable; new writes
   will be encrypted.  Run a one-time backfill migration to encrypt existing rows.

Fallback
--------
If ``cryptography`` is not installed OR ``FIELD_ENCRYPTION_KEY`` is not set,
encryption is a no-op (plaintext stored).  A WARNING is logged on every write
so the operator knows the field is unprotected.

NEVER LOG the plaintext value of sensitive fields.
"""

from __future__ import annotations

import base64
import logging
import os

logger = logging.getLogger(__name__)

_KEY = os.getenv("FIELD_ENCRYPTION_KEY", "").strip()
_fernet = None

if _KEY:
    try:
        from cryptography.fernet import Fernet, InvalidToken  # type: ignore[import-untyped]
        _fernet = Fernet(_KEY.encode() if not isinstance(_KEY, bytes) else _KEY)
        logger.info("[encryption] Field-level encryption enabled (Fernet/AES-128-CBC)")
    except ImportError:
        logger.warning(
            "[encryption] FIELD_ENCRYPTION_KEY is set but 'cryptography' is not installed. "
            "Install it with: pip install cryptography. "
            "Sensitive fields will be stored in plaintext until then."
        )
    except Exception as exc:
        logger.error(
            "[encryption] Invalid FIELD_ENCRYPTION_KEY: %s. "
            "Sensitive fields will be stored in plaintext.",
            exc,
        )
else:
    logger.warning(
        "[encryption] FIELD_ENCRYPTION_KEY is not set. "
        "Ghana Card numbers, payout details, and document URLs are stored in plaintext. "
        "Set FIELD_ENCRYPTION_KEY in the environment before going to production."
    )


# Prefix so we can distinguish encrypted blobs from plaintext legacy values.
_ENC_PREFIX = "enc1:"


def encrypt(value: str | None) -> str | None:
    """Encrypt a sensitive string value for storage.

    Returns the ciphertext prefixed with ``enc1:`` so decrypt() can detect it.
    Returns None if value is None.
    Returns plaintext (with a warning) if encryption is unavailable.
    """
    if value is None:
        return None
    if not value:
        return value

    if _fernet is None:
        logger.warning(
            "[encryption] encrypt() called but encryption unavailable — storing plaintext. "
            "Set FIELD_ENCRYPTION_KEY to enable encryption."
        )
        return value

    ciphertext = _fernet.encrypt(value.encode()).decode()
    return f"{_ENC_PREFIX}{ciphertext}"


def decrypt(stored: str | None) -> str | None:
    """Decrypt a stored value.

    Handles both encrypted (``enc1:…``) and legacy plaintext values
    so the system remains backward-compatible during migration.
    Returns None if stored is None.
    """
    if stored is None:
        return None
    if not stored:
        return stored

    if not stored.startswith(_ENC_PREFIX):
        # Legacy plaintext value — return as-is.
        return stored

    if _fernet is None:
        logger.error(
            "[encryption] decrypt() called on encrypted value but encryption is unavailable. "
            "Set FIELD_ENCRYPTION_KEY to the key used during encryption."
        )
        return None  # Cannot decrypt without the key.

    try:
        from cryptography.fernet import InvalidToken  # type: ignore[import-untyped]
        payload = stored[len(_ENC_PREFIX):]
        return _fernet.decrypt(payload.encode()).decode()
    except Exception as exc:
        logger.error("[encryption] decrypt() failed: %s", exc)
        return None


def is_encrypted(value: str | None) -> bool:
    """Return True if the stored value is an encrypted blob."""
    return bool(value and value.startswith(_ENC_PREFIX))
