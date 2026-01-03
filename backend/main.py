"""Main FastAPI application."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting K-Base API server...")
    logger.info(f"Environment: {settings.app_env}")
    logger.info(f"Debug mode: {settings.debug}")
    yield
    logger.info("Shutting down K-Base API server...")


# Create FastAPI app
app = FastAPI(
    title="K-Base API",
    description="API for K-Base: Branching Brainstorming & Learning App",
    version="1.0.0",
    docs_url="/api/docs" if settings.is_development else None,
    redoc_url="/api/redoc" if settings.is_development else None,
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "K-Base API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "environment": settings.app_env
    }


# TODO: Import and include routers
# from api.routes import topics, sessions, nodes, chat, memory
# app.include_router(topics.router, prefix="/api/v1/topics", tags=["topics"])
# app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["sessions"])
# app.include_router(nodes.router, prefix="/api/v1/nodes", tags=["nodes"])
# app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
# app.include_router(memory.router, prefix="/api/v1/memory", tags=["memory"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development
    )
