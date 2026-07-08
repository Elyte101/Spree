from fastapi import APIRouter, HTTPException, status

from app.api.deps import ActorRole, ActorUserId, DBSession, InternalAPIKey
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
    PayoutInfoRequest,
    ProfileUpdateRequest,
    SendVerificationRequest,
    SignupRequest,
    UserProfileOut,
    VerifyEmailRequest,
)
from app.services.auth import (
    authenticate_user,
    create_verification_token,
    get_user_profile,
    register_user,
    update_payout_info,
    update_user_profile,
    upsert_oauth_user,
    verify_email_token,
)
from app.services import onboarding as onboarding_svc

router = APIRouter(prefix="/auth")


@router.post("/login", response_model=AuthUserOut)
def login(payload: LoginRequest, db: DBSession, _: InternalAPIKey):
    user = authenticate_user(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
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
