"""System cron endpoints — called by the Next.js cron route with the internal API key."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_internal_api_key
from app.db.session import get_db
from app.core.config import settings
from app.db.models import User
from app.services import notifications as notif_svc

router = APIRouter(prefix="/cron", dependencies=[Depends(require_internal_api_key)])


@router.post("/onboarding-reminder")
def onboarding_reminder(db: Session = Depends(get_db)) -> dict:
    """Send reminders to sellers stuck in onboarding for more than 24 hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    # Sellers with incomplete onboarding who started > 24h ago
    sellers = db.scalars(
        select(User).where(
            User.seller_status == "incomplete",
            User.seller_started_at != None,  # noqa: E711
            User.seller_started_at < cutoff,
        )
    ).all()

    reminded = 0
    for vendor in sellers:
        next_step = (vendor.onboarding_step or 0) + 1
        notif_svc.notify(
            db,
            event_type="onboarding_reminder",
            recipient_id=vendor.id,
            title="Finish setting up your store",
            body=f"You're on step {vendor.onboarding_step or 0} of 5. "
                 "Complete your vendor profile to start listing products.",
            href="/vendor/register",
            email_subject="Don't forget — your Spree store is almost ready",
            cta_label=f"Continue to step {next_step}",
            cta_url=f"{settings.frontend_url}/vendor/register",
        )
        reminded += 1

    return {"reminded": reminded}
