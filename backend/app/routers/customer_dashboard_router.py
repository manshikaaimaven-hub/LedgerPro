"""
app/routers/customer_dashboard_router.py
------------------------------------------
Everything the customer-facing dashboard needs. Every route is scoped
under /customer/{owner_id}/... and starts by resolving owner_id +
the logged-in customer_account into a Child DB customer_id via
resolve_customer_link(). From that point on, every query filters by
BOTH owner_id and customer_id — belt and suspenders tenant isolation,
even though resolve_customer_link already proved the link exists.

Security invariants enforced throughout:
- A customer can only ever see rows where customer_id == their own
  ChildCustomer.id for that specific owner.
- Deletes are soft, Child DB only — never touch Parent DB, never
  touch sync_service (Phase 3 backup path is for OWNER deletes only).
- Restore requests can only be created for transactions THIS customer
  account deleted (deleted_by_customer_account_id match) — prevents
  requesting restore on something the owner deleted for other reasons.
- Amount/type on a transaction are never customer-editable.
"""

# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from datetime import datetime, timezone
from typing import Optional, List
import uuid

from app.database.child_db import get_child_db
from app.database.parent_db import get_parent_db
from app.models.child_models import ChildCustomer, ChildTransaction, ChildRestoreRequest
from app.models.parent_models import ParentOwner, ParentCustomerAccount, ParentTransaction, ParentCustomer
from app.utils.deps import get_current_customer_account, resolve_customer_link
from app.utils.auth_utils import verify_password, hash_password
from app.services.sync_service import sync_service
from app.schemas.customer_dashboard_schemas import (
    DashboardSummaryOut, RecentTransactionOut, MonthlyBucket,
    CustomerTransactionOut, PaginatedTransactions, CustomerTransactionUpdate,
    DeletedTransactionOut, RestoreRequestCreate, RestoreRequestOut,
    OwnerInfoOut, CustomerProfileOut, CustomerProfileUpdate,
    ChangeCustomerPasswordRequest
)

# ───────────────────────────────────────────────────────────────
# Router Setup
# Every API call first verifies:
# 1. Which owner (business) the customer belongs to.
# 2. Which customer account is currently logged in.
# 3. Maps the logged-in account to the correct ChildCustomer.id.
# ───────────────────────────────────────────────────────────────

router = APIRouter(prefix="/customer/{owner_id}", tags=["Customer Dashboard"])

# ───────────────────────────────────────────────────────────────
# Helper Function
# Converts a database transaction object into the API response model.
# ───────────────────────────────────────────────────────────────
def _txn_out(t: ChildTransaction, running_balance: Optional[float] = None) -> CustomerTransactionOut:
    return CustomerTransactionOut(
        id=t.id, 
        type=t.type, 
        amount=float(t.amount), 
        note=t.note,
        invoice_number=t.invoice_number, 
        entry_date=t.entry_date,
        running_balance=running_balance,
        is_edited=bool(getattr(t, "is_edited", False)),
    )


