from fastapi import APIRouter, HTTPException, status

from app.api.deps import DBSession, InternalAPIKey
from app.schemas.auth import (
    AuthUserOut,
    LoginRequest,
    ProfileUpdateRequest,
    SignupRequest,
    UserProfileOut,
)
from app.services.auth import (
    authenticate_user,
    get_user_profile,
    register_user,
    update_user_profile,
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
