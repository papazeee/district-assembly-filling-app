"""
Pydantic v2 schemas (request / response) for the Ada East Digital Filing System.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, field_validator

from app.models.user import UserRole, LetterType, LetterStatus, DispatchMode, NotificationType


# ═══════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ═══════════════════════════════════════════════════════════════
# DEPARTMENT
# ═══════════════════════════════════════════════════════════════

class DepartmentCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_deleted: Optional[bool] = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str]
    is_active: bool
    is_deleted:bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════
# USER
# ═══════════════════════════════════════════════════════════════

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: UserRole
    department_id: Optional[int] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    department_id: Optional[int]
    department: Optional[DepartmentOut]
    is_active: bool
    is_deleted: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# ═══════════════════════════════════════════════════════════════
# AUDIT TRAIL
# ═══════════════════════════════════════════════════════════════

class AuditTrailOut(BaseModel):
    id: int
    action: str
    from_status: Optional[LetterStatus]
    to_status: Optional[LetterStatus]
    remarks: Optional[str]
    created_at: datetime
    actor: UserOut

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════
# LETTER
# ═══════════════════════════════════════════════════════════════

class IncomingLetterCreate(BaseModel):
    reference_number: Optional[str] = None
    subject: str
    sender_name: str
    sender_org: Optional[str] = None
    date_received: datetime
    received_by_name: str          # name of person who physically received it
    notes: Optional[str] = None


class OutgoingLetterCreate(BaseModel):
    reference_number: Optional[str] = None
    subject: str
    recipient_name: str
    recipient_org: Optional[str] = None
    date_sent: Optional[datetime] = None
    dispatch_mode: DispatchMode
    notes: Optional[str] = None


class LetterForward(BaseModel):
    """Used when forwarding / routing a letter to the next stage."""
    remarks: Optional[str] = None


class LetterDispatchToDept(BaseModel):
    """Director dispatches letter to a specific department."""
    department_id: int
    remarks: Optional[str] = None


class LetterOut(BaseModel):
    id: int
    serial_number: str
    letter_type: LetterType
    status: LetterStatus
    reference_number: Optional[str]
    subject: str
    sender_name: Optional[str]
    sender_org: Optional[str]
    recipient_name: Optional[str]
    recipient_org: Optional[str]
    date_received: Optional[datetime]
    date_sent: Optional[datetime]
    dispatch_mode: Optional[DispatchMode]
    notes: Optional[str]
    file_path: Optional[str]
    file_name: Optional[str]
    received_by: Optional[UserOut]
    assigned_department: Optional[DepartmentOut]
    created_at: datetime
    updated_at: datetime
    audit_trail: List[AuditTrailOut] = []

    model_config = {"from_attributes": True}


class LetterListOut(BaseModel):
    """Lightweight version for list endpoints (no audit trail)."""
    id: int
    serial_number: str
    letter_type: LetterType
    status: LetterStatus
    subject: str
    sender_name: Optional[str]
    recipient_name: Optional[str]
    dispatch_mode: Optional[DispatchMode]
    date_received: Optional[datetime]
    date_sent: Optional[datetime]
    assigned_department: Optional[DepartmentOut]
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════
# NOTIFICATION
# ═══════════════════════════════════════════════════════════════

class NotificationOut(BaseModel):
    id: int
    type: NotificationType
    message: str
    is_read: bool
    created_at: datetime
    letter: LetterListOut

    model_config = {"from_attributes": True}


# Rebuild forward refs
TokenResponse.model_rebuild()
