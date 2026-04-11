# Backend (FastAPI)

This folder contains the API for the Digital Filing System.

## What it does

- Handles JWT authentication, password changes, and role-based access control
- Manages departments and users, including soft-delete and restore flows
- Tracks incoming and outgoing letters through the full filing workflow
- Stores uploaded letter files in the local uploads folders
- Generates serial numbers, audit trail entries, and notifications

## Main folders

```text
backend/
  .env.example      # Example environment variables
  main.py           # FastAPI app entry point and router registration
  requirements.txt  # Python dependencies
  runtime.txt       # Deployment runtime version
  seed.py           # Initial departments + admin user seed data
  app/
    core/           # config, database, security helpers
    models/         # SQLAlchemy models and enums
    repositories/   # data access layer
    routers/        # API routes
    schemas/        # request/response schemas
    services/       # business helpers
  uploads/          # incoming/outgoing files
```

## Run locally

1. Install dependencies

```bash
pip install -r requirements.txt
```

2. Create your environment file

```bash
copy .env.example .env
```

3. Seed initial data

```bash
python seed.py
```

4. Start the API

```bash
uvicorn main:app --reload
```

Open http://localhost:8000/docs for Swagger UI.

## Notes

- `seed.py` can be run multiple times; existing records are skipped.
- The default admin account is created by seeding. Change the password immediately.
- Before deployment, set a strong `SECRET_KEY` and lock down CORS origins.
- Uploaded files are served from `/uploads`, so the upload directory must remain writable.
