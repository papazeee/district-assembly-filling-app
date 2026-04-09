# Backend (FastAPI)

This folder contains the API for the Digital Filing System.

## What it does

- Handles authentication and user roles
- Manages departments and users
- Tracks incoming and outgoing letters
- Stores letter files in uploads folders
- Generates notifications

## Main folders

```text
backend/
  app/
    core/           # config, database, security helpers
    models/         # SQLAlchemy models
    repositories/   # data access layer
    routers/        # API routes
    schemas/        # request/response schemas
    services/       # business helpers
  uploads/          # incoming/outgoing files
  main.py           # app entry point
  seed.py           # initial departments + admin user
```

## Run locally

1. Install dependencies

```bash
pip install -r requirements.txt

2. Create your environment file

```bash
copy .env.example .env

3. Seed initial data

```bash
python seed.py


4. Start the API

```bash
uvicorn main:app --reload

Open http://localhost:8000/docs for Swagger UI.

## Notes

- `seed.py` can be run multiple times; existing records are skipped.
- The default admin account is created by seeding. Change the password immediately.
- Before deployment, set a strong `SECRET_KEY` and lock down CORS origins.
