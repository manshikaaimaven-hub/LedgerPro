"""
routers/settings.py
--------------------
All Settings-page endpoints for LedgerPro.

Endpoints included:
    - Owner profile (view/update)
    - Change password
    - Business management
        - List businesses
        - Delete business data
        - Restore business data

Business deletion/restore architecture:
    1. Parent DB acts as the permanent backup.
    2. Child DB contains the active/live business data.
    3. Deleting a business removes its data only from Child DB.
    4. Parent DB data is never deleted.
    5. A DeletedOwner audit record tracks every deletion.
    6. Restoring a business copies data from Parent DB → Child DB.
    7. The deletion record is marked as approved after successful restore.
"""

# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional
import csv
import io
from datetime import timezone, timedelta

from app.database.parent_db import get_parent_db
from app.database.child_db import get_child_db

from app.models.parent_models import ParentOwner, DeletedOwner, ParentCustomer, ParentTransaction
from app.models.child_models import ChildCustomer, ChildTransaction, ChildOwner

from app.utils.deps import get_current_owner_id
from app.utils.auth_utils import hash_password, verify_password

from app.schemas.auth_schemas import OwnerOut, ChangePasswordRequest
from app.schemas.settings_schemas import OwnerProfileUpdate, BusinessListItem, VerifyDeletePasscodeRequest, DeleteTargetProfile

IST = timezone(timedelta(hours=5, minutes=30))

# ───────────────────────────────────────────────────────────────
# Router setup
# ───────────────────────────────────────────────────────────────
router = APIRouter(prefix="/settings", tags=["Settings"])


# ───────────────────────────────────────────────────────────────
# GET /settings/profile
# ───────────────────────────────────────────────────────────────
@router.get("/profile", response_model=OwnerOut)
def get_profile(
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db),
    ):
    """
    Retrieve the profile of the currently authenticated owner.

    Steps:
        1. Get the authenticated owner's ID from the JWT token.
        2. Query Parent DB for the matching ParentOwner record.
        3. If the owner does not exist, return HTTP 404.
        4. Return the owner's profile information.

    Database:
        - Reads from Parent DB only.

    Security:
        - The owner ID comes from the authenticated session.
        - An owner cannot request another owner's profile through this endpoint.
    """

    # Step 1: Find the currently authenticated owner in Child DB.
    owner = (
        child_db.query(ChildOwner)
        .filter(ChildOwner.id == owner_id)
        .first()
    )

    # Step 2: Stop if the authenticated owner no longer exists.
    if not owner:
        raise HTTPException(404, "Owner not found")

    # Step 3: Return the owner profile.
    return owner


# ───────────────────────────────────────────────────────────────
# PUT /settings/profile
# ───────────────────────────────────────────────────────────────
@router.put("/profile", response_model=OwnerOut)
def update_profile(
    body: OwnerProfileUpdate,
    owner_id: str = Depends(get_current_owner_id),
    parent_db: Session = Depends(get_parent_db),
    child_db: Session = Depends(get_child_db),
    ):
    """
    Update the profile of the currently authenticated owner.

    The owner must exist in both Parent DB and Child DB.

    Parent DB:
        Stores the permanent owner/authentication record.

    Child DB:
        Indicates that the owner's business is currently active.

    If the owner exists in Parent DB but not in Child DB, the business
    has been deleted and the owner is not allowed to edit the profile
    until the business is restored.
    """

    # ───────────────────────────────────────────────────────────
    # Step 1: Find the authenticated owner in Parent DB.
    # ───────────────────────────────────────────────────────────
    owner = (
        parent_db.query(ParentOwner)
        .filter(ParentOwner.id == owner_id)
        .first()
    )

    if not owner:
        raise HTTPException(
            status_code=404,
            detail="Owner not found"
        )

    # ───────────────────────────────────────────────────────────
    # Step 2: Verify that the owner's business still exists
    # in Child DB.
    # ───────────────────────────────────────────────────────────
    child_owner = (
        child_db.query(ChildOwner)
        .filter(ChildOwner.id == owner_id)
        .first()
    )

    # Business was deleted from Child DB.
    if not child_owner:
        raise HTTPException(
            status_code=403,
            detail="Business is deleted. Restore the business before editing the profile."
        )

    # ───────────────────────────────────────────────────────────
    # Step 3: Update only fields supplied by the client.
    # ───────────────────────────────────────────────────────────
    update_fields = body.model_dump(exclude_unset=True)

    # ───────────────────────────────────────────────────────────
    # Step 4: Update Parent DB.
    # ───────────────────────────────────────────────────────────
    for field, value in update_fields.items():
        setattr(owner, field, value)

    parent_db.commit()

    # ───────────────────────────────────────────────────────────
    # Step 5: Update Child DB.
    # ───────────────────────────────────────────────────────────
    for field, value in update_fields.items():
        setattr(child_owner, field, value)

    child_db.commit()

    # ───────────────────────────────────────────────────────────
    # Step 6: Refresh both records.
    # ───────────────────────────────────────────────────────────
    parent_db.refresh(owner)
    child_db.refresh(child_owner)

    # ───────────────────────────────────────────────────────────
    # Step 7: Return the updated owner profile.
    # ───────────────────────────────────────────────────────────
    return owner

