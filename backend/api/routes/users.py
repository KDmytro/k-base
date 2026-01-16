"""Users API routes for preferences management."""

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user
from models.database import User, UserPreferences, get_db
from models.schemas import UserPreferencesUpdate, UserPreferencesResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/preferences", response_model=Optional[UserPreferencesResponse])
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Optional[UserPreferences]:
    """Get current user's preferences."""
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    return result.scalar_one_or_none()


@router.put("/me/preferences", response_model=UserPreferencesResponse)
async def update_preferences(
    data: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserPreferences:
    """Create or update current user's preferences."""
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == current_user.id)
    )
    preferences = result.scalar_one_or_none()

    if preferences:
        # Update existing preferences
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(preferences, field, value)
    else:
        # Create new preferences
        preferences = UserPreferences(
            user_id=current_user.id,
            background=data.background,
            interests=data.interests,
            custom_instructions=data.custom_instructions,
        )
        db.add(preferences)

    await db.flush()
    await db.refresh(preferences)
    return preferences
