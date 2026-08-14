"""
This SyncService is responsible for keeping the Parent database synchronized with the Child database.

Think of it like this:

Child DB = Main working database (source of truth)
Parent DB = Backup/mirror database

Whenever data changes in the Child DB, this service copies those changes to the Parent DB.
"""
# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from sqlalchemy.orm import Session
from datetime import datetime, timezone

# ───────────────────────────────────────────────────────────────
# SyncService - A class that contains all synchronization methods.
# ───────────────────────────────────────────────────────────────
class SyncService:
    """
    Handles writing to both Child and Parent databases.
    Rule: Child DB is source of truth for live data.
           Parent DB is the backup mirror.
    """
    # ─────Copies a customer from Child DB → Parent DB.───────────
    def sync_customer_to_parent(
        self,
        child_customer,
        parent_db: Session,
        parent_model
        ):
        """
        Upserts a customer record into Parent DB.
        Called after every create or update on Child DB.
        """
        # Step 1: Check if customer already exists
        existing = parent_db.query(parent_model).filter(
            parent_model.id == child_customer.id
        ).first()

        # Step 2: Update Existing Record
        if existing:
            existing.name = child_customer.name
            existing.email = child_customer.email
            existing.phone = child_customer.phone
            existing.address = child_customer.address
            existing.gst_number = child_customer.gst_number
            existing.notes = child_customer.notes
            existing.is_deleted = child_customer.is_deleted
            existing.deleted_at = child_customer.deleted_at
            existing.updated_at = child_customer.updated_at
        
        # Step 3: Insert New Record
        else:
            new_record = parent_model(
                id=child_customer.id,
                owner_id=child_customer.owner_id,
                name=child_customer.name,
                email=child_customer.email,
                phone=child_customer.phone,
                address=child_customer.address,
                gst_number=child_customer.gst_number,
                notes=child_customer.notes,
                is_deleted=child_customer.is_deleted,
                deleted_at=child_customer.deleted_at,
                created_at=child_customer.created_at,
                updated_at=child_customer.updated_at,
            )

            parent_db.add(new_record)

        parent_db.commit()
    
    # ───── Copies a Transactions from Child DB → Parent DB.───────────
    def sync_transaction_to_parent(
        self,
        child_txn,
        parent_db: Session,
        parent_model
        ):
        """
        Upserts a transcation record into Parent DB.
        Called after every create or update on Child DB.
        """
        # Step 1: Check if transcation already exists
        existing = parent_db.query(parent_model).filter(
            parent_model.id == child_txn.id
        ).first()

        # Step 2: Update Existing Record
        if existing:
            existing.type = child_txn.type  
            existing.amount = child_txn.amount
            existing.note = child_txn.note
            existing.invoice_number = child_txn.invoice_number
            existing.entry_date = child_txn.entry_date

            existing.is_deleted = False
            existing.deleted_at = None
            existing.updated_at = child_txn.updated_at

        # Step 3: Insert New Record
        else:
            new_record = parent_model(
                id=child_txn.id,
                customer_id=child_txn.customer_id,
                owner_id=child_txn.owner_id,
                type=child_txn.type,
                amount=child_txn.amount,
                note=child_txn.note,
                invoice_number=child_txn.invoice_number,
                entry_date=child_txn.entry_date,
                is_deleted=False,
                deleted_at=None,
                created_at=child_txn.created_at,
                updated_at=child_txn.updated_at,
            )
            parent_db.add(new_record)

        parent_db.commit()

    # ───── Owner only save in Parent db───────────
    def sync_owner_to_parent(
        self,
        owner_data: dict,
        parent_db: Session,
        parent_model
        ):
        """
        Owner only lives in Parent DB, so this just inserts on signup.
        """

        # Step 1: Check Owner Exists
        existing = parent_db.query(parent_model).filter(
            parent_model.id == owner_data["id"]
        ).first()

        # Step 2: Insert If Missing
        if not existing:
            new_owner = parent_model(**owner_data)
            parent_db.add(new_owner)
            parent_db.commit()


# ───────────────────────────────────────────────────────────────
# Singleton Instance
# Creates one object that can be imported anywhere.
# ───────────────────────────────────────────────────────────────
sync_service = SyncService()