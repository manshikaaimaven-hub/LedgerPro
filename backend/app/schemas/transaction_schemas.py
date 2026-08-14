"""
Transaction request and response schemas.

This module defines the Pydantic models used by the transaction API.
These schemas validate incoming request data and serialize transaction
records returned to the client.

Schemas:
- TransactionCreate: Validates data required to create a new transaction.
- TransactionResponse: Represents a transaction returned by the API,
  including metadata and running balance.
"""

# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


# ───────────────────────────────────────────────────────────────
# Transaction Create Schema
# ───────────────────────────────────────────────────────────────
class TransactionCreate(BaseModel):
    """
    Request schema used to create a new transaction.

    The client provides the customer, transaction type,
    amount, and optional details such as a note,
    invoice number, and entry date.

    Attributes:
        customer_id: Unique ID of the customer.
        type: Transaction type ("cr" for credit or "dr" for debit).
        amount: Transaction amount.
        note: Optional description of the transaction.
        invoice_number: Optional invoice reference.
        entry_date: Date and time of the transaction.
                    Defaults to the current time if omitted.
    """

    customer_id: str
    type: Literal["cr", "dr"]
    amount: float
    note: Optional[str] = None
    invoice_number: Optional[str] = None
    entry_date: Optional[datetime] = None


# ───────────────────────────────────────────────────────────────
# Transaction Response Schema
# ───────────────────────────────────────────────────────────────
class TransactionResponse(BaseModel):
    """
    Response schema returned for transaction operations.

    Contains all transaction details stored in the database,
    along with metadata such as creation time, deletion status,
    and the customer's running balance after this transaction.

    Attributes:
        id: Unique transaction ID.
        customer_id: Customer associated with the transaction.
        type: Transaction type.
        amount: Transaction amount.
        note: Optional transaction note.
        invoice_number: Optional invoice reference.
        entry_date: Date and time the transaction occurred.
        is_deleted: Indicates whether the transaction has been soft deleted.
        created_at: Timestamp when the transaction was created.
        running_balance: Customer's balance after this transaction.
    """

    id: str
    customer_id: str
    type: str
    amount: float
    note: Optional[str]
    invoice_number: Optional[str]
    entry_date: datetime
    is_deleted: bool
    created_at: datetime
    running_balance: float = 0.0

    class Config:
        """
        Enables Pydantic to populate this schema directly
        from SQLAlchemy ORM model instances.
        """

        from_attributes = True