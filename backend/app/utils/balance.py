# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.models.child_models import ChildTransaction
from app.models.parent_models import ParentTransaction


# ───────────────────────────────────────────────────────────────
# Calculate Balance for a Single Customer
# ───────────────────────────────────────────────────────────────
def compute_customer_balance(customer_id: str, owner_id: str, db: Session) -> float:
    """
    Calculates the current balance for a single customer.

    The balance is calculated dynamically from all active transactions
    and is never stored in the database.

    Formula:
        Balance = Total Credits - Total Debits

    Interpretation:
    - Positive balance: Customer owes money to the owner (Receivable).
    - Negative balance: Owner owes money to the customer (Payable).
    - Zero balance: No outstanding amount.

    Steps:
    1. Retrieve all active transactions for the customer.
    2. Calculate the total credit amount.
    3. Calculate the total debit amount.
    4. Subtract total debits from total credits.
    5. Return the calculated balance.

    Args:
        customer_id (str):
            Unique customer ID.

        owner_id (str):
            Unique owner ID.

        db (Session):
            Active database session.

    Returns:
        float:
            The customer's current balance.
    """

    # Step 1: Fetch all active transactions for the customer.
    txns = db.query(ChildTransaction).filter(
        ChildTransaction.customer_id == customer_id,
            ChildTransaction.owner_id == owner_id,
    ).all()

    # Step 2: Calculate the total credit amount.
    credit = sum(float(t.amount) for t in txns if t.type == "cr")

    # Step 3: Calculate the total debit amount.
    debit = sum(float(t.amount) for t in txns if t.type == "dr")

    # Step 4: Return the current balance.
    return credit - debit


# ───────────────────────────────────────────────────────────────
# Calculate Balances for Multiple Customers
# ───────────────────────────────────────────────────────────────
def compute_balances_bulk(
    customer_ids: list[str],
    owner_id: str,
    db: Session
    ) -> dict[str, float]:
    """
    Calculates balances for multiple customers using a single database query.

    This method is more efficient than calculating each customer's
    balance individually because it groups all calculations into one
    SQL query.

    Formula:
        Balance = Total Credits - Total Debits

    Steps:
    1. Return an empty dictionary if no customer IDs are provided.
    2. Group transactions by customer.
    3. Calculate total credits and total debits for each customer.
    4. Compute the balance for every customer.
    5. Return a dictionary of customer IDs and balances.

    Args:
        customer_ids (list[str]):
            List of customer IDs.

        owner_id (str):
            Unique owner ID.

        db (Session):
            Active database session.

    Returns:
        dict[str, float]:
            Dictionary mapping each customer ID to its current balance.
    """

    # Step 1: Return immediately if there are no customers.
    if not customer_ids:
        return {}

    # Step 2: Calculate total credits and debits for each customer.
    rows = db.query(
        ChildTransaction.customer_id,
        func.sum(
            case(
                (ChildTransaction.type == "cr", ChildTransaction.amount),
                else_=0
            )
        ).label("cr"),
        func.sum(
            case(
                (ChildTransaction.type == "dr", ChildTransaction.amount),
                else_=0
            )
        ).label("dr"),
    ).filter(
        ChildTransaction.customer_id.in_(customer_ids),
        ChildTransaction.owner_id == owner_id,
    ).group_by(
        ChildTransaction.customer_id
    ).all()

    # Step 3: Compute and return the balance for each customer.
    return {
        row.customer_id: float(row.cr or 0) - float(row.dr or 0)
        for row in rows
    }