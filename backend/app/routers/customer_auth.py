"""
Customer-role authentication — ONE login per person, reusable across
every owner (business) that invites them.

Flow:
  1. POST /customers/{id}/invite        — owner invites, email sent
  2. GET  /auth/invite-preview          — customer opens link, we check
                                           if they already have an account
  3a. POST /auth/customer-signup        — NEW customer: sets username+password
  3b. POST /auth/customer-link-invite   — RETURNING customer: just links
                                           this business to their existing login
  4. POST /auth/customer-login          — customer logs in going forward
  5. GET  /customer/my-businesses       — lists every business they're linked to
"""
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import List
import uuid

from app.database.child_db import get_child_db
from app.database.parent_db import get_parent_db
from app.models.child_models import ChildCustomer
from app.models.parent_models import ParentOwner, ParentCustomerAccount, ParentCustomerOwnerLink
from app.schemas.customer_auth_schemas import (
    InviteResponse, InvitePreviewResponse, CustomerSignupRequest,
    CustomerLoginRequest, CustomerTokenResponse, LinkedBusiness
)
from app.utils.deps import get_current_owner_id, get_current_customer_account
from app.utils.auth_utils import (
    hash_password, verify_password,
    create_customer_invite_token, decode_customer_invite_token,
    create_customer_access_token, create_customer_refresh_token
)
from app.utils.email_utils import send_invite_email
from app.config import settings

router = APIRouter(tags=["Customer Auth"])
limiter = Limiter(key_func=get_remote_address)
FRONTEND_BASE_URL = settings.FRONTEND_URL


def _get_business_name(owner_id: str, parent_db: Session) -> str:
    owner = parent_db.query(ParentOwner).filter(ParentOwner.id == owner_id).first()
    return owner.business_name if owner else "Your supplier"


