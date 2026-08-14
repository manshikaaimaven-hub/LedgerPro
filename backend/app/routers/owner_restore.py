# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import List
from collections import defaultdict

from app.database.child_db import get_child_db
from app.database.parent_db import get_parent_db
from app.models.child_models import ChildRestoreRequest, ChildTransaction, ChildCustomer
from app.models.parent_models import ParentTransaction
from app.schemas.customer_dashboard_schemas import RestoreRequestOut, RestoreCustomerOut, CustomerTransactionOut
from app.utils.deps import get_current_owner_id
from app.routers.customer_dashboard_router import _txn_out

# ───────────────────────────────────────────────────────────────
# Router Setup
# ───────────────────────────────────────────────────────────────
router = APIRouter(tags=["Owner Restore"])


# ───────────────────────────────────────────────────────────────
# Request schemas MUST be defined before the endpoints
# ───────────────────────────────────────────────────────────────
class RestoreRequestDecision(BaseModel):
    owner_response: str | None = None


class BulkRestoreRequestDecision(BaseModel):
    request_ids: List[str]
    owner_response: str | None = None
    

def _parent_txn_out(t: ParentTransaction) -> CustomerTransactionOut:
    return CustomerTransactionOut(
        id=t.id,
        type=t.type,
        amount=float(t.amount),
        note=t.note,
        invoice_number=t.invoice_number,
        entry_date=t.entry_date,
        running_balance=None,
        is_edited=False,
    )
