# Quick Start Guide - Get K-Base Running NOW

Follow these steps to get K-Base running locally in minutes.

## Step 1: Database Setup

```bash
# Check if PostgreSQL is running
psql --version

# Start PostgreSQL if needed
brew services start postgresql@15

# Create database
createdb kbase

# Install pgvector (if not already installed)
brew install pgvector

# Enable vector extension
psql kbase -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql kbase -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

## Step 2: Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies with pip
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and add your OpenAI API key
# You MUST add: OPENAI_API_KEY=sk-your-actual-key-here
open .env  # or use: nano .env

# Run database migrations
alembic upgrade head

# Start the server
python main.py
```

Backend will run at: http://localhost:8000
API Docs: http://localhost:8000/api/docs

## Step 3: Frontend Setup (New Terminal)

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will run at: http://localhost:5173

## Troubleshooting

### Database connection error?
```bash
# Make sure PostgreSQL is running
brew services list | grep postgresql

# Restart if needed
brew services restart postgresql@15
```

### OpenAI API key error?
- Get your key from: https://platform.openai.com/api-keys
- Add it to backend/.env: `OPENAI_API_KEY=sk-...`

### Import errors in Python?
```bash
# Reinstall dependencies
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend not building?
```bash
# Clear and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
```
