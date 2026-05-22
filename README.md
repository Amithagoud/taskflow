# 🚀 TaskFlow — Real-Time Team Task Manager

A full-stack team task manager with real-time collaboration, role-based access control, and a Kanban board. Built with **FastAPI + PostgreSQL** (backend) and **Next.js 14** (frontend), connected by **Socket.io WebSockets**.

---

## 🖥️ Live Demo

| Service | URL |
|---------|-----|
| Frontend | `https://taskflow-frontend.up.railway.app` |
| Backend API | `https://taskflow-backend.up.railway.app` |
| API Docs | `https://taskflow-backend.up.railway.app/docs` |

**Demo credentials:**
- Email: `demo@taskflow.app`
- Password: `demo123`

---

## ✨ Features

### Authentication & Users
- JWT-based signup/login with bcrypt password hashing
- Persistent sessions (7-day token expiry)
- Avatar colors auto-assigned per user

### Projects
- Create, edit, archive, delete projects
- Color-coded project cards with progress bars
- Member overview with avatars

### Team Management (Role-Based Access)
- **Admin**: Full control — create/delete tasks, manage members, change roles, edit project settings
- **Member**: Create tasks, update own tasks, add comments
- Invite members by email address
- Change member roles (Admin ↔ Member)
- Remove members from project

### Task Management (Kanban Board)
- Three columns: **To Do → In Progress → Done**
- Create, edit, delete tasks with full details
- Set **priority** (Low / Medium / High) with color indicators
- Set **due dates** with overdue detection + warnings
- **Assign tasks** to project members
- Quick status cycling with one click
- Comment threads on each task

### Real-Time (WebSockets via Socket.io)
- Task created/updated/deleted broadcasts to all project members instantly
- Member added/removed events
- Comment added events
- In-app notification bell with live badge counter
- Toast popups for incoming notifications

### Dashboard
- Stats: Total tasks, In Progress, Completed, Overdue, My Tasks
- Overall progress bar
- My assigned tasks list with due dates and priority badges
- Greeting based on time of day

---

## 🏗️ Architecture

```
taskflow/
├── backend/                   # FastAPI + PostgreSQL
│   ├── main.py                # App entrypoint + Socket.io ASGI wrapper
│   ├── models.py              # SQLAlchemy ORM models
│   ├── schemas.py             # Pydantic request/response schemas
│   ├── auth.py                # JWT auth + password hashing
│   ├── database.py            # DB connection + session
│   ├── socket_manager.py      # Socket.io server + room management
│   ├── config.py              # Settings from environment
│   └── routers/
│       ├── auth.py            # POST /auth/register, /auth/login, /auth/me
│       ├── projects.py        # CRUD /projects + /members
│       ├── tasks.py           # CRUD /projects/{id}/tasks + comments
│       └── dashboard.py       # GET /dashboard, /my-tasks, /notifications
│
└── frontend/                  # Next.js 14 (App Router)
    └── src/
        ├── app/
        │   ├── (app)/         # Protected route group
        │   │   ├── layout.tsx # Sidebar + top bar + socket init
        │   │   ├── dashboard/ # Stats + my tasks
        │   │   └── projects/  # Project list + [id] Kanban board
        │   ├── login/
        │   └── register/
        ├── lib/
        │   ├── api.ts         # Axios client + all API calls
        │   ├── socket.ts      # Socket.io client + room helpers
        │   └── utils.ts       # Dates, colors, formatters
        ├── store/
        │   ├── authStore.ts   # Zustand auth state
        │   └── notificationStore.ts
        └── types/index.ts     # TypeScript interfaces
```

---

## 🗄️ Database Schema