# ═════════════════════════════════════════════════════════════
# 1. DASHBOARD SUMMARY
# ═════════════════════════════════════════════════════════════
@router.get("/summary", response_model=DashboardSummaryOut)
def get_customer_summary(
    owner_id: str,
    customer_id: str = Depends(resolve_customer_link),
    child_db: Session = Depends(get_child_db),
    ):
    """
    Steps:
    1. Fetch every active (not soft-deleted) transaction for this
       customer under this owner.
    2. Sum credit and debit — balance is always computed live, never
       stored, same rule as the owner dashboard.
    3. 'Amount paid' is framed as total_debit (payments/returns
       reduce what's owed). 'Remaining amount' floors at zero — a
       negative balance means the OWNER owes the customer, which
       isn't a 'remaining amount due' in the customer's eyes.
    4. Grab the 5 most recent transactions for the activity feed.
    5. Build a 6-month rolling bucket summary for the optional chart.
    """
    txns = child_db.query(ChildTransaction).filter(
        ChildTransaction.owner_id == owner_id,
        ChildTransaction.customer_id == customer_id,
    ).all()

    total_cr = sum(float(t.amount) for t in txns if t.type == "cr")
    total_dr = sum(float(t.amount) for t in txns if t.type == "dr")
    balance = total_cr - total_dr

    recent = sorted(txns, key=lambda t: t.entry_date, reverse=True)[:5]
    recent_out = [
        RecentTransactionOut(
            id=t.id, type=t.type, amount=float(t.amount), note=t.note,
            invoice_number=t.invoice_number, entry_date=t.entry_date,
        ) for t in recent
    ]

    # Monthly buckets — group in Python since transaction volume per
    # customer is small (dozens, not millions); a SQL group-by would
    # be premature optimization here.
    buckets: dict[str, dict[str, float]] = {}
    for t in txns:
        key = t.entry_date.strftime("%Y-%m")
        b = buckets.setdefault(key, {"cr": 0.0, "dr": 0.0})
        b["cr" if t.type == "cr" else "dr"] += float(t.amount)
    monthly = [
        MonthlyBucket(month=m, total_credit=v["cr"], total_debit=v["dr"])
        for m, v in sorted(buckets.items())[-6:]
    ]

    return DashboardSummaryOut(
        current_balance=balance,
        net_label="receivable" if balance > 0 else ("payable" if balance < 0 else "settled"),
        total_transactions=len(txns),
        total_credit=total_cr,
        total_debit=total_dr,
        amount_paid=total_dr,
        remaining_amount=max(balance, 0),
        recent_transactions=recent_out,
        monthly_summary=monthly,
    )