# ───────────────────────────────────────────────────────────────
# POST /settings/change-password
# ───────────────────────────────────────────────────────────────
@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    owner_id: str = Depends(get_current_owner_id),
    parent_db: Session = Depends(get_parent_db),
    child_db: Session = Depends(get_child_db),
    ):
    """
    Change the password of the currently authenticated owner.

    Steps:
        1. Get the authenticated owner's ID from the JWT token.
        2. Find the owner in Parent DB.
        3. Make sure the owner exists in Child DB.
        4. Reject the request if the business has been deleted.
        5. Verify the supplied current password.
        6. Reject the request if the current password is incorrect.
        7. Hash the new password.
        8. Replace the existing password hash in Parent DB.
        9. Commit the password change.
        10. Return a success message.

    Database:
        - Reads owner authentication data from Parent DB.
        - Checks business existence in Child DB.
        - Updates the password in Parent DB only.

    Security:
        - The current password must be verified before changing it.
        - The new password is never stored as plain text.
        - Password changes are not allowed while the business is deleted.
    """

    # ───────────────────────────────────────────────────────────────
    # Step 1: Find the authenticated owner in Parent DB.
    # Parent DB contains the permanent owner/authentication record.
    # ───────────────────────────────────────────────────────────────
    owner = (
        parent_db.query(ParentOwner)
        .filter(ParentOwner.id == owner_id)
        .first()
    )

    # Step 2: Verify that the authenticated owner exists.
    if not owner:
        raise HTTPException(
            status_code=404,
            detail="Owner not found",
        )

    # ───────────────────────────────────────────────────────────────
    # Step 3: Check whether the owner's business currently exists
    # in Child DB.
    #
    # If ChildOwner does not exist, the business was deleted.
    # The owner must restore the business before changing the password.
    # ───────────────────────────────────────────────────────────────
    child_owner = (
        child_db.query(ChildOwner)
        .filter(ChildOwner.id == owner_id)
        .first()
    )

    if not child_owner:
        raise HTTPException(
            status_code=403,
            detail="Business is deleted. Restore the business before changing the password.",
        )

    # ───────────────────────────────────────────────────────────────
    # Step 4: Verify the current password.
    # ───────────────────────────────────────────────────────────────
    if not verify_password(
        body.current_password,
        owner.hashed_password,
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect",
        )

    # ───────────────────────────────────────────────────────────────
    # Step 5: Hash the new password before storing it.
    # ───────────────────────────────────────────────────────────────
    owner.hashed_password = hash_password(body.new_password)

    # ───────────────────────────────────────────────────────────────
    # Step 6: Save the new password hash in Parent DB.
    # ───────────────────────────────────────────────────────────────
    parent_db.commit()

    # ───────────────────────────────────────────────────────────────
    # Step 7: Return success response.
    # ───────────────────────────────────────────────────────────────
    return {
        "message": "Password updated successfully"
    }


