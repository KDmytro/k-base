# Using uv with K-Base Backend

This project uses [uv](https://github.com/astral-sh/uv) for fast Python package management.

## Quick Start

```bash
# Create virtual environment
uv venv

# Activate virtual environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install all dependencies
uv pip install -e .

# Install with dev dependencies
uv pip install -e ".[dev]"
```

## Common Commands

### Installing Packages

```bash
# Install a new package
uv pip install package-name

# Install and add to pyproject.toml (manual step needed)
uv pip install package-name
# Then add to pyproject.toml [project.dependencies] or [tool.uv.dev-dependencies]

# Sync from pyproject.toml
uv pip install -e .
```

### Running the Application

```bash
# Make sure venv is activated
source .venv/bin/activate

# Run the FastAPI server
python main.py

# Or use uvicorn directly
uvicorn main:app --reload
```

### Database Migrations

```bash
# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Testing

```bash
# Install dev dependencies
uv pip install -e ".[dev]"

# Run tests
pytest

# Run tests with coverage
pytest --cov=. --cov-report=html
```

## Why uv?

- **10-100x faster** than pip
- Written in Rust for maximum performance
- Drop-in replacement for pip
- Better dependency resolution
- Works with existing requirements.txt and pyproject.toml

## Project Structure

The project dependencies are defined in `pyproject.toml`:

- `[project.dependencies]` - Production dependencies
- `[project.optional-dependencies.dev]` or `[tool.uv.dev-dependencies]` - Development dependencies

## Troubleshooting

### Virtual environment not found
```bash
# Recreate virtual environment
uv venv --python 3.11
source .venv/bin/activate
uv pip install -e ".[dev]"
```

### Package conflicts
```bash
# Clear cache and reinstall
rm -rf .venv
uv venv
source .venv/bin/activate
uv pip install -e ".[dev]"
```

### Import errors
```bash
# Make sure you're in the virtual environment
which python  # Should show .venv/bin/python

# Reinstall in editable mode
uv pip install -e .
```

## Learn More

- [uv Documentation](https://github.com/astral-sh/uv)
- [uv vs pip Comparison](https://github.com/astral-sh/uv#benchmarks)
