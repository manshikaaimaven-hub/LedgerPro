"""
create_customers.py
------------
Customer management endpoints for LedgerPro.

This router handles all customer-related operations:

    - List customers
    - Get a single customer
    - Create a customer
    - Update a customer
    - Permanently delete a customer

Database Architecture:
    Child DB
        - Main working database.
        - Stores the live customer records.
        - Used for normal CRUD operations.

    Parent DB
        - Permanent backup database.
        - Stores a synchronized copy of customer records.
        - Used to preserve customer data for recovery.

Authentication:
    All customer endpoints require the currently logged-in owner's
    identity through `get_current_owner_id`.

Data Isolation:
    Customer records are always filtered by `owner_id` so that one
    owner cannot access another owner's customers.

Synchronization:
    When a customer is created or updated, the Child DB record is
    synchronized to the Parent DB using `sync_service`.

Invite Emails:
    When a customer is created with an email address, an invite token
    and signup link are generated and the invitation email is queued
    as a background task.

Delete Behavior:
    Customer deletion removes the customer permanently from both
    the Child DB and Parent DB.
"""

# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from sqlalchemy.orm import Session

from app.database.child_db import get_child_db
from app.database.parent_db import get_parent_db

from app.models.child_models import ChildCustomer
from app.models.parent_models import ParentCustomer

from app.schemas.customer_schemas import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse
)

from app.utils.balance import compute_balances_bulk, compute_customer_balance
from app.utils.deps import get_current_owner_id

from app.services.sync_service import sync_service

from app.config import settings

# ───────────────────────────────────────────────────────────────
# Router Setup
# ───────────────────────────────────────────────────────────────
router = APIRouter(prefix="/customers", tags=["Customers"])

# ───────────────────────────────────────────────────────────────
# Router - GET /customers 
# List of Customer
# ───────────────────────────────────────────────────────────────
@router.get("", response_model=List[CustomerResponse])
def list_customers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db)
    ):
    """
    Retrieve a paginated list of customers for the logged-in owner.

    Features:
        - Returns only customers belonging to the current owner.
        - Excludes soft-deleted customers.
        - Supports searching by name, phone, or GST number.
        - Supports pagination using page and limit.
        - Calculates the current balance for each customer.

    Query Parameters:
        page:
            Page number. Defaults to 1.

        limit:
            Number of customers per page. Defaults to 20.
            Maximum allowed value is 100.

        search:
            Optional search keyword used against customer name,
            phone number, and GST number.

    Returns:
        List[CustomerResponse]:
            Paginated list of active customers with their balances.
    """

    # ---------------------------------------------------------
    # Step 1: Fetch active customers belonging to the logged-in owner
    # --------------------------------------------------------- 
    query = child_db.query(ChildCustomer).filter(
        ChildCustomer.owner_id == owner_id,
    )

    # ---------------------------------------------------------
    # Step 2: If a search keyword is provided,
    # search in customer name, phone, and GST number.
    # ---------------------------------------------------------
    if search:
        term = f"%{search}%"
        query = query.filter(
            ChildCustomer.name.ilike(term) |
            ChildCustomer.phone.ilike(term) |
            ChildCustomer.gst_number.ilike(term)
        )

    # ---------------------------------------------------------
    # Step 3: Calculate how many records to skip
    # for the requested page.
    #
    # Example:
    # page = 2, limit = 20
    # offset = (2 - 1) * 20 = 20
    # Skip first 20 records and return the next 20.
    # ---------------------------------------------------------
    offset = (page - 1) * limit
    customers = query.offset(offset).limit(limit).all()

    # ---------------------------------------------------------
    # Step 4: Apply pagination and return the customer list.
    # ---------------------------------------------------------
    balances = compute_balances_bulk([c.id for c in customers], owner_id, child_db)

    # ---------------------------------------------------------
    # Step 5: Apply pagination and return the customer list.
    # ---------------------------------------------------------
    return [
        CustomerResponse(
            id=c.id, name=c.name, phone=c.phone, address=c.address, 
            gst_number=c.gst_number, notes=c.notes, created_at=c.created_at,
            balance=balances.get(c.id, 0.0)
        )
        for c in customers
    ]

# ───────────────────────────────────────────────────────────────
# Router - GET /customers/{customer_id} 
# Get Customer
# ───────────────────────────────────────────────────────────────
@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: str,
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db)
    ):
    """
    Fetch a single customer by ID, with live balance attached.
    Used by the customer detail page.
    """
    customer = child_db.query(ChildCustomer).filter(
        ChildCustomer.id == customer_id,
        ChildCustomer.owner_id == owner_id,
    ).first()

    if not customer:
        raise HTTPException(404, "Customer not found")

    balance = compute_customer_balance(customer_id, owner_id, child_db)

    return CustomerResponse(
        id=customer.id, name=customer.name, phone=customer.phone, 
        address=customer.address, gst_number=customer.gst_number,
        notes=customer.notes, created_at=customer.created_at, balance=balance
    )

