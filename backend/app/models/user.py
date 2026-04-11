"""
SQLAlchemy ORM models for Ada East District Assembly Digital Filing System.
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey,
    Integer, String, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship

from app.core.database import Base


# ── Enumerations ──────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    ADMIN           = "ADMIN"
    RECORDS         = "RECORDS"           # Records department officer
    DIRECTOR        = "DIRECTOR"          # Director of the Assembly
    DCE             = "DCE"               # District Chief Executive
    DEPARTMENT_HEAD = "DEPARTMENT_HEAD"   # Head of any functional department
    TEST_USER       = "TEST_USER"         # Read-only admin; cannot modify Departments or Users


class LetterType(str, enum.Enum):
    INCOMING = "INCOMING"
    OUTGOING = "OUTGOING"


class LetterStatus(str, enum.Enum):
    # Incoming workflow
    RECEIVED_BY_RECORDS  = "RECEIVED_BY_RECORDS"
    WITH_DIRECTOR        = "WITH_DIRECTOR"
    WITH_DCE             = "WITH_DCE"
    RETURNED_TO_DIRECTOR = "RETURNED_TO_DIRECTOR"
    DISPATCHED_TO_DEPT   = "DISPATCHED_TO_DEPT"
    CLOSED               = "CLOSED"
    # Outgoing (mirrors incoming but reversed direction)
    OUTGOING_DRAFT       = "OUTGOING_DRAFT"
    OUTGOING_SENT        = "OUTGOING_SENT"


class DispatchMode(str, enum.Enum):
    HAND_DELIVERY  = "HAND_DELIVERY"
    POSTAL         = "POSTAL"
    EMAIL          = "EMAIL"
    WHATSAPP       = "WHATSAPP"
    COURIER        = "COURIER"
    FAX            = "FAX"


class NotificationType(str, enum.Enum):
    LETTER_ASSIGNED  = "LETTER_ASSIGNED"
    LETTER_FORWARDED = "LETTER_FORWARDED"
    LETTER_RETURNED  = "LETTER_RETURNED"
    LETTER_CLOSED    = "LETTER_CLOSED"


# ── Department ────────────────────────────────────────────────────────────────

class Department(Base):
    __tablename__ = "departments"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(150), unique=True, nullable=False)
    code        = Column(String(20),  unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, default=True)
    is_deleted  = Column(Boolean, default=False)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    users   = relationship("User",   back_populates="department")
    letters = relationship("Letter", back_populates="assigned_department")


# ── User ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    full_name       = Column(String(150), nullable=False)
    email           = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role            = Column(Enum(UserRole), nullable=False)
    department_id   = Column(Integer, ForeignKey("departments.id"), nullable=True)
    is_active       = Column(Boolean, default=True)
    is_deleted      = Column(Boolean, default=False)
    created_at      = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at      = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                             onupdate=lambda: datetime.now(timezone.utc))

    department       = relationship("Department", back_populates="users")
    trail_entries    = relationship("AuditTrail",   back_populates="actor")
    notifications    = relationship("Notification", back_populates="recipient")
    letters_received = relationship("Letter", foreign_keys="Letter.received_by_id", back_populates="received_by")


# ── Letter ────────────────────────────────────────────────────────────────────

class Letter(Base):
    __tablename__ = "letters"

    id            = Column(Integer, primary_key=True, index=True)

    # Auto-generated serial: e.g.  2025/IN/001  or  2025/OUT/001
    serial_number = Column(String(30), unique=True, index=True, nullable=False)

    letter_type   = Column(Enum(LetterType),   nullable=False)
    status        = Column(Enum(LetterStatus), nullable=False)

    # Common metadata
    reference_number = Column(String(100), nullable=True)
    subject          = Column(String(300), nullable=False)
    sender_name      = Column(String(150), nullable=True)   # for INCOMING
    sender_org       = Column(String(200), nullable=True)   # for INCOMING
    recipient_name   = Column(String(150), nullable=True)   # for OUTGOING
    recipient_org    = Column(String(200), nullable=True)   # for OUTGOING

    date_received    = Column(DateTime(timezone=True), nullable=True)  # INCOMING
    date_sent        = Column(DateTime(timezone=True), nullable=True)  # OUTGOING
    dispatch_mode    = Column(Enum(DispatchMode), nullable=True)       # OUTGOING

    notes            = Column(Text, nullable=True)

    # File attachment (local path, relative to UPLOAD_DIR)
    file_path        = Column(String(500), nullable=True)
    file_name        = Column(String(255), nullable=True)

    # Routing
    received_by_id        = Column(Integer, ForeignKey("users.id"),       nullable=True)
    assigned_department_id= Column(Integer, ForeignKey("departments.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    received_by          = relationship("User",       foreign_keys=[received_by_id], back_populates="letters_received")
    assigned_department  = relationship("Department", back_populates="letters")
    audit_trail          = relationship("AuditTrail", back_populates="letter", order_by="AuditTrail.created_at")
    notifications        = relationship("Notification", back_populates="letter")


# ── Audit Trail ───────────────────────────────────────────────────────────────

class AuditTrail(Base):
    __tablename__ = "audit_trail"

    id         = Column(Integer, primary_key=True, index=True)
    letter_id  = Column(Integer, ForeignKey("letters.id"), nullable=False)
    actor_id   = Column(Integer, ForeignKey("users.id"),   nullable=False)
    action     = Column(String(100), nullable=False)   # e.g. "Forwarded to Director"
    from_status= Column(Enum(LetterStatus), nullable=True)
    to_status  = Column(Enum(LetterStatus), nullable=True)
    remarks    = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    letter = relationship("Letter",    back_populates="audit_trail")
    actor  = relationship("User",      back_populates="trail_entries")


# ── Notification ──────────────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    id           = Column(Integer, primary_key=True, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"),   nullable=False)
    letter_id    = Column(Integer, ForeignKey("letters.id"), nullable=False)
    type         = Column(Enum(NotificationType), nullable=False)
    message      = Column(String(500), nullable=False)
    is_read      = Column(Boolean, default=False)
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    recipient = relationship("User",   back_populates="notifications")
    letter    = relationship("Letter", back_populates="notifications")
