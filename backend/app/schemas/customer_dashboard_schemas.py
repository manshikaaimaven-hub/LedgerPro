"""
app/schemas/customer_dashboard_schemas.py
-------------------------------------------
Pydantic models for every customer-dashboard request/response.
Grouped by feature area to match the router below.
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime


# ── Dashboard summary ──────────────────────────────────────────
class RecentTransactionOut(BaseModel):
    id: str
    type: str
    amount: float
    note: Optional[str] = None
    invoice_number: Optional[str] = None
    entry_date: datetime


class MonthlyBucket(BaseModel):
    month: str          # "2026-06"
    total_credit: float
    total_debit: float


class DashboardSummaryOut(BaseModel):
    current_balance: float
    net_label: str                 # "receivable" | "payable" | "settled"
    total_transactions: int
    total_credit: float
    total_debit: float
    amount_paid: float             # = total_debit (payments/returns reduce balance)
    remaining_amount: float        # = max(current_balance, 0)
    recent_transactions: List[RecentTransactionOut]
    monthly_summary: List[MonthlyBucket]


# ── Transactions ────────────────────────────────────────────────
class CustomerTransactionOut(BaseModel):
    id: str
    type: str
    amount: float
    note: Optional[str] = None
    invoice_number: Optional[str] = None
    entry_date: datetime
    running_balance: Optional[float] = None
    is_edited: bool = False

class PaginatedTransactions(BaseModel):
    items: List[CustomerTransactionOut]
    page: int
    limit: int
    total: int
    total_pages: int


class CustomerTransactionUpdate(BaseModel):
    """
    Deliberately narrow: only note + invoice_number are editable by a
    customer. Amount/type are the manufacturer's source of truth for
    the ledger — letting a customer change either would let them
    rewrite what they owe. If they dispute an amount, that's a
    conversation with the owner (or a future 'raise dispute' feature),
    not a silent edit here.
    """
    type: Optional[Literal["cr", "dr"]] = None
    amount: Optional[float] = Field(None, gt=0)
    note: Optional[str] = Field(None, max_length=2000)
    invoice_number: Optional[str] = Field(None, max_length=100)


class DeletedTransactionOut(BaseModel):
    id: str
    type: str
    amount: float
    note: Optional[str] = None
    invoice_number: Optional[str] = None
    entry_date: datetime
    deleted_at: Optional[datetime] = None
    already_requested: bool   # true if a pending/approved request exists


# ── Restore requests ────────────────────────────────────────────
# class RestoreRequestCreate(BaseModel):
#     transaction_ids: List[str] = Field(..., min_length=1)
#     note: Optional[str] = Field(None, max_length=1000)
class RestoreRequestCreate(BaseModel):
    restore_all: bool = False
    transaction_ids: list[str] = Field(default_factory=list)
    note: str | None = None


class RestoreRequestOut(BaseModel):
    id: str
    transaction_id: str
    transaction_snapshot: Optional[CustomerTransactionOut] = None
    status: str
    customer_note: Optional[str] = None
    owner_response: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None


# ── Owner info (read-only) ──────────────────────────────────────
class OwnerInfoOut(BaseModel):
    full_name: str
    business_name: str
    email: str
    phone: Optional[str] = None
    city: Optional[str] = None


# ── Customer profile ────────────────────────────────────────────
class CustomerProfileOut(BaseModel):
    name: str
    email: str            # read-only — the login identity, never editable here
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    username: str


class CustomerProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=1000)
    notes: Optional[str] = Field(None, max_length=2000)


class ChangeCustomerPasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=4)

# ── Owner Dashboard  ────────────────────────────────────────────
class RestoreCustomerOut(BaseModel):
    customer_id: str
    customer_name: str
    pending_count: int

    model_config = ConfigDict(from_attributes=True)