# ───────────────────────────────────────────────────────────────
# Router - POST /customers 
# Create Customer
# ───────────────────────────────────────────────────────────────
@router.post("", status_code=201)
def create_customer(
    body: CustomerCreate,
    background_tasks: BackgroundTasks,
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db)
    ):
    """
    Create a new customer for the logged-in owner.

    Features:
    - Creates a customer in the Child Database.
    - Prevents duplicate customer names for the same owner.
    - Generates a unique customer ID.
    - Immediately copies (syncs) the customer to the Parent Database
      as a backup.

    Request Body:
        CustomerCreate

    Returns:
        {
            "message": "Customer created",
            "id": "<customer_id>"
        }
    """
    # ---------------------------------------------------------
    # Step 1: Check if a customer with the same name already
    # exists for the current owner.
    #
    # This prevents duplicate customer names.
    # ---------------------------------------------------------
    existing = child_db.query(ChildCustomer).filter(
        ChildCustomer.owner_id == owner_id,
        ChildCustomer.name == body.name,
    ).first()
    if existing:
        raise HTTPException(400, "A customer with this name already exists")

    # ---------------------------------------------------------
    # Step 2: Create a new customer object.
    #
    # - Generate a unique UUID.
    # - Assign the logged-in owner.
    # - Copy all request fields using model_dump().
    # ---------------------------------------------------------
    customer = ChildCustomer(
        id=str(uuid.uuid4()),
        owner_id=owner_id,
        **body.model_dump()
    )

    # ---------------------------------------------------------
    # Step 3: Save the customer in the Child Database.
    # ---------------------------------------------------------
    child_db.add(customer)
    child_db.commit()
    child_db.refresh(customer)

    # ---------------------------------------------------------
    # Step 4: Copy the same customer to the Parent Database.
    #
    # Child DB = Main working database
    # Parent DB = Backup database
    # ---------------------------------------------------------
    sync_service.sync_customer_to_parent(customer, parent_db, ParentCustomer)
    
    
    # ---------------------------------------------------------
    # Step 5: Return success response with the new customer ID.
    # ---------------------------------------------------------
    return {
        "message": "Customer Created Successfully",
        "id": customer.id
        }

# ───────────────────────────────────────────────────────────────
# Router - PUT /customers/{customer_id} 
# Update Customer
# ───────────────────────────────────────────────────────────────
@router.put("/{customer_id}")
def update_customer(
    customer_id: str,
    body: CustomerUpdate,
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db)
    ):
    """
    Update an existing customer for the logged-in owner.

    Features:
    - Finds the customer by ID.
    - Ensures the customer belongs to the logged-in owner.
    - Prevents updating deleted customers.
    - Updates only the fields provided in the request.
    - Syncs the updated customer to the Parent Database.

    Path Parameter:
        customer_id : Unique ID of the customer to update.

    Request Body:
        CustomerUpdate

    Returns:
        {
            "message": "Customer updated"
        }
    """
    # ---------------------------------------------------------
    # Step 1: Find the customer in the Child Database.
    #
    # Conditions:
    # - Customer ID must match.
    # - Customer must belong to the logged-in owner.
    # - Customer must not be soft deleted.
    # ---------------------------------------------------------
    customer = child_db.query(ChildCustomer).filter(
        ChildCustomer.id == customer_id,
        ChildCustomer.owner_id == owner_id,
    ).first()

    # ---------------------------------------------------------
    # Step 2: If the customer does not exist,
    # return a 404 Not Found error.
    # ---------------------------------------------------------
    if not customer:
        raise HTTPException(404, "Customer not found")

    # ---------------------------------------------------------
    # Step 3: Update only the fields sent in the request.
    #
    # exclude_unset=True ignores fields that were not provided.
    # Example:
    # If only phone is sent,
    # only the phone number will be updated.
    # ---------------------------------------------------------
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)

    # ---------------------------------------------------------
    # Step 4: Save the updated customer in the Child Database.
    # ---------------------------------------------------------
    child_db.commit()
    child_db.refresh(customer)

    # ---------------------------------------------------------
    # Step 5: Sync the updated customer to the Parent Database
    # so both databases stay in sync.
    # ---------------------------------------------------------
    sync_service.sync_customer_to_parent(customer, parent_db, ParentCustomer)

    # ---------------------------------------------------------
    # Step 6: Return a success response.
    # ---------------------------------------------------------
    return {"message": "Customer updated"}


# ───────────────────────────────────────────────────────────────
# Router - DELETE /customers/{customer_id}
# Permanently Delete Customer
# ───────────────────────────────────────────────────────────────
@router.delete("/{customer_id}")
def delete_customer(
    customer_id: str,
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db)
    ):
    """
    Permanently deletes a customer from both the Child and Parent databases.
    """

    # Find customer in Child DB
    customer = child_db.query(ChildCustomer).filter(
        ChildCustomer.id == customer_id,
        ChildCustomer.owner_id == owner_id
    ).first()

    if not customer:
        raise HTTPException(
            status_code=404,
            detail="Customer not found"
        )

    # Delete from Child DB
    child_db.delete(customer)
    child_db.commit()

    # Delete from Parent DB (if exists)
    parent_customer = parent_db.query(ParentCustomer).filter(
        ParentCustomer.id == customer_id,
        ParentCustomer.owner_id == owner_id
    ).first()

    if parent_customer:
        parent_db.delete(parent_customer)
        parent_db.commit()

    return {
        "message": "Customer permanently deleted"
    }

