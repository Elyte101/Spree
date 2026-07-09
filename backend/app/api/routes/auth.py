from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status

from app.api.deps import ActorRole, ActorUserId, DBSession, InternalAPIKey, _check_rate_limit
from app.schemas.auth import (
    AuthUserOut,
    LoginRequest,
    NotificationPrefsOut,
    NotificationPrefsUpdateRequest,
    OAuthUpsertRequest,
    OnboardingStateOut,
    OnboardingStep1Request,
    OnboardingStep2Request,
    OnboardingStep3Request,
    OnboardingStep4Request,
    OnboardingStep5Request,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    PayoutInfoRequest,
    ProfileUpdateRequest,
    SendVerificationRequest,
    SignupRequest,
    UserProfileOut,
    VerifyEmailRequest,
)
from app.services.auth import (
    authenticate_user,
    check_login_rate_limit,
    clear_login_failures,
    create_verification_token,
    get_user_profile,
    record_login_failure,
    register_user,
    request_password_reset,
    reset_password_with_token,
    update_payout_info,
    update_user_profile,
    upsert_oauth_user,
    verify_email_token,
)
from app.services import onboarding as onboarding_svc

router = APIRouter(prefix="/auth")


@router.post("/login", response_model=AuthUserOut)
def login(
    payload: LoginRequest,
    db: DBSession,
    _: InternalAPIKey,
    # X-Client-Ip: set by the Next proxy from the original browser request —
    # trustworthy on the normal path since only our own server code sets it.
    # X-Forwarded-For: set by Vercel's own edge for *this* deployment; used
    # as a fallback so a caller hitting this endpoint directly (bypassing
    # Next entirely) still gets attributed to their real IP instead of
    # everyone collapsing into one shared "unknown" bucket.
    x_client_ip: Annotated[str | None, Header(alias="X-Client-Ip")] = None,
    x_forwarded_for: Annotated[str | None, Header(alias="X-Forwarded-For")] = None,
):
    # A5/A7: DB-backed rate limit, enforced here so it can't be skipped by
    # calling this endpoint directly instead of through the Next proxy.
    client_ip = x_client_ip or (x_forwarded_for.split(",")[0].strip() if x_forwarded_for else "unknown")
    check_login_rate_limit(db, payload.email, client_ip)

    user = authenticate_user(db, payload.email, payload.password)
    if user is None:
        record_login_failure(db, payload.email, client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    clear_login_failures(db, payload.email, client_ip)
    return user


@router.post("/signup", response_model=AuthUserOut, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: DBSession, _: InternalAPIKey):
    return register_user(db, payload)


@router.get("/profile/{user_id}", response_model=UserProfileOut)
def profile(
    user_id: str,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
    actor_role: ActorRole,
):
    if actor_role != "admin" and actor_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return get_user_profile(db, user_id)


@router.put("/profile/{user_id}", response_model=UserProfileOut)
def profile_update(
    user_id: str,
    payload: ProfileUpdateRequest,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
    actor_role: ActorRole,
):
    if actor_role != "admin" and actor_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return update_user_profile(db, user_id, payload)



@router.put("/profile/{user_id}/payout-info", response_model=UserProfileOut)
def profile_payout_info(
    user_id: str,
    payload: PayoutInfoRequest,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
):
    if actor_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return update_payout_info(db, user_id, payload)


@router.post("/oauth-upsert", response_model=AuthUserOut)
def oauth_upsert(payload: OAuthUpsertRequest, db: DBSession, _: InternalAPIKey):
    return upsert_oauth_user(db, payload)


# ── Onboarding wizard ─────────────────────────────────────────────────────────

@router.get("/onboarding", response_model=OnboardingStateOut)
def onboarding_state(db: DBSession, _: InternalAPIKey, actor_id: ActorUserId):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return onboarding_svc.get_onboarding_state(db, actor_id)


@router.patch("/onboarding/step/1", response_model=UserProfileOut)
def onboarding_step1(
    payload: OnboardingStep1Request, db: DBSession, _: InternalAPIKey, actor_id: ActorUserId
):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return onboarding_svc.save_step1(db, actor_id, payload)


@router.patch("/onboarding/step/2", response_model=UserProfileOut)
def onboarding_step2(
    payload: OnboardingStep2Request, db: DBSession, _: InternalAPIKey, actor_id: ActorUserId
):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return onboarding_svc.save_step2(db, actor_id, payload)


@router.patch("/onboarding/step/3", response_model=UserProfileOut)
def onboarding_step3(
    payload: OnboardingStep3Request, db: DBSession, _: InternalAPIKey, actor_id: ActorUserId
):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return onboarding_svc.save_step3(db, actor_id, payload)


@router.patch("/onboarding/step/4", response_model=UserProfileOut)
def onboarding_step4(
    payload: OnboardingStep4Request, db: DBSession, _: InternalAPIKey, actor_id: ActorUserId
):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return onboarding_svc.save_step4(db, actor_id, payload)


@router.patch("/onboarding/step/5", response_model=UserProfileOut)
def onboarding_step5(
    payload: OnboardingStep5Request, db: DBSession, _: InternalAPIKey, actor_id: ActorUserId
):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return onboarding_svc.save_step5(db, actor_id, payload)


@router.post("/onboarding/submit", response_model=UserProfileOut)
def onboarding_submit(db: DBSession, _: InternalAPIKey, actor_id: ActorUserId):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return onboarding_svc.submit_onboarding(db, actor_id)


# ── Notification preferences ──────────────────────────────────────────────────

@router.get("/notification-preferences", response_model=NotificationPrefsOut)
def get_notification_prefs(db: DBSession, _: InternalAPIKey, actor_id: ActorUserId):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    from app.db.models import User as _User
    user = db.get(_User, actor_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {"prefs": user.notification_prefs or {}}


@router.patch("/notification-preferences", response_model=NotificationPrefsOut)
def update_notification_prefs(
    payload: NotificationPrefsUpdateRequest,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    from app.db.models import User as _User
    user = db.get(_User, actor_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.notification_prefs = payload.prefs
    db.commit()
    return {"prefs": user.notification_prefs}


@router.post("/send-verification")
def send_verification(payload: SendVerificationRequest, db: DBSession, _: InternalAPIKey):
    token = create_verification_token(db, payload.email)
    return {"token": token}


@router.post("/verify-email", response_model=AuthUserOut)
def verify_email(payload: VerifyEmailRequest, db: DBSession, _: InternalAPIKey):
    user = verify_email_token(db, payload.token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link",
        )
    return user


# ── Password reset ────────────────────────────────────────────────────────────

@router.post("/password-reset/request", status_code=status.HTTP_200_OK)
def password_reset_request(payload: PasswordResetRequestIn, db: DBSession, _: InternalAPIKey):
    # A6: rate-limited per email to slow down enumeration/spam of the reset
    # flow; response is identical whether or not the email has an account
    # (see request_password_reset — no user-existence signal is leaked).
    _check_rate_limit(db, f"password_reset_request:{payload.email.lower().strip()}", max_calls=3, window_seconds=3600)
    request_password_reset(db, payload.email)
    return {"detail": "If an account exists for that email, a password reset link has been sent."}


@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
def password_reset_confirm(payload: PasswordResetConfirmIn, db: DBSession, _: InternalAPIKey):
    ok = reset_password_with_token(db, payload.token, payload.password)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset link",
        )
    # A6: the caller must sign in again with the new password — we don't
    # return a session here, and any session issued before this point is
    # invalidated the next time it hits a sensitive-action revalidation check
    # (see A10 — the JWT's issued-at is compared against password_changed_at).
    return {"detail": "Your password has been reset. Please sign in with your new password."}


# ── Bank payout endpoints ──────────────────────────────────────────────────────

@router.get("/banks")
def list_banks(_: InternalAPIKey):
    """Return supported GHS banks from Paystack. Cached per-process; safe for frequent calls."""
    from app.services import paystack as paystack_svc  # noqa: PLC0415
    from app.core.config import settings  # noqa: PLC0415
    if not settings.paystack_secret_key:
        # Return an empty list in dev/mock mode so the UI degrades gracefully.
        return {"data": []}
    try:
        banks = paystack_svc.list_banks(currency="GHS")
        return {"data": banks}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch bank list: {exc}") from exc


@router.get("/banks/resolve")
def resolve_bank(account_number: str, bank_code: str, _: InternalAPIKey):
    """Resolve a bank account number to its account holder name via Paystack."""
    from app.services import paystack as paystack_svc  # noqa: PLC0415
    from app.core.config import settings  # noqa: PLC0415
    if not settings.paystack_secret_key:
        raise HTTPException(status_code=503, detail="Bank resolve not available in mock mode")
    if not account_number or not bank_code:
        raise HTTPException(status_code=422, detail="account_number and bank_code are required")
    try:
        name = paystack_svc.resolve_bank_account(account_number, bank_code)
        return {"resolved": True, "name": name}
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not resolve account: {exc}") from exc


@router.get("/sellers-missing-payout")
def sellers_missing_payout(db: DBSession, _: InternalAPIKey, actor_role: ActorRole):
    """Admin: list active sellers who have no paystack_recipient_code."""
    if actor_role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    from sqlalchemy import select as _sel  # noqa: PLC0415
    from app.db.models import User  # noqa: PLC0415
    sellers = db.scalars(
        _sel(User).where(
            User.seller_status == "active",
            User.paystack_recipient_code.is_(None),
        )
    ).all()
    return {
        "count": len(sellers),
        "sellers": [
            {"id": s.id, "name": s.name, "email": s.email, "sellerStatus": s.seller_status}
            for s in sellers
        ],
    }
