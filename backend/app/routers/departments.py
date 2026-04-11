from typing import List
from unicodedata import name

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_roles, require_write_access, get_current_user
from app.models.user import Department, UserRole, User
from app.repositories import DepartmentRepository
from app.schemas.schemas import DepartmentCreate, DepartmentUpdate, DepartmentOut

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.post("/", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_write_access(UserRole.ADMIN)),
):
    repo = DepartmentRepository(db)
    if repo.code_exists(payload.code):
        raise HTTPException(status_code=409, detail="Department code already exists")
    dept = Department(**payload.model_dump())
    return repo.save(dept)

@router.get("/", response_model=List[DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
   # _: User = Depends(get_current_user),
):
    """Any authenticated user can list departments."""
    repo = DepartmentRepository(db)
    return repo.get_all_dept()

@router.get("/code/{dept_code}", response_model=DepartmentOut)
def get_department(
    dept_code: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    dept_code = dept_code.upper()
    dept = DepartmentRepository(db).get_by_code(dept_code)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept

@router.patch("/id/{dept_id}", response_model=DepartmentOut)
def update_department(
    dept_id: int,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_write_access(UserRole.ADMIN)),
):
    repo = DepartmentRepository(db)
    dept = repo.get_by_id(dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(dept, field, value)
    return repo.save(dept)

@router.get("/list deleted", response_model=List[DepartmentOut])
def list_deleted_departments(
    db: Session = Depends(get_db),
   # _admin: User = Depends(require_write_access(UserRole.ADMIN)),
):
    repo = DepartmentRepository(db)
    dept = repo.get_all_deleted()
    return dept

@router.delete("/delete", response_model=DepartmentOut)
def delete_department(
    dept_code: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_write_access(UserRole.ADMIN)),
):
    repo = DepartmentRepository(db)
    dept_code = dept_code.upper()
    dept = repo.get_by_code(dept_code)
    
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.is_active = False
    dept.is_deleted = True
    return repo.save(dept)

@router.post("/restore", response_model=DepartmentOut)
def restore_department(
    dept_code: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_write_access(UserRole.ADMIN)),
):
    repo = DepartmentRepository(db)
    dept_code = dept_code.upper()
    dept = repo.get_by_code(dept_code)
    
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.is_active = True
    dept.is_deleted = False
    return repo.save(dept)
