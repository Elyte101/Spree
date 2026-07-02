from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, status

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
    upload_id_documents,
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


@router.post("/profile/{user_id}/id-documents", response_model=UserProfileOut)
def profile_id_documents(
    user_id: str,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
    id_front: Optional[UploadFile] = File(default=None),
    id_back: Optional[UploadFile] = File(default=None),
    selfie: Optional[UploadFile] = File(default=None),
):
    if actor_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if not any([id_front, id_back, selfie]):
        raise HTTPException(status_code=400, detail="At least one file must be provided")
    return upload_id_documents(db, user_id, id_front, id_back, selfie)


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
