"""Authentication API routes."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from google.oauth2 import id_token
from google.auth.transport import requests
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import create_access_token, get_current_user
from config import settings
from models.database import User, get_db

router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleLoginRequest(BaseModel):
    """Request body for Google login."""
    id_token: str


class UserResponse(BaseModel):
    """User information response."""
    id: str
    email: str
    name: str | None
    picture: str | None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Response containing JWT token."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post("/google", response_model=TokenResponse)
async def google_login(
    request: GoogleLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate with Google ID token.

    Frontend should use Google Sign-In to get the ID token,
    then send it here to get a JWT for API access.
    """
    try:
        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(
            request.id_token,
            requests.Request(),
            settings.google_client_id,
        )

        # Get user info from token
        google_id = idinfo["sub"]
        email = idinfo["email"]
        name = idinfo.get("name")
        picture = idinfo.get("picture")

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )

    # Find or create user
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user:
        # Update user info (name/picture may have changed)
        user.name = name
        user.picture = picture
        user.last_login_at = datetime.utcnow()
    else:
        # Create new user
        user = User(
            email=email,
            name=name,
            picture=picture,
            google_id=google_id,
            last_login_at=datetime.utcnow(),
        )
        db.add(user)

    await db.flush()
    await db.refresh(user)

    # Create JWT token
    access_token = create_access_token(user.id, user.email)

    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name,
            picture=user.picture,
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Get the current authenticated user's information."""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        picture=current_user.picture,
    )
