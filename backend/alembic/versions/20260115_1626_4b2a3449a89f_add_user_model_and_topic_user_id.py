"""add_user_model_and_topic_user_id

Revision ID: 4b2a3449a89f
Revises: e08318967186
Create Date: 2026-01-15 16:26:34.394435

"""
from typing import Sequence, Union
from uuid import uuid4
from datetime import datetime

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b2a3449a89f'
down_revision: Union[str, None] = 'e08318967186'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Default user ID for migrating existing data (fixed UUID for reproducibility)
DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001'


def upgrade() -> None:
    # 1. Create users table
    op.create_table('users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('picture', sa.String(length=500), nullable=True),
        sa.Column('google_id', sa.String(length=255), nullable=True),
        sa.Column('openai_api_key', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_google_id'), 'users', ['google_id'], unique=True)

    # 2. Create a default user for existing data (development only)
    now = datetime.utcnow().isoformat()
    op.execute(f"""
        INSERT INTO users (id, email, name, created_at, updated_at)
        VALUES ('{DEFAULT_USER_ID}', 'legacy@kbase.local', 'Legacy User', '{now}', '{now}')
    """)

    # 3. Add user_id column as nullable first
    op.add_column('topics', sa.Column('user_id', sa.UUID(), nullable=True))

    # 4. Update existing topics to use default user
    op.execute(f"UPDATE topics SET user_id = '{DEFAULT_USER_ID}' WHERE user_id IS NULL")

    # 5. Make user_id not nullable
    op.alter_column('topics', 'user_id', nullable=False)

    # 6. Add index and foreign key
    op.create_index('idx_topics_user_id', 'topics', ['user_id'], unique=False)
    op.create_foreign_key('fk_topics_user_id', 'topics', 'users', ['user_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    op.drop_constraint('fk_topics_user_id', 'topics', type_='foreignkey')
    op.drop_index('idx_topics_user_id', table_name='topics')
    op.drop_column('topics', 'user_id')
    op.drop_index(op.f('ix_users_google_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
