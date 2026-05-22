import socketio
from typing import Dict, Set

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

# Track connected users: user_id -> set of socket_ids
connected_users: Dict[str, Set[str]] = {}
# Track socket_id -> user_id
socket_to_user: Dict[str, str] = {}

@sio.event
async def connect(sid, environ, auth):
    print(f"[Socket] Client connected: {sid}")

@sio.event
async def disconnect(sid):
    user_id = socket_to_user.pop(sid, None)
    if user_id and user_id in connected_users:
        connected_users[user_id].discard(sid)
        if not connected_users[user_id]:
            del connected_users[user_id]
    print(f"[Socket] Client disconnected: {sid}")

@sio.event
async def authenticate(sid, data):
    """Client sends their user_id after connecting"""
    user_id = data.get("user_id")
    if user_id:
        socket_to_user[sid] = user_id
        if user_id not in connected_users:
            connected_users[user_id] = set()
        connected_users[user_id].add(sid)
        await sio.enter_room(sid, f"user_{user_id}")
        print(f"[Socket] User {user_id} authenticated on {sid}")

@sio.event
async def join_project(sid, data):
    """Join a project room for real-time updates"""
    project_id = data.get("project_id")
    if project_id:
        await sio.enter_room(sid, f"project_{project_id}")

@sio.event
async def leave_project(sid, data):
    project_id = data.get("project_id")
    if project_id:
        await sio.leave_room(sid, f"project_{project_id}")

async def emit_to_project(project_id: str, event: str, data: dict):
    """Emit event to all members of a project"""
    await sio.emit(event, data, room=f"project_{project_id}")

async def emit_to_user(user_id: str, event: str, data: dict):
    """Emit event to a specific user"""
    await sio.emit(event, data, room=f"user_{user_id}")

async def emit_task_update(project_id: str, task_data: dict, event_type: str = "task_updated"):
    await emit_to_project(project_id, event_type, {"task": task_data})

async def emit_notification(user_id: str, notification_data: dict):
    await emit_to_user(user_id, "notification", {"notification": notification_data})
