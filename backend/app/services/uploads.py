"""Local file-based upload storage. Swap for S3/GCS in production."""

import logging
import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB

_EXT_MAP = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

_SAFE_SEGMENT = re.compile(r"^[a-zA-Z0-9_-]+$")


def _uploads_root() -> Path:
    if settings.uploads_dir:
        root = Path(settings.uploads_dir)
    else:
        # Default: backend/uploads/
        root = Path(__file__).resolve().parents[3] / "uploads"
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_upload(file: UploadFile, user_id: str, slot: str) -> str:
    """
    Save an uploaded image for a user. Returns the URL path (e.g. /uploads/user-abc/id_front_abc123.jpg).
    Raises HTTPException on validation failure.
    """
    if not _SAFE_SEGMENT.match(user_id.replace("-", "_")):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Only JPEG, PNG, and WebP images are accepted (got {content_type!r})",
        )

    ext = _EXT_MAP[content_type]
    filename = f"{slot}_{uuid.uuid4().hex[:8]}{ext}"
    user_dir = _uploads_root() / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    dest = user_dir / filename

    content = file.file.read()
    if len(content) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="File must be under 10 MB")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    dest.write_bytes(content)
    logger.info("Saved upload %s for user %s", filename, user_id)
    return f"/uploads/{user_id}/{filename}"


def delete_upload(url_path: str) -> None:
    """Remove a previously saved upload by its URL path. Silent on missing file."""
    if not url_path.startswith("/uploads/"):
        return
    rel = url_path.removeprefix("/uploads/")
    path = _uploads_root() / rel
    try:
        path.unlink(missing_ok=True)
    except Exception as exc:
        logger.warning("Could not delete upload %s: %s", path, exc)