# ───────────────────────────────────────────────────────────────
# POST /settings/business/verify-passcode
# ───────────────────────────────────────────────────────────────
@router.post("/business/verify-passcode", response_model=DeleteTargetProfile)
def verify_delete_passcode(
    body: VerifyDeletePasscodeRequest,
    admin_owner_id: str = Depends(get_current_owner_id),
    parent_db: Session = Depends(get_parent_db),
    ):
    """
    Verify the deletion passcode and identify the target business.
    """

    # ───────────────────────────────────────────────────────────
    # Step 1: Get and validate the supplied passcode
    # ───────────────────────────────────────────────────────────
    supplied_passcode = body.passcode.strip()

    if len(supplied_passcode) != 4 or not supplied_passcode.isdigit():
        raise HTTPException(status_code=403, detail="Incorrect passcode")

    # ───────────────────────────────────────────────────────────
    # Step 2: Find owners whose phone ends with the passcode
    # ───────────────────────────────────────────────────────────
    owners = (
        parent_db.query(ParentOwner)
        .filter(
            ParentOwner.phone.isnot(None),
            ParentOwner.phone.endswith(supplied_passcode)
        )
        .all()
    )

    if not owners:
        raise HTTPException(status_code=403, detail="Incorrect passcode")

    if len(owners) > 1:
        raise HTTPException(status_code=403, detail="Incorrect passcode")

    owner = owners[0]

    target_owner_id_str = str(owner.id)
    admin_owner_id_str = str(admin_owner_id)

    # ───────────────────────────────────────────────────────────
    # Step 3: Prevent acting on your own business
    # ───────────────────────────────────────────────────────────
    if target_owner_id_str == admin_owner_id_str:
        raise HTTPException(status_code=400, detail="Cannot delete your own business")

    # ───────────────────────────────────────────────────────────
    # Step 4: THE single, only query that decides the outcome.
    # No other DeletedOwner query exists anywhere else in this
    # function — this is deliberate, so there is no possibility
    # of a second stale query silently deciding the response.
    # ───────────────────────────────────────────────────────────
    deleted_rows = (
        parent_db.query(DeletedOwner)
        .filter(DeletedOwner.owner_id == target_owner_id_str)
        .order_by(DeletedOwner.id.desc())
        .all()
    )

    print(f"[DEBUG verify-passcode] target={target_owner_id_str} "
          f"admin={admin_owner_id_str} match_count={len(deleted_rows)}")

    # ───────────────────────────────────────────────────────────
    # Step 5a: NOT DELETED
    # ───────────────────────────────────────────────────────────
    if not deleted_rows:
        print("Not Deleted Yet")
        return DeleteTargetProfile(
            id=owner.id,
            full_name=owner.full_name,
            business_name=owner.business_name,
            city=owner.city,
            phone_last4=owner.phone.strip()[-4:],
        )

    deleted_owner = deleted_rows[0]
    print(f"[DEBUG verify-passcode] deleted_by={deleted_owner.deleted_by_owner_id!r} "
          f"(type={type(deleted_owner.deleted_by_owner_id)})")

    # ───────────────────────────────────────────────────────────
    # Step 5b: DELETED BY ME
    # ───────────────────────────────────────────────────────────
    if str(deleted_owner.deleted_by_owner_id) == admin_owner_id_str:
        print("Deleted by you")
        result = DeleteTargetProfile(
            id=owner.id,
            full_name=owner.full_name,
            business_name=owner.business_name,
            city=owner.city,
            phone_last4=owner.phone.strip()[-4:],
            status="deleted_by_me",
        )
        print(f"[DEBUG] Pydantic object dict: {result.model_dump()}")  # or .dict() on older pydantic
        return result

    # ───────────────────────────────────────────────────────────
    # Step 5c: DELETED BY SOMEONE ELSE — hard stop
    # ───────────────────────────────────────────────────────────
    print("deleted by someone else")
    raise HTTPException(status_code=409, detail="This business is already deleted")


