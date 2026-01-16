"""add_selection_position_columns

Revision ID: 3521b5ebff58
Revises: 4b2a3449a89f
Create Date: 2026-01-15 23:18:53.740567

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3521b5ebff58'
down_revision: Union[str, None] = '4b2a3449a89f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('nodes', sa.Column('selection_start', sa.Integer(), nullable=True))
    op.add_column('nodes', sa.Column('selection_end', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('nodes', 'selection_end')
    op.drop_column('nodes', 'selection_start')
