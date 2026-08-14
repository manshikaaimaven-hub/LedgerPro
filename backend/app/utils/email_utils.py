"""
Email Service

This module contains helper functions for sending application emails.

It is responsible for:
- Sending customer invitation emails.
- Sending password reset emails.
- Managing SMTP communication with the mail server.

Email sending is designed to run as a FastAPI BackgroundTask so API
responses are returned immediately without waiting for the email to be
delivered.
"""

# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

# ───────────────────────────────────────────────────────────────
# Sends a single email via SMTP. 
# Used by both invite and password reset emails.
# ───────────────────────────────────────────────────────────────
def send_email(to_email: str, subject: str, html_body: str) -> None:
    """
    Sends an HTML email using the configured SMTP server.

    This is the common email function used by all email-related features
    in the application, such as customer invitations and password reset
    emails.

    Notes:
    - Any email delivery failure is logged but not raised as an exception.
    - This prevents email issues from interrupting normal application
      operations, such as customer creation.
    - Failed emails can be resent later if needed.

    Args:
        to_email (str):
            Recipient's email address.

        subject (str):
            Subject of the email.

        html_body (str):
            HTML content of the email.

    Returns:
        None
    """

    # Step 1: Create an email message that supports HTML content.
    msg = MIMEMultipart("alternative")

    # Step 2: Set the email subject, sender, and recipient.
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_EMAIL
    msg["To"] = to_email

    # Step 3: Attach the HTML body to the email.
    msg.attach(MIMEText(html_body, "html"))

    try:
        # Step 4: Connect to the SMTP server.
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:

            # Step 5: Upgrade the connection to a secure TLS session.
            server.starttls()

            # Step 6: Authenticate using the configured email credentials.
            server.login(settings.SMTP_EMAIL, settings.SMTP_APP_PASSWORD)

            # Step 7: Send the email to the recipient.
            server.sendmail(
                settings.SMTP_EMAIL,
                [to_email],
                msg.as_string()
            )

    except Exception as e:
        # Step 8: Log the error without interrupting the application.
        # Email failures should not stop the main operation.
        print(f"[EMAIL FAILED] Could not send to {to_email}: {e}")

# ───────────────────────────────────────────────────────────────
# Invite Email — sent to a customer when an owner adds them to the ledger
# ───────────────────────────────────────────────────────────────
def send_invite_email(to_email: str, customer_name: str, business_name: str, invite_link: str) -> None:
    """
    Creates and sends a customer invitation email.

    The email invites a customer to activate their account and view
    their ledger information online.

    Steps:
    1. Create the invitation email subject.
    2. Build the HTML email template and Include the account setup link.
    3. Send the email using the common email helper.

    Args:
        to_email (str):
            Customer's email address.

        customer_name (str):
            Customer's full name.

        business_name (str):
            Name of the business sending the invitation.

        invite_link (str):
            Secure account setup link.

    Returns:
        None
    """
    # Step 1: Create the invitation email subject.
    subject = f"{business_name} invited you to view your ledger"

    # Step 2: Build the HTML email template and Include the account setup link.
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
    # Step 3: Send the email using the common email helper.
    send_email(to_email, subject, html_body)


# ───────────────────────────────────────────────────────────────
# Sends a password reset email to the owner with a time-limited link.
# The link points to the frontend, which will call /auth/reset-password
# ───────────────────────────────────────────────────────────────
def send_password_reset_email(
    to_email: str,
    full_name: str,
    reset_link: str
    ) -> None:
    """
    Creates and sends a password reset email.

    The email contains a secure, time-limited link that allows the
    owner to create a new password.

    Steps:
    1. Create the password reset email subject.
    2. Build the HTML email template and Include the password reset link.
    3. Send the email using the common email helper.

    Args:
        to_email (str):
            Owner's email address.

        full_name (str):
            Owner's full name.

        reset_link (str):
            Secure password reset link.

    Returns:
        None
    """
    # Step 1: Create the password reset email subject.
    subject = "Reset Your LedgerPro Password"

    # Step 2: Build the HTML email template and Include the password reset link.
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Hello {full_name},</h2>

        <p>We received a request to reset your LedgerPro password.</p>

        <p>
            Click the button below to create a new password:
        </p>

        <p style="text-align:center;">
            <a href="{reset_link}"
               style="
                   display:inline-block;
                   background:#1D9E75;
                   color:white;
                   padding:12px 24px;
                   text-decoration:none;
                   border-radius:6px;
                   font-weight:bold;
               ">
                Reset Password
            </a>
        </p>

        <p>This link will expire in 15 minutes.</p>

        <p>If you didn't request this password reset, you can safely ignore this email.</p>

        <br>

        <p>Regards,<br>
        LedgerPro Team</p>
    </div>
    """
    # Step 3: Send the email using the common email helper.
    send_email(to_email, subject, html_body)