# ═════════════════════════════════════════════════════════════
# 2. TRANSACTIONS — list / detail / edit / delete
# ═════════════════════════════════════════════════════════════
@router.get("/transactions", response_model=PaginatedTransactions)
def list_customer_transactions(
    owner_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Matches note or invoice number"),
    type: Optional[str] = Query(None, pattern="^(cr|dr)$"),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort: str = Query("desc", pattern="^(asc|desc)$"),
    customer_id: str = Depends(resolve_customer_link),
    child_db: Session = Depends(get_child_db),
    ):
    """
    Steps:
    1. Base query: active transactions for this customer+owner.
    2. Apply optional filters — search (ILIKE on note/invoice),
       type, and a date range.
    3. Sort by entry_date per the `sort` param.
    4. Count total matches BEFORE pagination (needed for total_pages).
    5. Slice out the requested page at the database level (unlike the
       owner's running-balance endpoint, we don't need every row in
       memory here, so LIMIT/OFFSET is fine and faster).
    """
    q = child_db.query(ChildTransaction).filter(
        ChildTransaction.owner_id == owner_id,
        ChildTransaction.customer_id == customer_id,
    )

    if search:
        like = f"%{search}%"
        q = q.filter(
            (ChildTransaction.note.ilike(like)) |
            (ChildTransaction.invoice_number.ilike(like))
        )
    if type:
        q = q.filter(ChildTransaction.type == type)
    if date_from:
        q = q.filter(ChildTransaction.entry_date >= date_from)
    if date_to:
        q = q.filter(ChildTransaction.entry_date <= date_to)

    total = q.count()

    q = q.order_by(
        ChildTransaction.entry_date.desc() if sort == "desc" else ChildTransaction.entry_date.asc()
    )
    items = q.offset((page - 1) * limit).limit(limit).all()

    return PaginatedTransactions(
        items=[_txn_out(t) for t in items],
        page=page, limit=limit, total=total,
        total_pages=max(1, (total + limit - 1) // limit),
    )

# ═════════════════════════════════════════════════════════════
# 3. TRANSACTIONS — GET /transactions/{id}
# ═════════════════════════════════════════════════════════════
@router.get("/transactions/{txn_id}", response_model=CustomerTransactionOut)
def get_customer_transaction(
    owner_id: str, txn_id: str,
    customer_id: str = Depends(resolve_customer_link),
    child_db: Session = Depends(get_child_db),
    ):
    """
    Detail view — 404 if it doesn't belong to this customer/owner or is deleted.
    """
    t = child_db.query(ChildTransaction).filter(
        ChildTransaction.id == txn_id,
        ChildTransaction.owner_id == owner_id,
        ChildTransaction.customer_id == customer_id,
    ).first()
    if not t:
        raise HTTPException(404, "Transaction not found")
    return _txn_out(t)

# ═════════════════════════════════════════════════════════════
# 4. TRANSACTIONS — PUT /transactions/{id}
# ═════════════════════════════════════════════════════════════

@router.put("/transactions/{txn_id}", response_model=CustomerTransactionOut)
def update_customer_transaction(
    owner_id: str,
    txn_id: str,
    body: CustomerTransactionUpdate,
    customer_id: str = Depends(resolve_customer_link),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """
    Customer can edit:
    - type
    - amount
    - note

    If any editable field actually changes,
    is_edited is set to True.

    Non-editable fields:
    - id
    - customer_id
    - owner_id
    - invoice_number
    - entry_date
    - created_at
    - updated_at
    """

    # ---------------------------------------------------------
    # 1. Find transaction belonging to this customer + owner
    # ---------------------------------------------------------

    transaction = child_db.query(ChildTransaction).filter(
        ChildTransaction.id == txn_id,
        ChildTransaction.owner_id == owner_id,
        ChildTransaction.customer_id == customer_id,
    ).first()

    if not transaction:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    # ---------------------------------------------------------
    # 2. Track whether anything actually changed
    # ---------------------------------------------------------

    changed = False

    # ---------------------------------------------------------
    # 3. Update transaction type
    # ---------------------------------------------------------

    if body.type is not None:
        if body.type != transaction.type:
            transaction.type = body.type
            changed = True

    # ---------------------------------------------------------
    # 4. Update amount
    # ---------------------------------------------------------

    if body.amount is not None:
        if body.amount != transaction.amount:
            transaction.amount = body.amount
            changed = True

    # ---------------------------------------------------------
    # 5. Update note
    # ---------------------------------------------------------

    if body.note is not None:
        if body.note != transaction.note:
            transaction.note = body.note
            changed = True

    # ---------------------------------------------------------
    # 6. Mark transaction as edited
    # ---------------------------------------------------------

    if changed:
        transaction.is_edited = True

    # ---------------------------------------------------------
    # 7. If nothing actually changed
    # ---------------------------------------------------------

    if not changed:
        return _txn_out(transaction)

    # ---------------------------------------------------------
    # 8. Commit Child DB
    # ---------------------------------------------------------

    try:
        child_db.commit()
        child_db.refresh(transaction)

    except Exception:
        child_db.rollback()
        print("UPDATE TRANSACTION ERROR:", repr(e))
        parent_db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to update transaction",
        )

    return _txn_out(transaction)


# ═════════════════════════════════════════════════════════════
# 4. TRANSACTIONS — DELETE /transactions/{id}
# ═════════════════════════════════════════════════════════════
@router.delete("/transactions/{txn_id}")
def delete_customer_transaction(
    owner_id: str, txn_id: str,
    current=Depends(get_current_customer_account),
    customer_id: str = Depends(resolve_customer_link),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """ Customer-initiated transaction delete. 
    
    Steps: 
    1. Confirm the transaction exists in Child DB, belongs to this customer/owner, and is not already deleted. 
    2. Permanently delete the transaction from Child DB. 
    3. Mark the corresponding transaction as deleted in Parent DB. 
    4. Commit both changes. 
    
    The Child DB row is permanently removed, while the Parent DB keeps the row with is_deleted=True 
    so that the owner can use the restore flow if required.
    
    """
    # Step 1: Find the transaction in Child DB
    t = child_db.query(ChildTransaction).filter(
        ChildTransaction.id == txn_id,
        ChildTransaction.owner_id == owner_id,
        ChildTransaction.customer_id == customer_id,
    ).first()

    
    if not t:
        raise HTTPException(404, "Transaction not found")

    # Step 2: Find corresponding transaction in Parent DB 
    parent_transaction = parent_db.query(ParentTransaction).filter(
        ParentTransaction.id == txn_id, 
        ParentTransaction.owner_id == owner_id,
        ParentTransaction.customer_id == customer_id,
        ).first()

    if not parent_transaction: 
        raise HTTPException( 
            status_code=404, 
            detail="Parent transaction not found", 
            )

    try:
        # Step 3: Parmanently delete from Child DB
        child_db.delete(t)

        # Step 4: Mark as deleted in Parent DB
        parent_transaction.is_deleted = True
        parent_transaction.deleted_at = datetime.now(timezone.utc)

        # Step 5: Commit both databases
        child_db.commit()
        parent_db.commit()

    except Exception:
        child_db.rollback()
        parent_db.rollback()
        raise HTTPException(
            status_code=500,
            detail= "Failed to delete transaction",
        )

    return {
        "message": "Transaction removed. You can request a restore from Restore Requests."
    }

# ═════════════════════════════════════════════════════════════
# 5. TRANSACTIONS — GET /transactions-deleted
# ═════════════════════════════════════════════════════════════
@router.get("/transactions-deleted", response_model=List[DeletedTransactionOut])
def list_deleted_transactions(
    owner_id: str,
    current=Depends(get_current_customer_account),
    customer_id: str = Depends(resolve_customer_link),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """ 
    Return deleted transactions for the authenticated customer. 
    
    Transaction deletion architecture: 
    -  Child DB: transaction is permanently deleted. 
    - Parent DB: transaction remains with is_deleted=True. 
    
    Therefore, deleted transaction history must be retrieved from Parent DB. For each deleted transaction, 
    check whether the customer has already submitted a restore request that is pending or approved. 
    
    """

    # Step 1: Get deleted transactions from Parent DB
    deleted = parent_db.query(ParentTransaction).filter(
        ParentTransaction.owner_id == owner_id,
        ParentTransaction.customer_id == customer_id,
        ParentTransaction.is_deleted == True,
    ).order_by(ParentTransaction.deleted_at.desc()).all()


    # Step 2: Get existing restore requests from Child DB.
    existing_ids = {
        r.record_id for r in child_db.query(ChildRestoreRequest).filter(
            ChildRestoreRequest.owner_id == owner_id,
            ChildRestoreRequest.table_name == "transactions",
            ChildRestoreRequest.requested_by_user_id == current["customer_account_id"],
            ChildRestoreRequest.status.in_(["pending", "approved"]),
        ).all()
    }

    # Step 3: Return deleted transaction history
    return [
        DeletedTransactionOut(
            id=t.id, 
            type=t.type, 
            amount=float(t.amount), 
            note=t.note,
            invoice_number=t.invoice_number, 
            entry_date=t.entry_date,
            deleted_at=t.deleted_at, 
            already_requested=t.id in existing_ids,
        ) 
        for t in deleted
    ]

# ═════════════════════════════════════════════════════════════
# 6. TRANSACTIONS — GET /transactions-edited
# ═════════════════════════════════════════════════════════════
@router.get("/transactions-edited", response_model=List[DeletedTransactionOut])
def list_edited_transactions(
    owner_id: str,
    current=Depends(get_current_customer_account),
    customer_id: str = Depends(resolve_customer_link),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """ 
    Return edited transactions for the authenticated customer. 
    
    Transaction edited architecture: 
    -  Child DB: In transaction is_edited = True. 
    - Parent DB: transaction caontain original value. 
    """

    # Step 1: Get edited transactions from Child DB
    edited_transactions = (
        child_db.query(ChildTransaction)
        .filter(
            ChildTransaction.owner_id == owner_id,
            ChildTransaction.customer_id == customer_id,
            ChildTransaction.is_edited == True,
        )
        .all()
    )


    # Step 2: Get existing restore requests from Child DB.
    existing_ids = {
        r.record_id for r in child_db.query(ChildRestoreRequest).filter(
            ChildRestoreRequest.owner_id == owner_id,
            ChildRestoreRequest.table_name == "transactions",
            ChildRestoreRequest.requested_by_user_id == current["customer_account_id"],
            ChildRestoreRequest.status.in_(["pending", "approved"]),
        ).all()
    }

    # Step 3: Return edited transaction history in the same restore-request shape as deleted transactions.
    return [
       DeletedTransactionOut(
            id=t.id,
            type=t.type,
            amount=float(t.amount),
            note=t.note,
            invoice_number=t.invoice_number,
            entry_date=t.entry_date,
            deleted_at=None,
            already_requested=t.id in existing_ids,
        )
        for t in edited_transactions
    ]

# ═════════════════════════════════════════════════════════════
# 6. TRANSACTIONS — POST /restore-requests
# ═════════════════════════════════════════════════════════════
@router.post("/restore-requests", status_code=201, response_model=List[RestoreRequestOut])
def create_restore_requests(
    owner_id: str,
    body: RestoreRequestCreate,
    current=Depends(get_current_customer_account),
    customer_id: str = Depends(resolve_customer_link),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """
    Create restore requests for customer-deleted and customer-edited
    transactions.

    Transaction architecture:

    Deleted transaction:
    - Child DB: transaction is permanently deleted.
    - Parent DB: transaction remains with is_deleted=True.

    Edited transaction:
    - Child DB: transaction still exists with is_edited=True.

    RestoreRequest is always stored in Child DB.

    Supports:
    - Selected transactions using transaction_ids
    - All eligible transactions using restore_all=True
    """

    # =========================================================
    # 1. GET DELETED TRANSACTIONS
    # =========================================================

    deleted_query = parent_db.query(ParentTransaction).filter(
        ParentTransaction.owner_id == owner_id,
        ParentTransaction.customer_id == customer_id,
        ParentTransaction.is_deleted == True,
    )

    # =========================================================
    # 2. GET EDITED TRANSACTIONS
    # =========================================================

    edited_query = child_db.query(ChildTransaction).filter(
        ChildTransaction.owner_id == owner_id,
        ChildTransaction.customer_id == customer_id,
        ChildTransaction.is_edited == True,
    )

    # =========================================================
    # 3. APPLY SELECTION FILTER
    # =========================================================

    if body.restore_all:

        deleted_transactions = deleted_query.all()
        edited_transactions = edited_query.all()

    else:

        if not body.transaction_ids:
            raise HTTPException(
                status_code=400,
                detail="Provide transaction_ids or set restore_all=true",
            )

        deleted_transactions = deleted_query.filter(
            ParentTransaction.id.in_(body.transaction_ids)
        ).all()

        edited_transactions = edited_query.filter(
            ChildTransaction.id.in_(body.transaction_ids)
        ).all()

    # =========================================================
    # 4. CHECK WHETHER ANY TRANSACTION IS ELIGIBLE
    # =========================================================

    if not deleted_transactions and not edited_transactions:
        raise HTTPException(
            status_code=400,
            detail="No eligible transactions found for a restore request",
        )

    created = []

    # =========================================================
    # 5. CREATE REQUESTS FOR DELETED TRANSACTIONS
    # =========================================================

    for transaction in deleted_transactions:

        already = child_db.query(ChildRestoreRequest).filter(
            ChildRestoreRequest.record_id == transaction.id,
            ChildRestoreRequest.table_name == "transactions",
            ChildRestoreRequest.status.in_(["pending", "approved"]),
        ).first()

        if already:
            continue

        req = ChildRestoreRequest(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            requested_by_user_id=current["customer_account_id"],
            table_name="transactions",
            record_id=transaction.id,
            status="pending",
            customer_note=body.note,
        )

        child_db.add(req)
        child_db.flush()

        created.append(
            RestoreRequestOut(
                id=req.id,
                transaction_id=transaction.id,
                transaction_snapshot=_txn_out(transaction),
                status=req.status,
                customer_note=req.customer_note,
                owner_response=req.owner_response,
                created_at=req.created_at,
                resolved_at=req.resolved_at,
            )
        )

    # =========================================================
    # 6. CREATE REQUESTS FOR EDITED TRANSACTIONS
    # =========================================================

    for transaction in edited_transactions:

        already = child_db.query(ChildRestoreRequest).filter(
            ChildRestoreRequest.record_id == transaction.id,
            ChildRestoreRequest.table_name == "transactions",
            ChildRestoreRequest.status.in_(["pending", "approved"]),
        ).first()

        if already:
            continue

        req = ChildRestoreRequest(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            requested_by_user_id=current["customer_account_id"],
            table_name="transactions",
            record_id=transaction.id,
            status="pending",
            customer_note=body.note,
        )

        child_db.add(req)
        child_db.flush()

        created.append(
            RestoreRequestOut(
                id=req.id,
                transaction_id=transaction.id,
                transaction_snapshot=_txn_out(transaction),
                status=req.status,
                customer_note=req.customer_note,
                owner_response=req.owner_response,
                created_at=req.created_at,
                resolved_at=req.resolved_at,
            )
        )

    # =========================================================
    # 7. NO NEW REQUESTS CREATED
    # =========================================================

    if not created:
        raise HTTPException(
            status_code=400,
            detail="Restore requests already exist for the selected transactions",
        )

    # =========================================================
    # 8. COMMIT
    # =========================================================

    child_db.commit()

    return created


# ═════════════════════════════════════════════════════════════
# 7. RESTORE REQUESTS - GET /restore-requests
# ═════════════════════════════════════════════════════════════
@router.get("/restore-requests", response_model=List[RestoreRequestOut])
def list_restore_requests(
    owner_id: str,
    current=Depends(get_current_customer_account),
    child_db: Session = Depends(get_child_db),
    ):
    """
    Steps:
    1. Fetch every restore request THIS customer account has made for
       this owner, newest first.
    2. For each, look up the transaction (still in Child DB — deleted
       or restored, either way it's findable by id) to build a snapshot.
    """
    reqs = child_db.query(ChildRestoreRequest).filter(
        ChildRestoreRequest.owner_id == owner_id,
        ChildRestoreRequest.table_name == "transactions",
        ChildRestoreRequest.requested_by_user_id == current["customer_account_id"],
    ).order_by(ChildRestoreRequest.created_at.desc()).all()

    out = []
    for r in reqs:
        t = child_db.query(ChildTransaction).filter(ChildTransaction.id == r.record_id).first()
        out.append(RestoreRequestOut(
            id=r.id, transaction_id=r.record_id,
            transaction_snapshot=_txn_out(t) if t else None,
            status=r.status, customer_note=r.customer_note,
            owner_response=r.owner_response, created_at=r.created_at,
            resolved_at=r.resolved_at,
        ))
    return out


# ═════════════════════════════════════════════════════════════
# 8. SETTINGS — owner info (read-only) + customer profile
# ═════════════════════════════════════════════════════════════
@router.get("/owner-info", response_model=OwnerInfoOut)
def get_owner_info(
    owner_id: str,
    _customer_id: str = Depends(resolve_customer_link),  # proves access, unused otherwise
    parent_db: Session = Depends(get_parent_db),
    ):
    """Read-only — the link check above is what gates access; this never accepts writes."""
    owner = parent_db.query(ParentOwner).filter(ParentOwner.id == owner_id).first()
    if not owner:
        raise HTTPException(404, "Business not found")
    return OwnerInfoOut(
        full_name=owner.full_name, business_name=owner.business_name,
        email=owner.email, phone=owner.phone, city=owner.city,
    )

# ═════════════════════════════════════════════════════════════
# 9. Customer Profile - GET /profile
# ═════════════════════════════════════════════════════════════
@router.get("/profile", response_model=CustomerProfileOut)
def get_customer_profile(
    owner_id: str,
    current=Depends(get_current_customer_account),
    customer_id: str = Depends(resolve_customer_link),
    child_db: Session = Depends(get_child_db),
    ):
    """Blends the ChildCustomer record (business-specific: phone/address/notes) with the account's login identity (email/username)."""
    print(current)
    c = child_db.query(ChildCustomer).filter(
        ChildCustomer.id == customer_id, ChildCustomer.owner_id == owner_id,
    ).first()
    if not c:
        raise HTTPException(404, "Customer record not found")
    return CustomerProfileOut(
        name=c.name, email=current["email"], phone=c.phone,
        address=c.address, notes=c.notes, username=current["username"],
    )

# ═════════════════════════════════════════════════════════════
# 10. Update Profile - PUT /profile
# ═════════════════════════════════════════════════════════════
@router.put("/profile", response_model=CustomerProfileOut)
def update_customer_profile(
    owner_id: str, body: CustomerProfileUpdate,
    current=Depends(get_current_customer_account),
    customer_id: str = Depends(resolve_customer_link),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """
    Steps:
    1. Fetch the ChildCustomer row.
    2. Apply only the provided fields — email is intentionally never
       accepted here (it's the account identity, changing it belongs
       in a separate, more careful flow with re-verification).
    3. Commit to Child DB, then mirror to Parent (standard write rule
       — only DELETES skip the parent mirror for customer actions).
    """
    c = child_db.query(ChildCustomer).filter(
        ChildCustomer.id == customer_id, ChildCustomer.owner_id == owner_id,
    ).first()
    if not c:
        raise HTTPException(404, "Customer record not found")

    if body.name is not None:
        c.name = body.name
    if body.phone is not None:
        c.phone = body.phone
    if body.address is not None:
        c.address = body.address
    if body.notes is not None:
        c.notes = body.notes

    child_db.commit()
    child_db.refresh(c)

    # Mirror to Parent DB — adjust the model/field names if your
    # ParentCustomer sync helper differs from sync_transaction_to_parent.
    sync_service.sync_customer_to_parent(c, parent_db, ParentCustomer)

    return CustomerProfileOut(
        name=c.name, email=current["email"], phone=c.phone,
        address=c.address, notes=c.notes, username=current["username"],
    )

# ═════════════════════════════════════════════════════════════
# 11. Change Password - PUT /change-password
# ═════════════════════════════════════════════════════════════
@router.put("/change-password")
def change_customer_password(
    owner_id: str,  # kept in the path for URL consistency with the rest of the router
    body: ChangeCustomerPasswordRequest,
    current=Depends(get_current_customer_account),
    parent_db: Session = Depends(get_parent_db),
    ):
    """
    Account-level, not owner-scoped underneath — a customer has ONE
    password across every business they're linked to. owner_id in the
    path is just for routing consistency with the rest of the settings UI.
    """
    account = parent_db.query(ParentCustomerAccount).filter(
        ParentCustomerAccount.id == current["customer_account_id"]
    ).first()
    if not account or not verify_password(body.current_password, account.hashed_password):
        raise HTTPException(400, "Current password is incorrect")

    account.hashed_password = hash_password(body.new_password)
    parent_db.commit()
    return {"message": "Password updated successfully"}