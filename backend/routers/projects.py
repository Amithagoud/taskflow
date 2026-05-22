from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from database import get_db
from models import Project, ProjectMember, User, Task, TaskStatus, UserRole
from schemas import (
    ProjectCreate, ProjectUpdate, ProjectOut, ProjectMemberOut,
    AddMemberRequest, UpdateMemberRole, UserOut
)
from auth import get_current_user
from socket_manager import emit_to_project
import asyncio

router = APIRouter(prefix="/projects", tags=["projects"])

def get_project_or_404(project_id: str, db: Session) -> Project:
    project = db.query(Project).options(
        joinedload(Project.members).joinedload(ProjectMember.user),
        joinedload(Project.owner)
    ).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

def get_member_or_403(project: Project, user_id: str) -> ProjectMember:
    member = next((m for m in project.members if m.user_id == user_id), None)
    if not member and project.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Not a member of this project")
    return member

def require_admin(project: Project, user_id: str):
    if project.owner_id == user_id:
        return
    member = next((m for m in project.members if m.user_id == user_id), None)
    if not member or member.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")

def enrich_project(project: Project, db: Session) -> dict:
    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    data = {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "color": project.color,
        "owner_id": project.owner_id,
        "is_archived": project.is_archived,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "members": project.members,
        "task_count": len(tasks),
        "done_count": sum(1 for t in tasks if t.status == TaskStatus.done),
    }
    return data

@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = Project(
        name=payload.name,
        description=payload.description,
        color=payload.color or "#6366f1",
        owner_id=current_user.id,
    )
    db.add(project)
    db.flush()

    # Add creator as admin member
    member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role=UserRole.admin,
    )
    db.add(member)
    db.commit()
    db.refresh(project)
    project = get_project_or_404(project.id, db)
    return enrich_project(project, db)

@router.get("", response_model=List[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get all projects where user is a member
    memberships = db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).all()
    project_ids = [m.project_id for m in memberships]
    
    projects = db.query(Project).options(
        joinedload(Project.members).joinedload(ProjectMember.user)
    ).filter(Project.id.in_(project_ids)).all()
    
    return [enrich_project(p, db) for p in projects]

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    get_member_or_403(project, current_user.id)
    return enrich_project(project, db)

@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    require_admin(project, current_user.id)
    
    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.description is not None:
        project.description = payload.description
    if payload.color is not None:
        project.color = payload.color
    if payload.is_archived is not None:
        project.is_archived = payload.is_archived
    
    db.commit()
    db.refresh(project)
    project = get_project_or_404(project_id, db)
    result = enrich_project(project, db)
    
    await emit_to_project(project_id, "project_updated", {"project_id": project_id, "name": project.name})
    return result

@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can delete project")
    
    db.delete(project)
    db.commit()
    await emit_to_project(project_id, "project_deleted", {"project_id": project_id})

@router.post("/{project_id}/members", response_model=ProjectMemberOut, status_code=201)
async def add_member(
    project_id: str,
    payload: AddMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    require_admin(project, current_user.id)
    
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found with that email")
    
    existing = next((m for m in project.members if m.user_id == user.id), None)
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member")
    
    member = ProjectMember(
        project_id=project_id,
        user_id=user.id,
        role=payload.role,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    
    await emit_to_project(project_id, "member_added", {
        "project_id": project_id,
        "user": {"id": user.id, "name": user.name, "email": user.email}
    })
    
    # Reload with relationships
    member = db.query(ProjectMember).options(joinedload(ProjectMember.user)).filter(ProjectMember.id == member.id).first()
    return member

@router.patch("/{project_id}/members/{user_id}", response_model=ProjectMemberOut)
def update_member_role(
    project_id: str,
    user_id: str,
    payload: UpdateMemberRole,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    require_admin(project, current_user.id)
    
    if user_id == project.owner_id:
        raise HTTPException(status_code=400, detail="Cannot change owner's role")
    
    member = db.query(ProjectMember).options(joinedload(ProjectMember.user)).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    member.role = payload.role
    db.commit()
    db.refresh(member)
    return member

@router.delete("/{project_id}/members/{user_id}", status_code=204)
async def remove_member(
    project_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    require_admin(project, current_user.id)
    
    if user_id == project.owner_id:
        raise HTTPException(status_code=400, detail="Cannot remove the owner")
    
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    db.delete(member)
    db.commit()
    
    await emit_to_project(project_id, "member_removed", {"project_id": project_id, "user_id": user_id})

@router.get("/{project_id}/members", response_model=List[ProjectMemberOut])
def list_members(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    get_member_or_403(project, current_user.id)
    
    members = db.query(ProjectMember).options(joinedload(ProjectMember.user)).filter(
        ProjectMember.project_id == project_id
    ).all()
    return members
