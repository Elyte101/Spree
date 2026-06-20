"""File upload storage. Defaults to /tmp/uploads on Vercel (ephemeral).
For production persistence, set UPLOADS_DIR to a mounted volume or
replace this module with an S3/GCS/Cloudinary integration."""

import logging
import os
import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
_EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
_SAFE_SEGMENT = re.compile(r"^[a-zA-Z0-9_-]+$")


def _is_heic(data: bytes) -> bool:
    # ISO Base Media File Format box: bytes 4-7 are 'ftyp'.
    # HEIC, AVIF, HEIF, and some MP4/MOV files all share this signature.
    return len(data) >= 8 and data[4:8] == b"ftyp"


def _uploads_root() -> Path:
    if settings.uploads_dir:
        root = Path(settings.uploads_dir)
    elif os.getenv("VERCEL") == "1":
        # /tmp is the only writable directory on Vercel serverless
        root = Path("/tmp/uploads")
    else:
        root = Path(__file__).resolve().parents[3] / "uploads"
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_upload(file: UploadFile, user_id: str, slot: str) -> str:
    if not _SAFE_SEGMENT.match(user_id.replace("-", "_")):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Only JPEG, PNG, and WebP images are accepted (got {content_type!r})",
        )

    content = file.file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(content) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="File must be under 10 MB")

    if _is_heic(content):
        raise HTTPException(
            status_code=400,
            detail="HEIC/HEIF images are not accepted. Please convert to JPEG, PNG, or WebP before uploading.",
        )

    ext = _EXT_MAP[content_type]
    filename = f"{slot}_{uuid.uuid4().hex[:8]}{ext}"
    user_dir = _uploads_root() / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    (user_dir / filename).write_bytes(content)

    logger.info("Saved upload %s for user %s", filename, user_id)
    return f"/uploads/{user_id}/{filename}"


def delete_upload(url_path: str) -> None:
    if not url_path.startswith("/uploads/"):
        return
    rel = url_path.removeprefix("/uploads/")
    path = _uploads_root() / rel
    try:
        path.unlink(missing_ok=True)
    except Exception as exc:
        logger.warning("Could not delete upload %s: %s", path, exc)
