from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.api.deps import DBSession, InternalAPIKey
from app.schemas.auth import (
    AuthUserOut,
    LoginRequest,
    PayoutInfoRequest,
    ProfileUpdateRequest,
    SignupRequest,
    UserProfileOut,
)
from app.services.auth import (
    authenticate_user,
    get_user_profile,
    register_user,
    update_payout_info,
    update_user_profile,
    upload_id_documents,
)

router = APIRouter(prefix="/auth")


@router.post("/login", response_model=AuthUserOut)
def login(payload: LoginRequest, db: DBSession):
    user = authenticate_user(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return user


@router.post("/signup", response_model=AuthUserOut, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: DBSession):
    return register_user(db, payload)


@router.get("/profile/{user_id}", response_model=UserProfileOut)
def profile(user_id: str, db: DBSession, _: InternalAPIKey):
    return get_user_profile(db, user_id)


@router.put("/profile/{user_id}", response_model=UserProfileOut)
def profile_update(
    user_id: str,
    payload: ProfileUpdateRequest,
    db: DBSession,
    _: InternalAPIKey,
):
    return update_user_profile(db, user_id, payload)


@router.post("/profile/{user_id}/id-documents", response_model=UserProfileOut)
def profile_id_documents(
    user_id: str,
    db: DBSession,
    _: InternalAPIKey,
    id_front: Optional[UploadFile] = File(default=None),
    id_back: Optional[UploadFile] = File(default=None),
    selfie: Optional[UploadFile] = File(default=None),
):
    if not any([id_front, id_back, selfie]):
        raise HTTPException(status_code=400, detail="At least one file must be provided")
    return upload_id_documents(db, user_id, id_front, id_back, selfie)


@router.put("/profile/{user_id}/payout-info", response_model=UserProfileOut)
def profile_payout_info(
    user_id: str,
    payload: PayoutInfoRequest,
    db: DBSession,
    _: InternalAPIKey,
):
    return update_payout_info(db, user_id, payload)
