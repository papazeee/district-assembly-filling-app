"""
DepartmentRepository – all database queries related to departments.
"""
import code
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.user import Department
from app.repositories.base import BaseRepository


class DepartmentRepository(BaseRepository[Department]):
    def __init__(self, db: Session):
        super().__init__(Department, db)

    def get_by_code(self, code: str) -> Optional[Department]:
        return self.db.query(Department).filter(Department.code == code).first()

    def get_by_name(self, name: str) -> Optional[Department]:
        return self.db.query(Department).filter(Department.name == name).first()

    def get_all_active(self) -> List[Department]:
        return self.db.query(Department).filter(Department.is_active == True).all()
    
    def get_all_deleted(self) -> List[Department]:
        return self.db.query(Department).filter(Department.is_deleted == True).all()

    def get_all_dept(self) -> List[Department]:
        return self.db.query(Department).filter(Department.is_deleted == False).all()

    def code_exists(self, code: str) -> bool:
        return self.db.query(Department).filter(Department.code == code).first() is not None

    def get_active_by_id(self, dept_id: int) -> Optional[Department]:
        return self.db.query(Department).filter(
            Department.id == dept_id,
            Department.is_active == True
        ).first()