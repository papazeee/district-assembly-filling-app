from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles, require_write_access, hash_password
from app.models.user import User, UserRole
from app.repositories import UserRepository
from app.schemas.schemas import UserCreate, UserUpdate, UserOut

router = APIRouter(prefix="/users", tags=["User Management"])


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
   # _admin: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Admin creates a new user account."""
    repo = UserRepository(db)
    if repo.email_exists(payload.email):
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        department_id=payload.department_id,
    )
    return repo.save(user)


@router.get("/", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEST_USER)),
):
    """Admin lists all user accounts."""
    return UserRepository(db).get_all_users()


@router.get("/id/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEST_USER)),
):
    user = UserRepository(db).get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/id/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_write_access(UserRole.ADMIN)),
):
    """Admin updates a user's profile or role."""
    repo = UserRepository(db)
    user = repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    return repo.save(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_write_access(UserRole.ADMIN)),
):
    """Admin deactivates (soft-deletes) a user. Cannot deactivate yourself."""
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    repo = UserRepository(db)
    user = repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    repo.deactivate(user)

@router.patch("/restore/{user_id}")
def restore_deactivated_users(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_write_access(UserRole.ADMIN))
):
    repo = UserRepository(db)
    user = repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active=True
    user.is_deleted=False
    return repo.save(user)

@router.get("/deleted")
def deativated_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEST_USER)),
):
    repo = UserRepository(db)
    user = repo.get_deactivated()
    return user
