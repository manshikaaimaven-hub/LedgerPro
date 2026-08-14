"""
Owner Dashboard summary endpoints.

This module provides API endpoints for retrieving dashboard
statistics and financial summaries for the authenticated owner.
It aggregates customer and transaction data to power the
application's summary dashboard.

Endpoints:
- GET /summary
    Returns the overall financial summary, including total
    credits, total debits, net outstanding amount, and
    receivable/payable status.

- GET /summary/customers-count
    Returns the total number of active customers.

- GET /summary/entries-today
    Returns the number of transactions created today.

- GET /summary/top-receivables
    Returns the top three customers with the highest
    receivable balances.

- GET /summary/top-debts
    Returns the top three customers with the highest
    payable balances.

Features:
- Owner-based data isolation.
- Dashboard financial aggregation.
- Customer balance calculation.
- Top receivable and payable customer insights.
- Soft-delete aware queries.
"""
# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timezone
# from app.database.child_db import get_child_db
# from app.models.child_models import ChildCustomer, ChildTransaction
from app.database.parent_db import get_parent_db
from app.models.parent_models import ParentCustomer, ParentTransaction
from app.utils.deps import get_current_owner_id
from app.utils.balance import compute_customer_balance

# ───────────────────────────────────────────────────────────────
# Router Setup
# ───────────────────────────────────────────────────────────────
router = APIRouter(prefix="/summary", tags=["Summary"])

# ───────────────────────────────────────────────────────────────
# GET /summary
# Dashboard Summary
# ───────────────────────────────────────────────────────────────
@router.get("")
def get_summary(
    owner_id: str = Depends(get_current_owner_id),
    parent_db: Session = Depends(get_parent_db)
    ):
    """
    Returns the overall financial summary for the logged-in owner.

    Steps:
    1. Fetch all active transactions belonging to the owner.
    2. Calculate total credit amount.
    3. Calculate total debit amount.
    4. Compute the net outstanding balance.
    5. Determine whether the balance is receivable or payable.
    6. Return the summary.
    """

    # Step 1: Fetch all non-deleted transactions
    txns = parent_db.query(ParentTransaction).filter(
        ParentTransaction.owner_id == owner_id,
        ParentTransaction.is_deleted == False
    ).all()

    
    

    # Step 2: Calculate total credits
    total_cr = sum(float(t.amount) for t in txns if t.type == "cr")

    # Step 3: Calculate total debits
    total_dr = sum(float(t.amount) for t in txns if t.type == "dr")

    # Step 4: Calculate net outstanding amount
    net = total_cr - total_dr
    

    # Step 5 & 6: Return dashboard summary
    return {
        "total_credit": total_cr,
        "total_debit": total_dr,
        "net_outstanding": net,
        "net_label": "receivable" if net >= 0 else "payable"
    }


# ───────────────────────────────────────────────────────────────
# GET /summary/customers-count
# Total Customers
# ───────────────────────────────────────────────────────────────
@router.get("/customers-count")
def customers_count(
    owner_id: str = Depends(get_current_owner_id),
    parent_db: Session = Depends(get_parent_db)
    ):
    """
    Returns the total number of active customers.

    Steps:
    1. Count all non-deleted customers belonging to the owner.
    2. Return the total count.
    """

    # Step 1: Count active customers
    count = parent_db.query(ParentCustomer).filter(
        ParentCustomer.owner_id == owner_id,
        ParentCustomer.is_deleted == False
    ).count()

    # Step 2: Return count
    return {"total_customers": count}

# ───────────────────────────────────────────────────────────────
# GET /summary/entries-today
# Today's Transactions Count
# ───────────────────────────────────────────────────────────────
@router.get("/entries-today")
def entries_today(
    owner_id: str = Depends(get_current_owner_id),
    parent_db: Session = Depends(get_parent_db)
    ):
    """
    Returns the number of transactions entered today.

    Steps:
    1. Get today's date.
    2. Count today's active transactions for the owner.
    3. Return the count.
    """

    # Step 1: Get today's date
    today = date.today()

    # Step 2: Count today's transactions
    count = parent_db.query(ParentTransaction).filter(
        ParentTransaction.owner_id == owner_id,
        ParentTransaction.is_deleted == False,
        func.date(ParentTransaction.entry_date) == today
    ).count()

    # Step 3: Return count
    return {"entries_today": count}


# ───────────────────────────────────────────────────────────────
# GET /summary/top-receivables
# Top Customers Who Owe Money
# ───────────────────────────────────────────────────────────────
@router.get("/top-receivables")
def top_receivables(
    owner_id: str = Depends(get_current_owner_id),
    parent_db: Session = Depends(get_parent_db)
    ):
    """
    Returns the top three customers with the highest receivable balances.

    Steps:
    1. Fetch all active customers.
    2. Calculate each customer's balance.
    3. Keep only customers with positive balances.
    4. Sort balances in descending order.
    5. Return the top three customers.
    """
    # Step 1: Fetch active customers
    customers = parent_db.query(ParentCustomer).filter(
        ParentCustomer.owner_id == owner_id,
        ParentCustomer.is_deleted == False
    ).all()

    result = []

    # Step 2 & 3: Calculate balances and keep receivables
    for c in customers:
        balance = compute_customer_balance(c.id, owner_id, parent_db)
        if balance > 0:
            result.append({"id": c.id, "name": c.name, "phone": c.phone, "balance": balance})

    # Step 4: Sort by highest balance
    result.sort(key=lambda x: x["balance"], reverse=True)

    # Step 5: Return top three
    return result[:3]

# ───────────────────────────────────────────────────────────────
# GET /summary/top-debts
# Top Customers You Owe Money
# ───────────────────────────────────────────────────────────────
@router.get("/top-debts")
def top_debts(
    owner_id: str = Depends(get_current_owner_id),
    parent_db: Session = Depends(get_parent_db)
    ):
    """
    Returns the top three customers with the highest payable balances.

    Steps:
    1. Fetch all active customers.
    2. Calculate each customer's balance.
    3. Keep only customers with negative balances.
    4. Sort balances from lowest (most negative) to highest.
    5. Return the top three customers.
    """

    # Step 1: Fetch active customers
    customers = parent_db.query(ParentCustomer).filter(
        ParentCustomer.owner_id == owner_id,
        ParentCustomer.is_deleted == False
    ).all()

    result = []
    # Step 2 & 3: Calculate balances and keep debts
    for c in customers:
        balance = compute_customer_balance(c.id, owner_id, parent_db)
        if balance <= 0:
            result.append({"id": c.id, "name": c.name, "phone": c.phone, "balance": balance})

    # Step 4: Sort by most negative balance
    result.sort(key=lambda x: x["balance"])

    # Step 5: Return top three
    return result[:3]