# ───────────────────────────────────────────────────────────────
# DELETE /settings/business/{target_owner_id}
# ───────────────────────────────────────────────────────────────
@router.delete("/business/{target_owner_id}")
def delete_business(
    target_owner_id: str,
    admin_owner_id: str = Depends(get_current_owner_id),
    parent_db: Session = Depends(get_parent_db),
    child_db: Session = Depends(get_child_db),
    ):
    """
    Delete only the business whose owner ID was identified
    by the passcode verification flow.
    """

    # ───────────────────────────────────────────────────────────
    # Step 1: Prevent deleting own business
    # ───────────────────────────────────────────────────────────
    if str(target_owner_id) == str(admin_owner_id):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete your own business"
        )

    # ───────────────────────────────────────────────────────────
    # Step 2: Find target owner in Parent DB
    # ───────────────────────────────────────────────────────────
    owner = (
        parent_db.query(ParentOwner)
        .filter(ParentOwner.id == target_owner_id)
        .first()
    )

    if not owner:
        raise HTTPException(
            status_code=404,
            detail="Business not found"
        )

    # ───────────────────────────────────────────────────────────
    # Step 3: Check latest deletion record
    #
    # Cast to str() — DeletedOwner.owner_id is stored as a string,
    # but target_owner_id / owner.id can arrive as a UUID object
    # depending on the column type. Without the cast this lookup
    # can silently miss an existing row.
    # ───────────────────────────────────────────────────────────
    deleted_owner = (
        parent_db.query(DeletedOwner)
        .filter(DeletedOwner.owner_id == str(target_owner_id))
        .first()
    )

    # ───────────────────────────────────────────────────────────
    # Step 4: Business is already deleted
    # ───────────────────────────────────────────────────────────
    if deleted_owner:
        raise HTTPException(
            status_code=409,
            detail="This business is already deleted"
        )

    # ───────────────────────────────────────────────────────────
    # Step 5: Delete target owner's transactions
    # ───────────────────────────────────────────────────────────
    deleted_transactions = (
        child_db.query(ChildTransaction)
        .filter(
            ChildTransaction.owner_id == target_owner_id
        )
        .delete()
    )

    # ───────────────────────────────────────────────────────────
    # Step 6: Delete target owner's customers
    # ───────────────────────────────────────────────────────────
    deleted_customers = (
        child_db.query(ChildCustomer)
        .filter(
            ChildCustomer.owner_id == target_owner_id
        )
        .delete()
    )

    # ───────────────────────────────────────────────────────────
    # Step 7: Delete target owner from Child DB
    # ───────────────────────────────────────────────────────────
    child_db.query(ChildOwner).filter(
        ChildOwner.id == target_owner_id
    ).delete()

    # ───────────────────────────────────────────────────────────
    # Step 8: Commit Child DB
    # ───────────────────────────────────────────────────────────
    child_db.commit()

    # ───────────────────────────────────────────────────────────
    # Step 9: Mark business as deleted in Parent DB
    # ───────────────────────────────────────────────────────────
    parent_db.query(ParentOwner).filter(
        ParentOwner.id == target_owner_id
    ).update(
        {ParentOwner.is_deleted: True},
        synchronize_session=False
    )

    parent_db.query(ParentCustomer).filter(
        ParentCustomer.owner_id == target_owner_id
    ).update(
        {ParentCustomer.is_deleted: True},
        synchronize_session=False
    )

    parent_db.query(ParentTransaction).filter(
        ParentTransaction.owner_id == target_owner_id
    ).update(
        {ParentTransaction.is_deleted: True},
        synchronize_session=False
    )

    # ───────────────────────────────────────────────────────────
    # Step 10: Create deletion audit record
    #
    # Cast both IDs to str() on write so the row is stored in the
    # same format that Steps 3 above and the passcode/restore
    # endpoints look it up with.
    # ───────────────────────────────────────────────────────────
    parent_db.add(
        DeletedOwner(
            owner_id=str(target_owner_id),
            deleted_by_owner_id=str(admin_owner_id),
        )
    )

    parent_db.commit()

    # ───────────────────────────────────────────────────────────
    # Step 11: Return success
    # ───────────────────────────────────────────────────────────
    return {
        "message": "Business data deleted from Child DB",
        "id": target_owner_id,
    }

    
