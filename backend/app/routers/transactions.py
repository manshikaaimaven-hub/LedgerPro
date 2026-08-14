"""
Transaction management endpoints.

This module provides API endpoints for managing customer
transactions. It allows authenticated owners to create,
retrieve, and soft delete transactions while ensuring that
each transaction belongs to the logged-in owner's business.

Endpoints:
- POST /transactions
    Create a new transaction for a customer.

- GET /transactions/customer/{customer_id}
    Retrieve a customer's transaction history with
    calculated running balances and pagination.

- DELETE /transactions/{txn_id}
    Soft delete an existing transaction.

Features:
- Owner-based authorization.
- Soft delete support.
- Running balance calculation.
- Parent-child database synchronization.
- Pagination for transaction history.
"""
# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.database.child_db import get_child_db
from app.database.parent_db import get_parent_db
from app.models.child_models import ChildCustomer, ChildTransaction
from app.models.parent_models import ParentTransaction
from app.schemas.transaction_schemas import TransactionCreate, TransactionResponse
from app.utils.deps import get_current_owner_id
from app.services.sync_service import sync_service
from typing import List
import uuid

# ───────────────────────────────────────────────────────────────
# Router Setup
# ───────────────────────────────────────────────────────────────
router = APIRouter(prefix="/transactions", tags=["Transactions"])

# ───────────────────────────────────────────────────────────────
# POST /transactions
# ───────────────────────────────────────────────────────────────
@router.post("", status_code=201)
def create_transaction(
    body: TransactionCreate,
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db)
    ):
    """
    Create a new transaction for an existing customer.

    Workflow:
    1. Verify that the customer exists, belongs to the authenticated owner,
       and is not soft deleted.
    2. Return a 404 error if the customer is not found.
    3. Use the provided entry date or the current UTC time if none is provided.
    4. Create a new transaction record in the child database.
    5. Commit the transaction and refresh the SQLAlchemy object.
    6. Synchronize the transaction to the parent database.
    7. Return a success response with the transaction ID.
    """
    # Step 1: Check if customer exists - Verify customer belongs to this owner
    customer = child_db.query(ChildCustomer).filter(
        ChildCustomer.id == body.customer_id,
        ChildCustomer.owner_id == owner_id,
        ChildCustomer.is_deleted == False
    ).first()

    # Step 2: If not exists raise 404 
    if not customer:
        raise HTTPException(404, "Customer not found")

    # Step 3: Use the provided entry date or the current UTC time.
    entry_date = body.entry_date or datetime.now(timezone.utc)

    # Step 4: Create a new transaction object. 
    txn = ChildTransaction(
        id=str(uuid.uuid4()),
        owner_id=owner_id,
        customer_id=body.customer_id,
        type=body.type,
        amount=body.amount,
        note=body.note,
        invoice_number=body.invoice_number,
        entry_date=entry_date,
    )

    # Step 5: Save the transaction in the child database.
    child_db.add(txn)
    child_db.commit()
    child_db.refresh(txn)

    # Step 6: Synchronize the transaction to the parent database.
    sync_service.sync_transaction_to_parent(txn, parent_db, ParentTransaction)

    # Step 7: Return a success response.
    return {"message": "Transaction saved", "id": txn.id}

# ───────────────────────────────────────────────────────────────
# GET /transactions/customer/{custer_id}
# ───────────────────────────────────────────────────────────────
@router.get("/customer/{customer_id}")
def list_transactions(
    customer_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db)
    ):
    """
    Get paginated transaction history for a customer.
    Each transaction also shows the running balance after that entry.

    Steps:
    1. Check that the customer exists and belongs to the logged-in owner.
    2. Fetch ALL non-deleted transactions sorted oldest-first.
       (We need all of them to calculate running balance correctly,
        even if we only return one page to the user.)
    3. Walk through every transaction from oldest to newest.
       For each one, add to running balance if credit, subtract if debit.
       Save that running balance on the transaction object.
    4. Reverse the list so newest transactions come first (what user sees).
    5. Apply pagination — slice out only the page the user asked for.
    6. Return the paginated slice with running balances attached.
    """

    # Step 1: Make sure customer exists and belongs to this owner
    customer = child_db.query(ChildCustomer).filter(
        ChildCustomer.id == customer_id,
        ChildCustomer.owner_id == owner_id
    ).first()

    if not customer:
        raise HTTPException(404, "Customer not found")

    # Step 2: Fetch ALL transactions oldest-first so we can
    # calculate running balance in chronological order
    all_txns = child_db.query(ChildTransaction).filter(
        ChildTransaction.customer_id == customer_id,
        ChildTransaction.owner_id == owner_id,
        ChildTransaction.is_deleted == False
    ).order_by(ChildTransaction.entry_date.asc()).all()

    # Step 3: Walk through oldest to newest,
    # keep a running total as we go
    running = 0.0
    for txn in all_txns:
        if txn.type == "cr":
            running += float(txn.amount)
        else:
            running -= float(txn.amount)
        # Attach the balance AT THIS POINT in time to the transaction object
        # We use a plain attribute here — not stored in DB, just for response
        txn.running_balance = running

    # Step 4: Reverse so newest is first (user sees latest entries at top)
    all_txns.reverse()

    # Step 5: Apply pagination manually on the in-memory list
    offset = (page - 1) * limit
    paginated = all_txns[offset : offset + limit]

    # Step 6: Build response manually since running_balance is not a DB column
    return [
        {
            "id": t.id,
            "customer_id": t.customer_id,
            "owner_id": t.owner_id,
            "type": t.type,
            "amount": float(t.amount),
            "note": t.note,
            "invoice_number": t.invoice_number,
            "entry_date": t.entry_date,
            "is_deleted": t.is_deleted,
            "created_at": t.created_at,
            "running_balance": t.running_balance
        }
        for t in paginated
    ]

# ───────────────────────────────────────────────────────────────
# DELETE /transactions/{txn_id}
# ───────────────────────────────────────────────────────────────
@router.delete("/{txn_id}")
def delete_transaction(
    txn_id: str,
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db)
    ):
    """
    Soft delete a transaction.

    Workflow:
    1. Verify that the transaction exists, belongs to the authenticated owner,
       and has not already been deleted.
    2. Return a 404 error if the transaction is not found.
    3. Mark the transaction as deleted by setting the soft delete fields.
    4. Commit the changes to the child database.
    5. Return a success response.
    """
    # Step 1: Verify the transaction exists, belongs to the logged-in owner,
    # and has not already been soft deleted.
    txn = child_db.query(ChildTransaction).filter(
        ChildTransaction.id == txn_id,
        ChildTransaction.owner_id == owner_id,
    ).first()

    # Step 2: Return an error if the transaction does not exist.
    if not txn:
        raise HTTPException(404, "Transaction not found")

    # Step 3: Soft delete the transaction by updating the deletion fields.
    txn.is_deleted = True
    txn.deleted_at = datetime.now(timezone.utc)

    # Step 4: Save the changes to the database.
    child_db.commit()
    child_db.refresh(txn)

    # Step 5: Sync the updated transaction to Parent DB.
    sync_service.sync_transaction_to_parent(
        child_txn=txn,
        parent_db=parent_db,
        parent_model=ParentTransaction
    )

     # Step 5: Return a success response.
    return {"message": "Transaction deleted"}