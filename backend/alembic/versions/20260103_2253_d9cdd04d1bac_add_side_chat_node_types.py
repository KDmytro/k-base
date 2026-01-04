"""Add side chat node types

Revision ID: d9cdd04d1bac
Revises: 001_initial
Create Date: 2026-01-03 22:53:56.715848

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd9cdd04d1bac'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new values to node_type enum
    op.execute("ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'side_chat_user'")
    op.execute("ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'side_chat_assistant'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values easily
    # Would require recreating the type and updating all references
    pass
