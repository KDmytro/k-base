"""Initial schema with pgvector support

Revision ID: 001_initial
Revises:
Create Date: 2026-01-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable required extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')

    # Create enums
    node_type_enum = postgresql.ENUM(
        'user_message', 'assistant_message', 'user_note', 'branch_summary', 'system',
        name='node_type',
        create_type=False
    )
    node_type_enum.create(op.get_bind(), checkfirst=True)

    node_status_enum = postgresql.ENUM(
        'active', 'collapsed', 'abandoned', 'merged',
        name='node_status',
        create_type=False
    )
    node_status_enum.create(op.get_bind(), checkfirst=True)

    chunk_type_enum = postgresql.ENUM(
        'note', 'summary', 'message',
        name='chunk_type',
        create_type=False
    )
    chunk_type_enum.create(op.get_bind(), checkfirst=True)

    # Create topics table
    op.create_table(
        'topics',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_topics_created_at', 'topics', ['created_at'], unique=False)

    # Create sessions table
    op.create_table(
        'sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('topic_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('root_node_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['topic_id'], ['topics.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_sessions_topic_id', 'sessions', ['topic_id'], unique=False)
    op.create_index('idx_sessions_updated_at', 'sessions', ['updated_at'], unique=False)

    # Create nodes table
    op.create_table(
        'nodes',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('node_type', node_type_enum, nullable=False),
        sa.Column('status', node_status_enum, server_default='active', nullable=False),
        sa.Column('branch_name', sa.String(255), nullable=True),
        sa.Column('collapsed_summary', sa.Text(), nullable=True),
        sa.Column('generation_config', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=True),
        sa.Column('token_count', sa.Integer(), nullable=True),
        sa.Column('sibling_index', sa.Integer(), server_default='0', nullable=False),
        sa.Column('is_selected_path', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_id'], ['nodes.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_nodes_session_id', 'nodes', ['session_id'], unique=False)
    op.create_index('idx_nodes_parent_id', 'nodes', ['parent_id'], unique=False)
    op.create_index('idx_nodes_status', 'nodes', ['status'], unique=False)
    op.create_index('idx_nodes_type', 'nodes', ['node_type'], unique=False)
    op.create_index('idx_nodes_created_at', 'nodes', ['created_at'], unique=False)

    # Create memory_chunks table
    op.create_table(
        'memory_chunks',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('topic_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('node_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('content_type', chunk_type_enum, nullable=False),
        sa.Column('embedding', Vector(1536), nullable=False),
        sa.Column('priority_boost', sa.Float(), server_default='1.0', nullable=False),
        sa.Column('token_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['topic_id'], ['topics.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['node_id'], ['nodes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_memory_topic_id', 'memory_chunks', ['topic_id'], unique=False)
    op.create_index('idx_memory_session_id', 'memory_chunks', ['session_id'], unique=False)
    op.create_index('idx_memory_node_id', 'memory_chunks', ['node_id'], unique=False)
    op.create_index('idx_memory_content_type', 'memory_chunks', ['content_type'], unique=False)

    # Create HNSW index for vector similarity search
    op.execute("""
        CREATE INDEX idx_memory_embedding ON memory_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # Create helper function: get_node_path
    op.execute("""
        CREATE OR REPLACE FUNCTION get_node_path(target_node_id UUID)
        RETURNS TABLE(node_id UUID, depth INTEGER) AS $$
        WITH RECURSIVE path AS (
            SELECT id, parent_id, 0 as depth
            FROM nodes
            WHERE id = target_node_id

            UNION ALL

            SELECT n.id, n.parent_id, p.depth + 1
            FROM nodes n
            INNER JOIN path p ON n.id = p.parent_id
        )
        SELECT id as node_id, depth FROM path ORDER BY depth DESC;
        $$ LANGUAGE SQL;
    """)

    # Create helper function: get_node_children
    op.execute("""
        CREATE OR REPLACE FUNCTION get_node_children(parent_node_id UUID)
        RETURNS TABLE(
            node_id UUID,
            content TEXT,
            node_type node_type,
            status node_status,
            sibling_index INTEGER,
            is_selected_path BOOLEAN,
            child_count BIGINT
        ) AS $$
        SELECT
            n.id as node_id,
            n.content,
            n.node_type,
            n.status,
            n.sibling_index,
            n.is_selected_path,
            (SELECT COUNT(*) FROM nodes c WHERE c.parent_id = n.id) as child_count
        FROM nodes n
        WHERE n.parent_id = parent_node_id
        ORDER BY n.sibling_index, n.created_at;
        $$ LANGUAGE SQL;
    """)


def downgrade() -> None:
    # Drop helper functions
    op.execute('DROP FUNCTION IF EXISTS get_node_children(UUID)')
    op.execute('DROP FUNCTION IF EXISTS get_node_path(UUID)')

    # Drop tables
    op.drop_table('memory_chunks')
    op.drop_table('nodes')
    op.drop_table('sessions')
    op.drop_table('topics')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS chunk_type')
    op.execute('DROP TYPE IF EXISTS node_status')
    op.execute('DROP TYPE IF EXISTS node_type')

    # Drop extensions
    op.execute('DROP EXTENSION IF EXISTS vector')
    op.execute('DROP EXTENSION IF EXISTS "uuid-ossp"')
