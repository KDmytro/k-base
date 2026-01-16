# K-Base Deployment Guide

This guide covers deploying K-Base with:
- **Frontend**: Vercel
- **Backend**: Google Cloud Run
- **Database**: Cloud SQL (PostgreSQL)

## Prerequisites

- Google Cloud account with billing enabled
- Vercel account (free tier works)
- `gcloud` CLI installed and authenticated
- Domain name (optional, but recommended)

---

## 1. Google Cloud Setup

### 1.1 Create GCP Project

```bash
# Set your project ID
export PROJECT_ID=kbase-prod
export REGION=us-central1

# Create project
gcloud projects create $PROJECT_ID --name="K-Base"
gcloud config set project $PROJECT_ID

# Enable billing (do this in console if not set up)
# https://console.cloud.google.com/billing

# Enable required APIs
gcloud services enable \
  cloudsql.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### 1.2 Set Up Cloud SQL (PostgreSQL)

```bash
# Create Cloud SQL instance
gcloud sql instances create kbase-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --root-password=CHANGE_THIS_PASSWORD

# Create database
gcloud sql databases create kbase --instance=kbase-db

# Create user
gcloud sql users create kbase_user \
  --instance=kbase-db \
  --password=CHANGE_THIS_PASSWORD

# Enable pgvector extension (connect via Cloud SQL Auth Proxy or Cloud Shell)
# In psql:
# CREATE EXTENSION IF NOT EXISTS vector;
# CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 1.3 Set Up Google OAuth Credentials

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials → OAuth client ID**
3. Select **Web application**
4. Add authorized JavaScript origins:
   - `http://localhost:5173` (local dev)
   - `https://your-app.vercel.app` (Vercel preview)
   - `https://yourdomain.com` (production)
5. Add authorized redirect URIs (if needed later):
   - `https://your-backend-url.run.app/api/v1/auth/callback`
6. Copy **Client ID** and **Client Secret**

### 1.4 Store Secrets in Secret Manager

```bash
# Store secrets
echo -n "your-openai-api-key" | gcloud secrets create openai-api-key --data-file=-
echo -n "your-google-client-id" | gcloud secrets create google-client-id --data-file=-
echo -n "your-google-client-secret" | gcloud secrets create google-client-secret --data-file=-
echo -n "$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')" | gcloud secrets create jwt-secret-key --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Repeat for other secrets...
```

---

## 2. Backend Deployment (Cloud Run)

### 2.1 Create Dockerfile

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### 2.2 Create Cloud Run Service

```bash
cd backend

# Build and push to Artifact Registry
gcloud artifacts repositories create kbase-repo \
  --repository-format=docker \
  --location=$REGION

gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT_ID/kbase-repo/kbase-backend

# Deploy to Cloud Run
gcloud run deploy kbase-backend \
  --image=$REGION-docker.pkg.dev/$PROJECT_ID/kbase-repo/kbase-backend \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --add-cloudsql-instances=$PROJECT_ID:$REGION:kbase-db \
  --set-env-vars="APP_ENV=production" \
  --set-secrets="OPENAI_API_KEY=openai-api-key:latest,GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest,JWT_SECRET_KEY=jwt-secret-key:latest" \
  --set-env-vars="DATABASE_URL=postgresql+asyncpg://kbase_user:PASSWORD@/kbase?host=/cloudsql/$PROJECT_ID:$REGION:kbase-db"
```

### 2.3 Run Database Migrations

```bash
# Option 1: Cloud Run Job
gcloud run jobs create kbase-migrate \
  --image=$REGION-docker.pkg.dev/$PROJECT_ID/kbase-repo/kbase-backend \
  --region=$REGION \
  --add-cloudsql-instances=$PROJECT_ID:$REGION:kbase-db \
  --set-env-vars="DATABASE_URL=postgresql+asyncpg://kbase_user:PASSWORD@/kbase?host=/cloudsql/$PROJECT_ID:$REGION:kbase-db" \
  --command="alembic" \
  --args="upgrade,head"

gcloud run jobs execute kbase-migrate --region=$REGION

# Option 2: Use Cloud SQL Auth Proxy locally
# Download proxy: https://cloud.google.com/sql/docs/postgres/sql-proxy
./cloud-sql-proxy $PROJECT_ID:$REGION:kbase-db &
DATABASE_URL=postgresql+asyncpg://kbase_user:PASSWORD@localhost:5432/kbase alembic upgrade head
```

