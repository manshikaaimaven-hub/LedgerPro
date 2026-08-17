"""
Email Service

This module contains helper functions for sending application emails.

It is responsible for:
- Sending customer invitation emails.
- Sending password reset emails.
- Managing email delivery via Brevo's HTTP API.

Email sending is designed to run as a FastAPI BackgroundTask so API
responses are returned immediately without waiting for the email to be
delivered.

NOTE: Switched from raw SMTP to Brevo's HTTPS API because Railway
blocks outbound SMTP ports (25/465/587) on Free/Trial/Hobby plans.
HTTPS is never blocked, so this works on any Railway plan.
"""

# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
import requests
from app.config import settings

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"

# ───────────────────────────────────────────────────────────────
# Sends a single email via Brevo's HTTP API.
# Used by both invite and password reset emails.
# ───────────────────────────────────────────────────────────────
def send_email(to_email: str, subject: str, html_body: str) -> None:
    """
    Sends an HTML email using Brevo's transactional email API.

    Notes:
    - Any email delivery failure is logged but not raised as an exception.
    - This prevents email issues from interrupting normal application
      operations, such as customer creation.
    - Failed emails can be resent later if needed.
    """
    headers = {
        "api-key": settings.BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    payload = {
        "sender": {
            "name": settings.BREVO_FROM_NAME,
            "email": settings.BREVO_FROM_EMAIL,
        },
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_body,
    }

    try:
        response = requests.post(BREVO_API_URL, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        print(f"Email sent to {to_email}")

    except Exception as e:
        print(f"[EMAIL FAILED] Could not send to {to_email}: {e}")


# ───────────────────────────────────────────────────────────────
# Invite Email — sent to a customer when an owner adds them to the ledger
# ───────────────────────────────────────────────────────────────
def send_invite_email(to_email: str, customer_name: str, business_name: str, invite_link: str) -> None:
    subject = f"{business_name} invited you to view your ledger"

    html_body = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
      <h2>Hi {customer_name},</h2>
      <p><b>{business_name}</b> has set up an account so you can view your
      balance and transaction history anytime.</p>
      <p>
        <a href="{invite_link}"
           style="display:inline-block; background:#1D9E75; color:#fff;
                  padding:12px 22px; border-radius:8px; text-decoration:none;">
          Set up your account
        </a>
      </p>
      <p style="color:#888; font-size:13px;">This link expires in 7 days.
      If you didn't expect this email, you can ignore it.</p>
    </div>
    """
    send_email(to_email, subject, html_body)


# ───────────────────────────────────────────────────────────────
# Sends a password reset email to the owner with a time-limited link.
# The link points to the frontend, which will call /auth/reset-password
# ───────────────────────────────────────────────────────────────
def send_password_reset_email(to_email: str, full_name: str, reset_link: str) -> None:
    subject = "Reset Your LedgerPro Password"

    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Hello {full_name},</h2>
        <p>We received a request to reset your LedgerPro password.</p>
        <p style="text-align:center;">
            <a href="{reset_link}"
               style="display:inline-block; background:#1D9E75; color:white;
                      padding:12px 24px; text-decoration:none; border-radius:6px;
                      font-weight:bold;">
                Reset Password
            </a>
        </p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this password reset, you can safely ignore this email.</p>
        <br>
        <p>Regards,<br>LedgerPro Team</p>
    </div>
    """
    send_email(to_email, subject, html_body)