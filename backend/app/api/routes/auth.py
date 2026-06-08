from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.api.deps import ActorRole, ActorUserId, DBSession, InternalAPIKey
from app.schemas.auth import (
    AuthUserOut,
    LoginRequest,
    OAuthUpsertRequest,
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