# ───────────────────────────────────────────────────────────────
# Helper — Restore owner data
# ───────────────────────────────────────────────────────────────
def _restore_owner_data(
    owner_id: str,
    parent_db: Session,
    child_db: Session
    ) -> dict:
    """
    Restore one owner's business data.

    Restore direction:
        Parent DB → Child DB

    Restores:
        1. Owner
        2. Customers
        3. Transactions

    Steps:
        1. Find the owner in Parent DB.
        2. Check whether the owner already exists in Child DB.
        3. Insert the owner into Child DB if missing.
        4. Commit the restored owner.
        5. Find all customers belonging to the owner in Parent DB.
        6. Check whether each customer already exists in Child DB.
        7. Insert missing customers into Child DB.
        8. Commit restored customers.
        9. Find all transactions belonging to the owner in Parent DB.
       10. Check whether each transaction already exists in Child DB.
       11. Insert missing transactions into Child DB.
       12. Commit restored transactions.
       13. Return restoration counts.

    Important:
        This is a business-level restore.

        Parent DB is the permanent backup source.
        All owner, customer, and transaction data belonging to
        the business is copied from Parent DB to Child DB.

    Duplicate protection:
        Existing Child DB records are skipped based on their IDs.
    """

    restored_owner = 0
    restored_customers = 0
    restored_transactions = 0

    # ───────────────────────────────────────────────────────────
    # Step 1: Load owner from the permanent Parent DB backup.
    # ───────────────────────────────────────────────────────────
    parent_owner = (
        parent_db.query(ParentOwner)
        .filter(
            ParentOwner.id == owner_id,
            ParentOwner.is_deleted == True,
        )
        .first()
    )

    if not parent_owner:
        raise HTTPException(
            status_code=404,
            detail="Owner backup data was not found"
        )

    # ───────────────────────────────────────────────────────────
    # Step 2: Check whether owner already exists in Child DB.
    # ───────────────────────────────────────────────────────────
    existing_owner = (
        child_db.query(ChildOwner)
        .filter(
            ChildOwner.id == parent_owner.id
        )
        .first()
    )

    # ───────────────────────────────────────────────────────────
    # Step 3: Restore owner if it does not already exist.
    # ───────────────────────────────────────────────────────────
    if not existing_owner:
        child_db.add(ChildOwner(
            id=parent_owner.id,
            username=parent_owner.username,
            email=parent_owner.email,
            hashed_password=parent_owner.hashed_password,
            full_name=parent_owner.full_name,
            business_name=parent_owner.business_name,
            phone=parent_owner.phone,
            city=parent_owner.city,
            created_at=parent_owner.created_at,
            updated_at=parent_owner.updated_at,
        ))

        restored_owner = 1

    # ───────────────────────────────────────────────────────────
    # Step 4: Commit restored owner.
    # ───────────────────────────────────────────────────────────
    child_db.commit()

    # ───────────────────────────────────────────────────────────
    # Step 5: Load all customers belonging to this owner.
    # ───────────────────────────────────────────────────────────
    parent_customers = (
        parent_db.query(ParentCustomer)
        .filter(
            ParentCustomer.owner_id == owner_id,
            ParentCustomer.is_deleted == True,
        )
        .all()
    )

    # ───────────────────────────────────────────────────────────
    # Step 6: Restore customers that do not already exist.
    # ───────────────────────────────────────────────────────────
    for pc in parent_customers:

        existing_customer = (
            child_db.query(ChildCustomer)
            .filter(
                ChildCustomer.id == pc.id
            )
            .first()
        )

        if existing_customer:
            continue

        # ───────────────────────────────────────────────────────
        # Step 7: Re-create customer using Parent DB data.
        # ───────────────────────────────────────────────────────
        child_db.add(ChildCustomer(
            id=pc.id,
            owner_id=pc.owner_id,
            name=pc.name,
            phone=pc.phone,
            address=pc.address,
            gst_number=pc.gst_number,
            notes=pc.notes,
            created_at=pc.created_at,
            updated_at=pc.updated_at,
        ))

        restored_customers += 1

    # ───────────────────────────────────────────────────────────
    # Step 8: Commit restored customers.
    # ───────────────────────────────────────────────────────────
    child_db.commit()

    # ───────────────────────────────────────────────────────────
    # Step 9: Load all transactions belonging to this owner.
    # ───────────────────────────────────────────────────────────
    parent_txns = (
        parent_db.query(ParentTransaction)
        .filter(
            ParentTransaction.owner_id == owner_id,
            ParentTransaction.is_deleted == True,
        )
        .all()
    )

    # ───────────────────────────────────────────────────────────
    # Step 10: Restore transactions that do not already exist.
    # ───────────────────────────────────────────────────────────
    for pt in parent_txns:

        existing_transaction = (
            child_db.query(ChildTransaction)
            .filter(
                ChildTransaction.id == pt.id
            )
            .first()
        )

        if existing_transaction:
            continue

        # ───────────────────────────────────────────────────────
        # Step 11: Re-create transaction using Parent DB data.
        # ───────────────────────────────────────────────────────
        child_db.add(ChildTransaction(
            id=pt.id,
            customer_id=pt.customer_id,
            owner_id=pt.owner_id,
            type=pt.type,
            amount=pt.amount,
            note=pt.note,
            invoice_number=pt.invoice_number,
            entry_date=pt.entry_date,
            created_at=pt.created_at,
            updated_at=pt.updated_at,
        ))

        restored_transactions += 1

    # ───────────────────────────────────────────────────────────
    # Step 12: Commit restored transactions.
    # ───────────────────────────────────────────────────────────
    child_db.commit()

    # ───────────────────────────────────────────────────────────
    # Step 13: Updating the Parent DB is_deleted: False
    # ───────────────────────────────────────────────────────────

    parent_db.query(ParentOwner).filter(
        ParentOwner.id == owner_id,
        ParentOwner.is_deleted == True,
    ).update(
        {ParentOwner.is_deleted: False},
        synchronize_session=False
    )

    parent_db.query(ParentCustomer).filter(
        ParentCustomer.owner_id == owner_id,
        ParentCustomer.is_deleted == True,
    ).update(
        {ParentCustomer.is_deleted: False},
        synchronize_session=False
    )

    parent_db.query(ParentTransaction).filter(
        ParentTransaction.owner_id == owner_id,
        ParentTransaction.is_deleted == True,
    ).update(
        {ParentTransaction.is_deleted: False},
        synchronize_session=False
    )

    # ───────────────────────────────────────────────────────────
    # Step 14: Return restoration counts.
    # ───────────────────────────────────────────────────────────
    return {
        "owner_restored": restored_owner,
        "customers_restored": restored_customers,
        "transactions_restored": restored_transactions,
    }


