from dataclasses import dataclass

from app.core.config import settings


@dataclass(frozen=True)
class EmailContent:
    subject: str
    html: str
    text: str


def _base_html(title: str, preview: str, body_html: str) -> str:
    return f"""
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>{title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;color:#111827;font-family:'DM Sans',Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:20px 24px;background:#0b0f19;color:#ffffff;">
                <div style="font-size:18px;font-weight:700;line-height:1.2;">Mitsumi AI Platform</div>
                <div style="margin-top:6px;font-size:12px;opacity:0.82;">{preview}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                {body_html}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
                If you did not request this, contact support at {settings.EMAIL_REPLY_TO}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""".strip()


def login_otp_template(email: str, otp_code: str, expires_minutes: int) -> EmailContent:
    subject = "Your Mitsumi login code"
    html = _base_html(
        title=subject,
        preview="Use this OTP code to complete your sign in.",
        body_html=f"""
          <h1 style="margin:0 0 8px;font-size:20px;font-family:'Sora',Arial,sans-serif;">Sign in verification</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#475569;">
            Hi {email}, use the one-time code below to sign in to your account.
          </p>
          <div style="display:inline-block;padding:10px 14px;border:1px solid #dbeafe;background:#eef1ff;border-radius:12px;font-size:28px;letter-spacing:6px;font-family:'JetBrains Mono',monospace;color:#3b52d9;">
            {otp_code}
          </div>
          <p style="margin:16px 0 0;font-size:13px;color:#64748b;">This code expires in {expires_minutes} minutes.</p>
        """,
    )
    text = (
        f"Mitsumi AI sign in code\n\n"
        f"Email: {email}\n"
        f"OTP: {otp_code}\n"
        f"Expires in {expires_minutes} minutes.\n"
    )
    return EmailContent(subject=subject, html=html, text=text)


def reset_otp_template(email: str, otp_code: str, expires_minutes: int) -> EmailContent:
    subject = "Your Mitsumi password reset code"
    html = _base_html(
        title=subject,
        preview="Use this OTP code to verify your password reset request.",
        body_html=f"""
          <h1 style="margin:0 0 8px;font-size:20px;font-family:'Sora',Arial,sans-serif;">Password reset request</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#475569;">
            Hi {email}, we received a request to reset your password. Verify using:
          </p>
          <div style="display:inline-block;padding:10px 14px;border:1px solid #fed7aa;background:#fff7ed;border-radius:12px;font-size:28px;letter-spacing:6px;font-family:'JetBrains Mono',monospace;color:#c2410c;">
            {otp_code}
          </div>
          <p style="margin:16px 0 0;font-size:13px;color:#64748b;">This code expires in {expires_minutes} minutes.</p>
        """,
    )
    text = (
        f"Mitsumi AI password reset code\n\n"
        f"Email: {email}\n"
        f"OTP: {otp_code}\n"
        f"Expires in {expires_minutes} minutes.\n"
    )
    return EmailContent(subject=subject, html=html, text=text)


def password_reset_success_template(email: str) -> EmailContent:
    subject = "Your Mitsumi password was changed"
    html = _base_html(
        title=subject,
        preview="Confirmation that your account password was updated.",
        body_html=f"""
          <h1 style="margin:0 0 8px;font-size:20px;font-family:'Sora',Arial,sans-serif;">Password updated</h1>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#475569;">
            This is a confirmation that the password for <strong>{email}</strong> was successfully changed.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.5;color:#475569;">
            If this was not you, secure your account immediately and contact support.
          </p>
        """,
    )
    text = (
        f"Mitsumi AI password changed\n\n"
        f"The password for {email} was changed successfully.\n"
        f"If this was not you, contact support at {settings.EMAIL_REPLY_TO}.\n"
    )
    return EmailContent(subject=subject, html=html, text=text)