---

## 3. Frontend Deployment (Vercel)

### 3.1 Prepare for Vercel

Create `frontend/vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### 3.2 Deploy to Vercel

```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Login and deploy
vercel login
vercel

# Set environment variables
vercel env add VITE_API_URL production
# Enter: https://kbase-backend-XXXX.run.app/api/v1

vercel env add VITE_GOOGLE_CLIENT_ID production
# Enter: your-google-client-id.apps.googleusercontent.com

# Deploy to production
vercel --prod
```

Or use Vercel Dashboard:
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set root directory to `frontend`
4. Add environment variables:
   - `VITE_API_URL` = `https://your-cloud-run-url/api/v1`
   - `VITE_GOOGLE_CLIENT_ID` = your Google OAuth client ID
5. Deploy

---

## 4. Configure CORS

Update `backend/main.py` to allow your Vercel domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://your-app.vercel.app",
        "https://yourdomain.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Redeploy backend after this change.

---

## 5. Custom Domain (Optional)

### Vercel (Frontend)
1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your domain
3. Update DNS records as instructed

### Cloud Run (Backend)
```bash
# Map custom domain
gcloud run domain-mappings create \
  --service=kbase-backend \
  --domain=api.yourdomain.com \
  --region=$REGION

# Get DNS records to configure
gcloud run domain-mappings describe \
  --domain=api.yourdomain.com \
  --region=$REGION
```

---

## 6. Environment Variables Summary

### Backend (Cloud Run)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Cloud SQL connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `JWT_SECRET_KEY` | Secret for signing JWTs |
| `APP_ENV` | `production` |

### Frontend (Vercel)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |

---

## 7. Cost Optimization

### Cloud SQL
- Start with `db-f1-micro` (~$7/month)
- Enable automatic storage increases
- Set up backups (optional but recommended)

### Cloud Run
- Uses pay-per-request pricing
- Set min instances to 0 for cost savings (cold starts ~2-3s)
- Set max instances to limit costs

```bash
gcloud run services update kbase-backend \
  --min-instances=0 \
  --max-instances=10 \
  --region=$REGION
```

### Alternative: Use Supabase for Database
For lower costs, consider [Supabase](https://supabase.com):
- Free tier: 500MB database, 2GB bandwidth
- Built-in pgvector support
- Connection string works directly with the backend

---

## 8. Monitoring

```bash
# View Cloud Run logs
gcloud run services logs read kbase-backend --region=$REGION

# View in console
# https://console.cloud.google.com/run
# https://console.cloud.google.com/logs
```

---

## Troubleshooting

### Database Connection Issues
- Ensure Cloud SQL Auth is configured correctly
- Check the socket path in DATABASE_URL
- Verify the Cloud Run service account has `Cloud SQL Client` role

### CORS Errors
- Verify the frontend domain is in the allowed origins
- Check for trailing slashes in URLs

### OAuth Errors
- Ensure authorized JavaScript origins include your frontend URL
- Check that client ID matches in both frontend and backend

### Cold Start Latency
- Set `--min-instances=1` for faster responses (costs more)
- Or accept ~2-3s cold start delay

---

## Quick Deploy Checklist

- [ ] GCP project created with billing enabled
- [ ] Cloud SQL instance running with pgvector enabled
- [ ] Google OAuth credentials created
- [ ] Secrets stored in Secret Manager
- [ ] Backend Docker image built and pushed
- [ ] Cloud Run service deployed
- [ ] Database migrations run
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set in Vercel
- [ ] CORS configured for frontend domain
- [ ] OAuth origins updated with production URLs
- [ ] Test login flow end-to-end