# ───────────────────────────────────────────────────────────────
# PUT /settings/business/{target_owner_id}/restore
# ───────────────────────────────────────────────────────────────
@router.put("/business/{target_owner_id}/restore")
def restore_business(
    target_owner_id: str,
    admin_owner_id: str = Depends(get_current_owner_id),
    parent_db: Session = Depends(get_parent_db),
    child_db: Session = Depends(get_child_db),
    ):
    """
    Restore a previously deleted business.

    A business is "deleted" if a DeletedOwner row exists for it.
    Restoring removes that row entirely — there is no status field.
    """

    # ───────────────────────────────────────────────────────────
    # Step 1: Find the deletion record for this business.
    #
    # Cast to str() to match how delete_business now writes the
    # row (owner_id=str(target_owner_id)) and how the passcode
    # endpoint looks it up.
    # ───────────────────────────────────────────────────────────
    record = (
        parent_db.query(DeletedOwner)
        .filter(DeletedOwner.owner_id == str(target_owner_id))
        .first()
    )

    # Step 2: No row means there is nothing to restore.
    if not record:
        raise HTTPException(404, "This business is not currently deleted")

    # ───────────────────────────────────────────────────────────
    # Step 3: Only the owner/admin who performed the deletion
    # can restore it. Cast both sides to str() for the same
    # reason as above.
    # ───────────────────────────────────────────────────────────
    if str(record.deleted_by_owner_id) != str(admin_owner_id):
        raise HTTPException(403, "Only the owner who deleted this business can restore it")

    # Step 4: Restore the business data from Parent DB → Child DB.
    result = _restore_owner_data(target_owner_id, parent_db, child_db)

    # Step 5: Remove the deletion record entirely — its presence
    # was the only signal that the business was deleted.
    parent_db.delete(record)
    parent_db.commit()

    # Step 6: Return the restoration counts to the client.
    return {"message": "Business data restored", "id": target_owner_id, **result}


# ───────────────────────────────────────────────────────────────
# GET /settings/export/csv
# ───────────────────────────────────────────────────────────────
@router.get("/export/csv")
def export_transactions_csv(
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db),
    ):
    """
    Export the authenticated owner's full transaction history as a CSV file.
    Dates and times are converted to India Standard Time (IST, UTC+5:30).
    """

    rows = (
        child_db.query(ChildTransaction, ChildCustomer.name)
        .join(ChildCustomer, ChildTransaction.customer_id == ChildCustomer.id)
        .filter(ChildTransaction.owner_id == owner_id)
        .order_by(ChildTransaction.entry_date.asc())
        .all()
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(
        ["Customer Name", "Type", "Amount", "Note", "Invoice Number", "Entry Date", "Entry Time"]
    )

    for txn, customer_name in rows:
        entry_date_ist = None
        if txn.entry_date:
            # If entry_date is naive (no tzinfo), assume it's stored in UTC
            # before converting, since create_transaction defaults to
            # datetime.now(timezone.utc).
            dt = txn.entry_date
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            entry_date_ist = dt.astimezone(IST)

        writer.writerow([
            customer_name,
            "Credit" if txn.type == "cr" else "Debit",
            float(txn.amount) if txn.amount is not None else "",
            txn.note or "",
            txn.invoice_number or "",
            entry_date_ist.strftime("%Y-%m-%d") if entry_date_ist else "",
            entry_date_ist.strftime("%H:%M:%S") if entry_date_ist else "",
        ])

    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=ledgerpro_transactions.csv"
        },
    )

