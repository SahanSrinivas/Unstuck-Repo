"""Resend email service with graceful no-op when API key is missing/dummy."""
import os
import asyncio
import logging

logger = logging.getLogger("unstuck.email")

_RESEND_KEY = os.environ.get("RESEND_API_KEY", "")
_SENDER = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
_FRONTEND = os.environ.get("FRONTEND_URL", "https://unstuck.dev")

# Detect dummy / unconfigured key — skip sending so dev never blocks
_DUMMY_PREFIXES = ("dummy", "re_dummy", "")
_ENABLED = _RESEND_KEY and not any(_RESEND_KEY.startswith(p) for p in _DUMMY_PREFIXES if p) and "dummy" not in _RESEND_KEY.lower()

try:
    import resend  # noqa: F401
    if _ENABLED:
        resend.api_key = _RESEND_KEY
except ImportError:
    _ENABLED = False
    logger.warning("resend SDK not installed — emails disabled")


def _wrap(title: str, body_html: str, cta_label: str = "", cta_url: str = "") -> str:
    """Minimal inline-styled HTML wrapper."""
    cta = ""
    if cta_label and cta_url:
        cta = f"""
        <div style="margin-top:24px"><a href="{cta_url}" style="display:inline-block;background:#5A1BA9;color:#FFFFFF;font-family:Inter,sans-serif;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;text-decoration:none">{cta_label}</a></div>
        """
    return f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F7F5FB;font-family:Inter,Arial,sans-serif;color:#1C1033">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5FB;padding:40px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E1EE;border-radius:12px;padding:40px;max-width:560px">
  <tr><td style="font-family:Inter,Arial,sans-serif;font-size:22px;font-weight:700;color:#1C1033;letter-spacing:-0.01em">Unstuck<span style="color:#5A1BA9">.</span></td></tr>
  <tr><td style="padding-top:20px;font-family:Inter,Arial,sans-serif;font-size:24px;font-weight:600;color:#1C1033;line-height:1.3">{title}</td></tr>
  <tr><td style="padding-top:14px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#5C5478">{body_html}</td></tr>
  <tr><td>{cta}</td></tr>
  <tr><td style="padding-top:32px;font-family:Inter,Arial,sans-serif;font-size:12px;color:#8E87A6">Real AI engineers, in 5 minutes. — unstuck.dev</td></tr>
</table>
</td></tr>
</table></body></html>"""


async def _send(to: str, subject: str, html: str) -> None:
    if not _ENABLED:
        logger.info("[email-skipped] to=%s subject=%s (RESEND_API_KEY not configured)", to, subject)
        return
    try:
        import resend
        params = {"from": _SENDER, "to": [to], "subject": subject, "html": html}
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info("[email-sent] to=%s subject=%s", to, subject)
    except Exception as e:
        logger.warning("[email-failed] to=%s err=%s", to, e)


async def send_doubt_matched(to: str, name: str, tutor_name: str, topic: str, session_id: str) -> None:
    body = f"""Hi {name},<br><br>
Your doubt on <b>{topic}</b> has been matched with <b>{tutor_name}</b>.
Open the session below — your tutor is ready when you are."""
    html = _wrap(f"Matched with {tutor_name}", body, "Open session", f"{_FRONTEND}/sessions/{session_id}")
    await _send(to, f"Matched with {tutor_name} — your {topic} doubt", html)


async def send_session_summary(to: str, name: str, tutor_name: str, topic: str, summary: str, session_id: str) -> None:
    body = f"""Hi {name},<br><br>
Your session with <b>{tutor_name}</b> on <b>{topic}</b> just ended. Quick summary:<br><br>
<i>{summary or "Session completed."}</i>"""
    html = _wrap("Your session summary", body, "View session", f"{_FRONTEND}/sessions/{session_id}")
    await _send(to, f"Summary: {topic} with {tutor_name}", html)


async def send_refund_confirmation(to: str, name: str, amount: float, topic: str) -> None:
    body = f"""Hi {name},<br><br>
We've initiated a same-day refund of <b>${amount:.2f}</b> for your <b>{topic}</b> doubt.
The session has been flagged for quality review. We'll do better next time."""
    html = _wrap("Refund initiated", body, "Open dashboard", f"{_FRONTEND}/dashboard/billing")
    await _send(to, "Your refund is on the way", html)


async def send_tutor_application_received(to: str, name: str) -> None:
    body = f"""Hi {name},<br><br>
We received your application to tutor on Unstuck. We review every one personally —
expect to hear back within 3 business days from <b>tutors@unstuck.dev</b>."""
    html = _wrap("Application received", body)
    await _send(to, "Your Unstuck tutor application", html)