```
users              → id, email, name, hashed_password, avatar_color
projects           → id, name, description, color, owner_id, is_archived
project_members    → id, project_id, user_id, role (admin|member)
tasks              → id, title, description, status, priority, project_id,
                     assignee_id, creator_id, due_date
comments           → id, content, task_id, author_id
notifications      → id, user_id, title, message, is_read, type,
                     related_task_id, related_project_id
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get JWT |
| GET | `/api/auth/me` | Get current user |
| PATCH | `/api/auth/me` | Update profile |

### Projects
| Method | Endpoint | Role |
|--------|----------|------|
| GET | `/api/projects` | Any member |
| POST | `/api/projects` | Any user |
| GET | `/api/projects/{id}` | Member |
| PATCH | `/api/projects/{id}` | Admin |
| DELETE | `/api/projects/{id}` | Owner |
| POST | `/api/projects/{id}/members` | Admin |
| PATCH | `/api/projects/{id}/members/{uid}` | Admin |
| DELETE | `/api/projects/{id}/members/{uid}` | Admin |

### Tasks
| Method | Endpoint | Role |
|--------|----------|------|
| GET | `/api/projects/{id}/tasks` | Member |
| POST | `/api/projects/{id}/tasks` | Member |
| GET | `/api/projects/{id}/tasks/{tid}` | Member |
| PATCH | `/api/projects/{id}/tasks/{tid}` | Member/Creator/Admin |
| DELETE | `/api/projects/{id}/tasks/{tid}` | Creator/Admin |
| GET | `/api/projects/{id}/tasks/{tid}/comments` | Member |
| POST | `/api/projects/{id}/tasks/{tid}/comments` | Member |

### Dashboard & Notifications
| Method | Endpoint |
|--------|----------|
| GET | `/api/dashboard` |
| GET | `/api/my-tasks` |
| GET | `/api/notifications` |
| GET | `/api/notifications/unread-count` |
| PATCH | `/api/notifications/{id}/read` |
| PATCH | `/api/notifications/mark-all-read` |

---

## ⚡ WebSocket Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `authenticate` | `{user_id}` | Identify user after connect |
| `join_project` | `{project_id}` | Subscribe to project room |
| `leave_project` | `{project_id}` | Unsubscribe from project room |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `task_created` | `{task}` | New task in project |
| `task_updated` | `{task}` | Task modified |
| `task_deleted` | `{task_id}` | Task removed |
| `member_added` | `{project_id, user}` | New member joined |
| `member_removed` | `{project_id, user_id}` | Member removed |
| `comment_added` | `{task_id, comment}` | New comment |
| `notification` | `{notification}` | Personal notification |
| `project_updated` | `{project_id, name}` | Project metadata changed |
| `project_deleted` | `{project_id}` | Project removed |

---

## 🚀 Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL 14+ (or Docker)

### Option A: Docker Compose (Recommended)

```bash
# Clone the repo
git clone https://github.com/your-username/taskflow.git
cd taskflow

# Start everything (postgres + backend + frontend)
docker-compose up --build

# Open: http://localhost:3000
```

### Option B: Manual Setup

**Backend:**
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# Run the server
uvicorn main:socket_app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Set environment variables
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:8000

# Run dev server
npm run dev
```

---

## 🚂 Railway Deployment

### Step 1 — Create a Railway project
1. Go to [railway.app](https://railway.app) → New Project
2. Add a **PostgreSQL** service (click "+ New" → Database → PostgreSQL)
3. Copy the `DATABASE_URL` from the PostgreSQL service's Variables tab

### Step 2 — Deploy the Backend
1. Click "+ New" → GitHub Repo → select your repo
2. Set the **Root Directory** to `backend`
3. Set these **Environment Variables**:
   ```
   DATABASE_URL=<your-postgres-url-from-step-1>
   SECRET_KEY=<generate-with: openssl rand -hex 32>
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=10080
   FRONTEND_URL=https://your-frontend.up.railway.app
   ```
4. Railway auto-detects the Dockerfile. Deploy!
5. Copy the generated domain, e.g. `taskflow-backend.up.railway.app`

### Step 3 — Deploy the Frontend
1. Click "+ New" → GitHub Repo → select your repo again
2. Set the **Root Directory** to `frontend`
3. Set these **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://taskflow-backend.up.railway.app
   NEXT_PUBLIC_SOCKET_URL=https://taskflow-backend.up.railway.app
   ```
4. Deploy!

### Step 4 — Update CORS
Go back to your backend service and update:
```
FRONTEND_URL=https://your-actual-frontend-domain.up.railway.app
```
Redeploy the backend.

---

## 🔒 Security Notes

- Passwords hashed with **bcrypt** (cost factor 12)
- JWT tokens signed with **HS256**
- RBAC enforced at the API layer on every endpoint
- CORS restricted to the frontend domain in production
- SQL injection prevented by SQLAlchemy ORM with parameterized queries

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | FastAPI 0.111 |
| Database ORM | SQLAlchemy 2.0 |
| Database | PostgreSQL 16 |
| Authentication | JWT (python-jose) + bcrypt (passlib) |
| WebSockets | python-socketio 5.x |
| Frontend framework | Next.js 14 (App Router) |
| State management | Zustand |
| Data fetching | TanStack Query v5 |
| Styling | Tailwind CSS 3 |
| Real-time client | socket.io-client 4.x |
| Deployment | Railway (Docker) |

---

## 📄 License

MIT — free to use for personal and commercial projects.
