from app.email.service import send_transactional_email
from app.email.templates import (
    EmailContent,
    login_otp_template,
    password_reset_success_template,
    reset_otp_template,
)

__all__ = [
    "EmailContent",
    "login_otp_template",
    "password_reset_success_template",
    "reset_otp_template",
    "send_transactional_email",
]