# ───────────────────────────────────────────────────────────────
# GET /restore-requests/customers
# ───────────────────────────────────────────────────────────────
@router.get("/restore-requests/customers", response_model=List[RestoreCustomerOut])
def get_restore_request_customers(
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """
    Return customers that have submitted restore requests.

    The transaction itself may no longer exist in Child DB,
    so customer_id is obtained from ParentTransaction.
    """

    requests = (
        child_db.query(ChildRestoreRequest)
        .filter(
            ChildRestoreRequest.owner_id == owner_id,
            ChildRestoreRequest.table_name == "transactions",
            ChildRestoreRequest.status == "pending",
        )
        .all()
    )

    customer_ids = set()

    for req in requests:
        transaction = (
            parent_db.query(ParentTransaction)
            .filter(
                ParentTransaction.id == req.record_id,
                ParentTransaction.owner_id == owner_id,
            )
            .first()
        )

        if transaction:
            customer_ids.add(transaction.customer_id)

    result = []

    for customer_id in customer_ids:

        pending_count = 0

        for req in requests:
            transaction = (
                parent_db.query(ParentTransaction)
                .filter(
                    ParentTransaction.id == req.record_id,
                    ParentTransaction.customer_id == customer_id,
                    ParentTransaction.owner_id == owner_id,
                )
                .first()
            )

            if transaction:
                pending_count += 1

        customer = (
            child_db.query(ChildCustomer)
            .filter(
                ChildCustomer.id == customer_id,
                ChildCustomer.owner_id == owner_id,
            )
            .first()
        )

        if customer:
            result.append(
                RestoreCustomerOut(
                    customer_id=customer.id,
                    customer_name=customer.name,
                    pending_count=pending_count,
                )
            )

    return result

# ───────────────────────────────────────────────────────────────
# GET /restore-requests/customers/{customer_id}
# ───────────────────────────────────────────────────────────────
@router.get("/restore-requests/customers/{customer_id}", response_model=List[RestoreRequestOut])
def get_customer_restore_requests(
    customer_id: str,
    status: str | None = "pending",
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """
    Get restore requests for a specific customer.

    Transactions are loaded from Parent DB because they have
    been permanently deleted from Child DB.
    """

    query = (
        child_db.query(ChildRestoreRequest)
        .filter(
            ChildRestoreRequest.owner_id == owner_id,
            ChildRestoreRequest.table_name == "transactions",
        )
    )

    if status:
        query = query.filter(
            ChildRestoreRequest.status == status
        )

    requests = query.order_by(
        ChildRestoreRequest.created_at.desc()
    ).all()

    result = []

    for req in requests:

        transaction = (
            parent_db.query(ParentTransaction)
            .filter(
                ParentTransaction.id == req.record_id,
                ParentTransaction.owner_id == owner_id,
                ParentTransaction.customer_id == customer_id,
            )
            .first()
        )

        if not transaction:
            continue

        result.append(
            RestoreRequestOut(
                id=req.id,
                transaction_id=transaction.id,
                transaction_snapshot=_parent_txn_out(transaction),
                status=req.status,
                customer_note=req.customer_note,
                owner_response=req.owner_response,
                created_at=req.created_at,
                resolved_at=req.resolved_at,
            )
        )

    return result


# ───────────────────────────────────────────────────────────────
# GET /restore-requests
# ───────────────────────────────────────────────────────────────
@router.get("/restore-requests", response_model=List[RestoreRequestOut])
def get_owner_restore_requests(
    status: str | None = None,
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """
    Retrieve restore requests for the authenticated owner.

    The owner can use this endpoint to view restore requests
    submitted by customers for soft-deleted transactions.

    Steps:
    1. Verify the authenticated owner matches the requested owner_id.
    2. Query restore requests belonging to this owner.
    3. Optionally filter by request status.
    4. Load the related transaction.
    5. Return the restore request along with a transaction snapshot
       so the owner UI does not need a separate transaction API call.
    """

    query = child_db.query(ChildRestoreRequest).filter(
        ChildRestoreRequest.owner_id == owner_id,
        ChildRestoreRequest.table_name == "transactions",
    )

    # Optional status filter.
    # Example:
    # GET /restore-requests?status=pending
    if status:
        query = query.filter(
            ChildRestoreRequest.status == status
        )

    requests = query.order_by(
        ChildRestoreRequest.created_at.desc()
    ).all()

    result: list[RestoreRequestOut] = []

    for req in requests:

        child_transaction = (
            child_db.query(ChildTransaction)
            .filter(
                ChildTransaction.id == req.record_id,
                ChildTransaction.owner_id == owner_id,
            )
            .first()
        )

        if child_transaction:
            snapshot = _txn_out(child_transaction)
        else:
            parent_transaction = (
                parent_db.query(ParentTransaction)
                .filter(
                    ParentTransaction.id == req.record_id,
                    ParentTransaction.owner_id == owner_id,
                )
                .first()
            )

            snapshot = (
                _parent_txn_out(parent_transaction)
                if parent_transaction
                else None
            )

        result.append(
            RestoreRequestOut(
                id=req.id,
                transaction_id=req.record_id,
                transaction_snapshot=snapshot,
                status=req.status,
                customer_note=req.customer_note,
                owner_response=req.owner_response,
                created_at=req.created_at,
                resolved_at=req.resolved_at,
            )
        )

    return result

# ───────────────────────────────────────────────────────────────
# PUT /restore-requests/approve
# ───────────────────────────────────────────────────────────────

@router.put("/restore-requests/approve", response_model=List[RestoreRequestOut],)
def approve_restore_requests(
    body: BulkRestoreRequestDecision,
    owner_id: str = Depends(get_current_owner_id),
    parent_db: Session = Depends(get_parent_db),
    child_db: Session = Depends(get_child_db),
    ):
    """
    Approve multiple restore requests.

    There are two types of restore requests:

    1. DELETED TRANSACTION
       - ParentTransaction.is_deleted == True
       - ChildTransaction does not exist
       - Recreate the transaction in Child DB
       - Set ParentTransaction.is_deleted = False

    2. EDITED TRANSACTION
       - ParentTransaction.is_deleted == False
       - ChildTransaction exists
       - ChildTransaction.is_edited == True
       - Keep the ChildTransaction
       - Copy the customer's edited values to ParentTransaction
       - Set ChildTransaction.is_edited = False

    In both cases the RestoreRequest is marked as approved.
    """

    # =========================================================
    # 1. Validate request IDs
    # =========================================================

    if not body.request_ids:
        raise HTTPException(
            status_code=400,
            detail="At least one restore request must be selected",
        )

    request_ids = set(body.request_ids)

    # =========================================================
    # 2. Load restore requests
    # =========================================================

    requests = (
        child_db.query(ChildRestoreRequest)
        .filter(
            ChildRestoreRequest.id.in_(request_ids),
            ChildRestoreRequest.owner_id == owner_id,
            ChildRestoreRequest.table_name == "transactions",
        )
        .all()
    )

    if len(requests) != len(request_ids):
        raise HTTPException(
            status_code=404,
            detail="One or more restore requests were not found",
        )

    results = []

    try:

        # =====================================================
        # 3. Process every restore request
        # =====================================================

        for req in requests:

            # -------------------------------------------------
            # Request must still be pending
            # -------------------------------------------------

            if req.status != "pending":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Restore request {req.id} "
                        f"is already {req.status}"
                    ),
                )

            # -------------------------------------------------
            # Get transaction from Parent DB
            # -------------------------------------------------

            parent_transaction = (
                parent_db.query(ParentTransaction)
                .filter(
                    ParentTransaction.id == req.record_id,
                    ParentTransaction.owner_id == owner_id,
                )
                .first()
            )

            if not parent_transaction:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        f"Transaction {req.record_id} "
                        "was not found in Parent DB"
                    ),
                )

            # -------------------------------------------------
            # Get transaction from Child DB
            # -------------------------------------------------

            child_transaction = (
                child_db.query(ChildTransaction)
                .filter(
                    ChildTransaction.id == req.record_id,
                    ChildTransaction.owner_id == owner_id,
                )
                .first()
            )

            # =================================================
            # CASE 1: DELETED TRANSACTION
            # =================================================

            if parent_transaction.is_deleted:

                # A deleted transaction should not exist
                # in Child DB.

                if child_transaction:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Transaction {req.record_id} is marked "
                            "deleted in Parent DB but still exists "
                            "in Child DB"
                        ),
                    )

                # -------------------------------------------------
                # Recreate transaction in Child DB
                # -------------------------------------------------

                restored_transaction = ChildTransaction(
                    id=parent_transaction.id,
                    customer_id=parent_transaction.customer_id,
                    owner_id=parent_transaction.owner_id,
                    type=parent_transaction.type,
                    amount=parent_transaction.amount,
                    note=parent_transaction.note,
                    invoice_number=parent_transaction.invoice_number,
                    entry_date=parent_transaction.entry_date,
                    created_at=parent_transaction.created_at,
                    updated_at=datetime.utcnow(),
                    is_edited=False,
                )

                child_db.add(restored_transaction)

                # -------------------------------------------------
                # Mark Parent transaction as active
                # -------------------------------------------------

                parent_transaction.is_deleted = False
                parent_transaction.deleted_at = None
                parent_transaction.updated_at = datetime.utcnow()

                transaction_for_response = restored_transaction

            # =================================================
            # CASE 2: EDITED TRANSACTION
            # =================================================

            else:

                # The transaction must exist in Child DB because
                # only the transaction details were edited.

                if not child_transaction:
                    raise HTTPException(
                        status_code=404,
                        detail=(
                            f"Edited transaction {req.record_id} "
                            "was not found in Child DB"
                        ),
                    )

                # The transaction must still be marked as edited.

                if not child_transaction.is_edited:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Transaction {req.record_id} "
                            "is no longer marked as edited"
                        ),
                    )

                # -------------------------------------------------
                # Customer's edited values rechange from parent db
                # -------------------------------------------------

                child_transaction.type  = parent_transaction.type
                child_transaction.amount =  parent_transaction.amount
                child_transaction.note  =  parent_transaction.note
                child_transaction.invoice_number = (
                    parent_transaction.invoice_number
                )
                child_transaction.entry_date = (
                    child_transaction.entry_date
                )
                child_transaction.updated_at = datetime.utcnow()

                child_transaction.is_edited = False

                transaction_for_response = child_transaction

            # =================================================
            # 4. Mark restore request as approved
            # =================================================

            req.status = "approved"
            req.owner_response = body.owner_response
            req.resolved_at = datetime.utcnow()

            results.append(
                (
                    req,
                    transaction_for_response,
                )
            )

        # =====================================================
        # 5. Commit both databases
        # =====================================================

        child_db.commit()
        parent_db.commit()

    except HTTPException:
        child_db.rollback()
        parent_db.rollback()
        raise

    except Exception as exc:
        child_db.rollback()
        parent_db.rollback()

        print("APPROVE RESTORE ERROR:", repr(exc))

        raise HTTPException(
            status_code=500,
            detail="Failed to approve restore requests",
        ) from exc

    # =========================================================
    # 6. Build response
    # =========================================================

    response = []

    for req, transaction in results:

        child_db.refresh(req)
        child_db.refresh(transaction)

        response.append(
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

    return response


# ───────────────────────────────────────────────────────────────
# PUT /restore-requests/reject
# ───────────────────────────────────────────────────────────────

@router.put("/restore-requests/reject",response_model=List[RestoreRequestOut],)
def reject_restore_requests(
    body: BulkRestoreRequestDecision,
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """
    Reject multiple restore requests.

    There are two types of restore requests:

    1. DELETED TRANSACTION
       - ParentTransaction.is_deleted == True
       - ChildTransaction does not exist
       - Keep the transaction deleted.

    2. EDITED TRANSACTION
       - ParentTransaction.is_deleted == False
       - ChildTransaction exists
       - ChildTransaction.is_edited == True
       - Restore ChildTransaction from ParentTransaction
       - Set ChildTransaction.is_edited = False

    The Parent DB is unchanged when rejecting an edited transaction.
    """

    # =========================================================
    # 1. Validate request IDs
    # =========================================================

    if not body.request_ids:
        raise HTTPException(
            status_code=400,
            detail="At least one restore request must be selected",
        )

    request_ids = set(body.request_ids)

    # =========================================================
    # 2. Load restore requests
    # =========================================================

    requests = (
        child_db.query(ChildRestoreRequest)
        .filter(
            ChildRestoreRequest.id.in_(request_ids),
            ChildRestoreRequest.owner_id == owner_id,
            ChildRestoreRequest.table_name == "transactions",
        )
        .all()
    )

    if len(requests) != len(request_ids):
        raise HTTPException(
            status_code=404,
            detail="One or more restore requests were not found",
        )

    results = []

    try:

        # =====================================================
        # 3. Process every restore request
        # =====================================================

        for req in requests:

            # -------------------------------------------------
            # Request must still be pending
            # -------------------------------------------------

            if req.status != "pending":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Restore request {req.id} "
                        f"is already {req.status}"
                    ),
                )

            # -------------------------------------------------
            # Get transaction from Parent DB
            # -------------------------------------------------

            parent_transaction = (
                parent_db.query(ParentTransaction)
                .filter(
                    ParentTransaction.id == req.record_id,
                    ParentTransaction.owner_id == owner_id,
                )
                .first()
            )

            if not parent_transaction:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        f"Transaction {req.record_id} "
                        "was not found in Parent DB"
                    ),
                )

            # -------------------------------------------------
            # Get transaction from Child DB
            # -------------------------------------------------

            child_transaction = (
                child_db.query(ChildTransaction)
                .filter(
                    ChildTransaction.id == req.record_id,
                    ChildTransaction.owner_id == owner_id,
                )
                .first()
            )

            # =================================================
            # CASE 1: DELETED TRANSACTION
            # =================================================

            if parent_transaction.is_deleted:

                # A deleted transaction should not exist
                # in Child DB.

                if child_transaction:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Transaction {req.record_id} is marked "
                            "deleted in Parent DB but still exists "
                            "in Child DB"
                        ),
                    )

                # -------------------------------------------------
                # Do nothing to the transaction.
                #
                # Parent remains:
                #     is_deleted = True
                #
                # Child remains:
                #     no row
                # -------------------------------------------------

                transaction_snapshot = _parent_txn_out(
                    parent_transaction
                )

            # =================================================
            # CASE 2: EDITED TRANSACTION
            # =================================================

            else:

                # Edited transaction must still exist in Child DB.

                if not child_transaction:
                    raise HTTPException(
                        status_code=404,
                        detail=(
                            f"Edited transaction {req.record_id} "
                            "was not found in Child DB"
                        ),
                    )

                # It must still be marked as edited.

                if not child_transaction.is_edited:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Transaction {req.record_id} "
                            "is no longer marked as edited"
                        ),
                    )

                # -------------------------------------------------
                # Reject customer's changes.
                #
                # Parent DB contains the last approved version.
                # Copy that version back into Child DB.
                # -------------------------------------------------

                child_transaction.type = parent_transaction.type
                child_transaction.amount = parent_transaction.amount
                child_transaction.note = parent_transaction.note
                child_transaction.invoice_number = (
                    parent_transaction.invoice_number
                )
                child_transaction.entry_date = (
                    parent_transaction.entry_date
                )

                child_transaction.is_edited = False
                child_transaction.updated_at = datetime.utcnow()

                transaction_snapshot = child_transaction

            # =================================================
            # 4. Mark restore request as rejected
            # =================================================

            req.status = "rejected"
            req.owner_response = body.owner_response
            req.resolved_at = datetime.utcnow()

            results.append(
                (
                    req,
                    transaction_snapshot,
                )
            )

        # =====================================================
        # 5. Commit both databases
        # =====================================================

        child_db.commit()
        parent_db.commit()

    except HTTPException:
        child_db.rollback()
        parent_db.rollback()
        raise

    except Exception as exc:
        child_db.rollback()
        parent_db.rollback()

        print("REJECT RESTORE ERROR:", repr(exc))

        raise HTTPException(
            status_code=500,
            detail="Failed to reject restore requests",
        ) from exc

    # =========================================================
    # 6. Build response
    # =========================================================

    response = []

    for req, transaction_snapshot in results:

        child_db.refresh(req)

        response.append(
            RestoreRequestOut(
                id=req.id,
                transaction_id=req.record_id,
                transaction_snapshot=transaction_snapshot,
                status=req.status,
                customer_note=req.customer_note,
                owner_response=req.owner_response,
                created_at=req.created_at,
                resolved_at=req.resolved_at,
            )
        )

    return response