"""
UserRepository – all database queries related to users.
"""
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, db: Session):
        super().__init__(User, db)

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    def get_active_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(
            User.email == email,
            User.is_active == True
        ).first()

    def get_active_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(
            User.id == user_id,
            User.is_active == True
        ).first()
    
    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()
    
    def get_all_active(self) -> List[User]:
        return (
            self.db.query(User).filter(User.is_active == True, User.is_deleted==False)
            .order_by(User.full_name)
            .all()
        )
    
    def get_all_users(self) -> List[User]:
        return (
            self.db.query(User).all()
        )
    
    def get_by_role(self, role: UserRole) -> List[User]:
        return (
            self.db.query(User)
            .filter(User.role == role, User.is_active == True)
            .all()
        )

    def get_by_role_and_department(self, role: UserRole, department_id: int) -> List[User]:
        return (
            self.db.query(User)
            .filter(
                User.role == role,
                User.department_id == department_id,
                User.is_active == True,
            )
            .all()
        )

    def email_exists(self, email: str) -> bool:
        return self.db.query(User).filter(User.email == email).first() is not None

    def deactivate(self, user: User) -> User:
        user.is_active = False
        #user.is_deleted = True
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_deactivated(self) -> List[User]:
        return (
            self.db.query(User).filter(User.is_active == False).all()
        )