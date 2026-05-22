from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from database import create_tables
from socket_manager import sio
from routers import auth, projects, tasks, dashboard
from config import settings

app = FastAPI(
    title="TaskFlow API",
    description="Team Task Manager with Real-time Updates",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup
@app.on_event("startup")
def startup():
    create_tables()
    print("✅ Database tables created")

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(dashboard.notif_router, prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}

# Wrap with Socket.IO ASGI
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/socket.io")
