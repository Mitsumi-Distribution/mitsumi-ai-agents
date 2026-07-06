from app.core.config import settings
from app.email import login_otp_template, reset_otp_template, send_transactional_email


async def deliver_otp_email(email: str, purpose: str, otp_code: str) -> None:
    if purpose == "login":
        content = login_otp_template(
            email=email,
            otp_code=otp_code,
            expires_minutes=settings.OTP_EXPIRE_MINUTES,
        )
    elif purpose == "reset":
        content = reset_otp_template(
            email=email,
            otp_code=otp_code,
            expires_minutes=settings.OTP_EXPIRE_MINUTES,
        )
    else:
        return

    await send_transactional_email(to_email=email, content=content)