# ───────────────────────────────────────────────────────────────
# OWNER generates + emails the invite
# ───────────────────────────────────────────────────────────────
@router.post("/customers/{customer_id}/invite", response_model=InviteResponse)
def generate_customer_invite(
    customer_id: str,
    background_tasks: BackgroundTasks,
    owner_id: str = Depends(get_current_owner_id),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """
    Owner (re-)generates and emails an invite link for one customer.

    Steps:
    1. Confirm the customer exists, belongs to this owner, and has an
       email on file.
    2. Confirm this owner isn't already linked to this customer (no
       point re-inviting someone who's already connected).
    3. Generate the token + email it.
    """
    customer = child_db.query(ChildCustomer).filter(
        ChildCustomer.id == customer_id,
        ChildCustomer.owner_id == owner_id,
        ChildCustomer.is_deleted == False,
    ).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    if not customer.email:
        raise HTTPException(400, "This customer has no email on file. Add one before sending an invite.")

    already_linked = parent_db.query(ParentCustomerOwnerLink).filter(
        ParentCustomerOwnerLink.owner_id == owner_id,
        ParentCustomerOwnerLink.customer_id == customer_id,
    ).first()
    if already_linked:
        raise HTTPException(400, "This customer is already linked to your account")

    token = create_customer_invite_token(owner_id, customer_id)
    invite_link = f"{FRONTEND_BASE_URL}/customer-signup?token={token}"
    business_name = _get_business_name(owner_id, parent_db)

    background_tasks.add_task(
        send_invite_email,
        to_email=customer.email, customer_name=customer.name,
        business_name=business_name, invite_link=invite_link,
    )

    return InviteResponse(invite_token=token, invite_link=invite_link, expires_in_hours=24 * 7)


# ───────────────────────────────────────────────────────────────
# CUSTOMER opens the link — check whether they already have an account
# ───────────────────────────────────────────────────────────────
@router.get("/auth/invite-preview", response_model=InvitePreviewResponse)
def preview_invite(
    token: str,
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """
    Frontend calls this first when the customer opens the invite link,
    to decide which screen to show:
      - account_already_exists = False → show 'set a password' form
      - account_already_exists = True  → show 'log in to link' form
    """
    try:
        invite = decode_customer_invite_token(token)
    except ValueError as e:
        raise HTTPException(400, str(e))

    customer = child_db.query(ChildCustomer).filter(ChildCustomer.id == invite["customer_id"]).first()
    if not customer or not customer.email:
        raise HTTPException(400, "This invite is no longer valid")

    account = parent_db.query(ParentCustomerAccount).filter(
        ParentCustomerAccount.email == customer.email
    ).first()

    return InvitePreviewResponse(
        customer_name=customer.name,
        business_name=_get_business_name(invite["owner_id"], parent_db),
        email=customer.email,
        account_already_exists=account is not None,
    )


# ───────────────────────────────────────────────────────────────
# NEW customer: accept invite by setting username + password
# ───────────────────────────────────────────────────────────────
@router.post("/auth/customer-signup", response_model=CustomerTokenResponse, status_code=201)
@limiter.limit("5/minute")
def customer_signup(request: Request, body: CustomerSignupRequest,
                     child_db: Session = Depends(get_child_db),
                     parent_db: Session = Depends(get_parent_db)):
    """
    First-time signup: creates the CustomerAccount AND the link to
    this specific business in one step, then logs them straight in.

    Steps:
    1. Decode the invite token.
    2. Look up the customer's email — this becomes their account identity.
    3. If an account with this email already exists, they should have
       used /auth/customer-link-invite instead — reject with a clear
       message so the frontend can redirect them.
    4. Check username isn't taken.
    5. Create the account + the link, in that order.
    """
    try:
        invite = decode_customer_invite_token(body.invite_token)
    except ValueError as e:
        raise HTTPException(400, str(e))

    customer = child_db.query(ChildCustomer).filter(ChildCustomer.id == invite["customer_id"]).first()
    if not customer or not customer.email:
        raise HTTPException(400, "This invite is no longer valid")

    existing_account = parent_db.query(ParentCustomerAccount).filter(
        ParentCustomerAccount.email == customer.email
    ).first()
    if existing_account:
        raise HTTPException(400, "An account already exists for this email. Please log in to link this business instead.")

    if parent_db.query(ParentCustomerAccount).filter(ParentCustomerAccount.username == body.username).first():
        raise HTTPException(400, "That username is already taken, please choose another")

    account = ParentCustomerAccount(
        id=str(uuid.uuid4()), email=customer.email, username=body.username,
        hashed_password=hash_password(body.password), full_name=customer.name,
    )
    parent_db.add(account)
    parent_db.commit()
    parent_db.refresh(account)

    parent_db.add(ParentCustomerOwnerLink(
        id=str(uuid.uuid4()), customer_account_id=account.id,
        owner_id=invite["owner_id"], customer_id=invite["customer_id"],
    ))
    parent_db.commit()

    return CustomerTokenResponse(
        access_token=create_customer_access_token(account.id),
        full_name=account.full_name,
    )


# ───────────────────────────────────────────────────────────────
# RETURNING customer: link a new business to their existing account
# ───────────────────────────────────────────────────────────────
@router.post("/auth/customer-link-invite")
def link_invite_to_existing_account(
    token: str,
    current=Depends(get_current_customer_account),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """
    Customer is ALREADY logged in (they signed in first, since they
    recognized they already have an account) and is now accepting a
    second/third business's invite. This just adds the link — no new
    password needed.
    """
    try:
        invite = decode_customer_invite_token(token)
    except ValueError as e:
        raise HTTPException(400, str(e))

    customer = child_db.query(ChildCustomer).filter(ChildCustomer.id == invite["customer_id"]).first()
    if not customer:
        raise HTTPException(400, "This invite is no longer valid")

    already_linked = parent_db.query(ParentCustomerOwnerLink).filter(
        ParentCustomerOwnerLink.customer_account_id == current["customer_account_id"],
        ParentCustomerOwnerLink.owner_id == invite["owner_id"],
    ).first()
    if already_linked:
        raise HTTPException(400, "This business is already linked to your account")

    parent_db.add(ParentCustomerOwnerLink(
        id=str(uuid.uuid4()), customer_account_id=current["customer_account_id"],
        owner_id=invite["owner_id"], customer_id=invite["customer_id"],
    ))
    parent_db.commit()

    return {"message": "Business linked to your account"}


# ───────────────────────────────────────────────────────────────
# Login (works the same regardless of how many businesses they have)
# ───────────────────────────────────────────────────────────────
@router.post("/auth/customer-login", response_model=CustomerTokenResponse)
@limiter.limit("10/minute")
def customer_login(request: Request, body: CustomerLoginRequest, parent_db: Session = Depends(get_parent_db)):
    """Same generic-error pattern as owner login — no username enumeration."""
    account = parent_db.query(ParentCustomerAccount).filter(
        ParentCustomerAccount.username == body.username,
        ParentCustomerAccount.is_active == True,
    ).first()

    if not account or not verify_password(body.password, account.hashed_password):
        raise HTTPException(401, "Incorrect username or password")

    return CustomerTokenResponse(
        access_token=create_customer_access_token(account.id),
        full_name=account.full_name,
    )


# ───────────────────────────────────────────────────────────────
# Dashboard: which businesses is this account linked to?
# ───────────────────────────────────────────────────────────────
@router.get("/customer/my-businesses", response_model=List[LinkedBusiness])
def list_my_businesses(
    current=Depends(get_current_customer_account),
    child_db: Session = Depends(get_child_db),
    parent_db: Session = Depends(get_parent_db),
    ):
    """
    Returns every business this account is linked to — the dashboard
    uses this to show a switcher if there's more than one.
    """
    links = parent_db.query(ParentCustomerOwnerLink).filter(
        ParentCustomerOwnerLink.customer_account_id == current["customer_account_id"]
    ).all()

    result = []
    for link in links:
        owner = parent_db.query(ParentOwner).filter(ParentOwner.id == link.owner_id).first()
        customer = child_db.query(ChildCustomer).filter(ChildCustomer.id == link.customer_id).first()
        result.append(LinkedBusiness(
            owner_id=link.owner_id,
            business_name=owner.business_name if owner else "Unknown business",
            customer_name=customer.name if customer else current["full_name"],
        ))
    return result