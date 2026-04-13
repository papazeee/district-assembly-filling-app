# Ada East Digital Filing System

## Live Demo: https://district-assembly-filling-app-h6ri.vercel.app
 ### Test Credentials
 - Email: testuser@adaeast.gov.gh
 - Password: test_user

## Project Overview

A full-stack web application designed to digitize and streamline the handling of incoming and outgoing official letters within the Ada East District Assembly, Ghana.

## Why This Project Matters
District Assemblies often rely on manual filling systems that are:
- Slow
- Difficult to track
- Prone to errors and loss of documents

This system improves:
- Accountability
- Transparency
- Workflow efficiency
- Document traceability

## Current Capabilities

- Role-based authentication (Admin, Records Officer, District Director, DCE, Department Head)
- Full letter workflow form intake -> review -> dispatch -> closure
- Incoming and Outgoing letter management with file uploads
- Real-time notification with read/unread tracking
- Audit trail for all actions
- Department and user management
- Search, filtering, and detail views

## Tech Stack

- Backend: FastAPI, SQLAlchemy, JWT authentication
- Database: SQLite (development) or PostgreSQL (production)
- Frontend: HTML, CSS, vanilla JavaScript

## Features

- **User Authentication**: Secure login with JWT tokens and role-based access control (Admin, Records Officer, Department Head, The DCE, The Director)
- **Incoming Letters**: Log and track received official letters with picture or PDF uploads and status management
- **Outgoing Letters**: Create and manage outgoing letters with serialization and dispatch tracking
- **Department Management**: Organize letters by destination or originating department
- **User Management**: Create and manage system users with different roles and permissions
- **Notifications**: Automatic notifications for letter movements and status updates
- **Dashboard**: Overview of system activity with quick access to all main functions
- **Digital Storage**: Centralized file storage for all incoming and outgoing letters
- **Serial Number Generation**: Automatic unique serial numbering for outgoing letters

## App Workflow

1. A user logs in with role-based access control.
2. Records staff register incoming letters and upload any attachments.
3. The Director reviews incoming letters and forwards them to the DCE or dispatches them to a department.
4. The DCE can approve and return letters to the Director
5. Department heads receive dispatched letters, work on them, add a report, and return them to the Director.
6. The Director closes completed letters when the workflow is finished.
7. Users create outgoing letters, assign dispatch details, and mark them as sent.
8. Notifications and audit trails keep track of every action in the system.

## Screenshots

### Login Page
![Login Page](screenshots/login.png)

### Dashboard
![Dashboard Overview](screenshots/dashboard.png)

### Incoming and Outgoing letters
![Incoming Letters](screenshots/incoming-letters.png)
![Outgoing Letters](screenshots/outgoing-letters.png)

### User Management
![User Management](screenshots/user-management.png)

### Departments
![Departments](screenshots/departments.png)

### Notification
![Notification](screenshots/notification.png)


## App Demo Video

[Watch Full App Demo](demo/app-demo.mp4)

## Challenges Faced
- Designing role-based workflows across multiple users
- Handling file uploads
  
## Repository Structure

```
.
├── README.md                         # Main project documentation
├── LICENSE
├── styles.css                        # Shared root-level styles for the landing page
├── vercel.json                       # Frontend deployment and API proxy config
├── demo/                             # Demo video assets
├── screenshots/                      # UI preview images used in documentation
├── frontend/                         # Static HTML, CSS, and vanilla JavaScript UI
│   ├── index.html                    # Entry redirect to the login page
│   ├── css/
│   │   ├── variables.css            # Theme tokens, spacing, and color variables
│   │   ├── layout.css               # Page structure and responsive layout
│   │   ├── components.css           # Shared UI components
│   │   └── login.css                # Login page styles
│   ├── js/
│   │   ├── app.js                   # Shared API/auth utilities and UI helpers
│   │   ├── dashboard.js             # Dashboard data and summaries
│   │   ├── departments.js          # Department management UI
│   │   ├── incoming.js             # Incoming letter workflow UI
│   │   ├── outgoing.js             # Outgoing letter workflow UI
│   │   ├── letter-detail.js         # Full letter details and audit trail view
│   │   ├── notifications.js         # Notification inbox and read actions
│   │   ├── profile.js               # Profile and password change UI
│   │   ├── sidebar.js               # Navigation and sidebar behavior
│   │   └── users.js                 # User administration UI
│   └── pages/
│       ├── 404.html
│       ├── dashboard.html
│       ├── departments.html
│       ├── incoming.html
│       ├── letter-detail.html
│       ├── login_index.html
│       ├── notifications.html
│       ├── outgoing.html
│       ├── profile.html
│       └── users.html
├── backend/                          # FastAPI backend application
│   ├── README.md                    # Backend API overview and run instructions
│   ├── .env.example                 # Example environment variables
│   ├── main.py                      # FastAPI app setup, CORS, and route registration
│   ├── requirements.txt             # Python dependencies
│   ├── runtime.txt                  # Runtime version for deployment
│   ├── seed.py                      # Initial admin user and department seed data
│   └── app/
│       ├── core/                    # Configuration, database, and security helpers
│       ├── models/                  # SQLAlchemy ORM models and enums
│       ├── repositories/            # Data access layer for users, letters, departments, notifications
│       ├── routers/                 # API endpoints for auth, users, departments, letters, notifications
│       ├── schemas/                 # Pydantic request and response models
│       └── services/                # Workflow helpers such as serial generation and notifications
└── uploads/                          # Stored incoming/outgoing letter attachments
    ├── incoming/
    └── outgoing/
```

## Quick Start

### 1. Start backend API

```bash
cd backend
pip install -r requirements.txt
copy .env.example .env
python seed.py
uvicorn main:app --reload
```

### 2. Open frontend
- Run index.html

#### Frontend Configuration

The frontend automatically detects its environment and configures 
the API URL accordingly:

- **Deployed (Vercel)** — API calls are proxied through Vercel to 
  the live backend. No configuration needed.

- **Local (file://)** — API calls go to `http://localhost:8000/api/v1`. 
  Make sure the backend is running locally.

- **Local (live server)** — API calls go to the same origin. 
  Make sure your local server proxies `/api/v1` to the backend.

To override the API URL manually, set it in your browser console:
  localStorage.setItem('apiBaseUrl', 'https://your-backend.com/api/v1');


## API + Workflow Documentation

Detailed backend API and workflow docs are in:

- backend/README.md


## Roadmap

- Automated tests for auth, workflow transitions, repositories, and key UI flows
- CI/CD integration
- Docker support
- Improved search and pagination
- Better UI/UX mobile responsiveness
- Reporting and analytics

The app already covers the core filing workflow, so the next steps will focus on reliability, observability, and day-to-day usability
