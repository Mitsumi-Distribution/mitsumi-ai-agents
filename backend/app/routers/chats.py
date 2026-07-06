from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from app.agents import AGENT_REGISTRY
from app.chats import ChatService
from app.core.auth import get_current_user

router = APIRouter(tags=["chats"])

chat_service = ChatService()


class ChatUpdateRequest(BaseModel):
    title: str | None = None
    pinned: bool | None = None


@router.post("/agent/{name}/chats")
async def create_chat(name: str, user=Depends(get_current_user)) -> dict:
    if name not in AGENT_REGISTRY:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown agent")
    return await chat_service.create_chat(user_id=user["id"], agent_name=name)


@router.get("/agent/{name}/chats")
async def list_chats(name: str, q: str | None = Query(default=None), user=Depends(get_current_user)) -> list[dict]:
    if name not in AGENT_REGISTRY:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown agent")
    return await chat_service.list_chats(user_id=user["id"], agent_name=name, query=q)


@router.get("/chats/{chat_id}")
async def get_chat(chat_id: str, user=Depends(get_current_user)) -> dict:
    chat = await chat_service.get_chat_with_messages(user_id=user["id"], chat_id=chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return chat


@router.patch("/chats/{chat_id}")
async def patch_chat(chat_id: str, payload: ChatUpdateRequest, user=Depends(get_current_user)) -> dict:
    updated = await chat_service.rename_or_pin(
        user_id=user["id"],
        chat_id=chat_id,
        title=payload.title,
        pinned=payload.pinned,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return updated


@router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str, user=Depends(get_current_user)) -> dict:
    ok = await chat_service.delete_chat(user_id=user["id"], chat_id=chat_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return {"ok": True}



@router.get("/chats/{chat_id}/export-pdf")
async def export_chat_pdf(chat_id: str, user=Depends(get_current_user)):
    """Export a chat conversation as a branded Mitsumi PDF."""
    from fastapi.responses import FileResponse
    from datetime import datetime, timezone
    from pathlib import Path

    chat = await chat_service.get_chat_with_messages(user_id=user["id"], chat_id=chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")

    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Image
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

    title = chat.get("title") or "Chat Export"
    agent = chat.get("agent_name") or "agent"
    messages = chat.get("messages") or []
    from app.core.tz import format_datetime as _fmt_dt
    now_str = _fmt_dt()

    output_dir = Path("generated")
    output_dir.mkdir(exist_ok=True)
    fname = f"chat_export_{chat_id[:8]}.pdf"
    fpath = output_dir / fname

    doc = SimpleDocTemplate(str(fpath), pagesize=A4,
                            rightMargin=20*mm, leftMargin=20*mm,
                            topMargin=15*mm, bottomMargin=15*mm)

    styles = getSampleStyleSheet()
    brand = HexColor("#4F6AF5")
    dark = HexColor("#0B0F19")
    muted = HexColor("#64748B")
    user_bg = HexColor("#EEF1FF")

    styles.add(ParagraphStyle("ExTitle", parent=styles["Title"], fontSize=18,
                              textColor=dark, fontName="Helvetica-Bold", spaceAfter=4))
    styles.add(ParagraphStyle("ExSub", parent=styles["Normal"], fontSize=9,
                              textColor=muted, spaceAfter=10))
    styles.add(ParagraphStyle("ExUser", parent=styles["Normal"], fontSize=10,
                              textColor=dark, leading=13, fontName="Helvetica-Bold",
                              backColor=user_bg, borderPadding=6, spaceAfter=4))
    styles.add(ParagraphStyle("ExBot", parent=styles["Normal"], fontSize=10,
                              textColor=dark, leading=13, spaceAfter=4))
    styles.add(ParagraphStyle("ExRole", parent=styles["Normal"], fontSize=8,
                              textColor=muted, spaceBefore=8, spaceAfter=2,
                              fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle("ExFooter", parent=styles["Normal"], fontSize=7,
                              textColor=muted, alignment=TA_CENTER))

    story = []

    # Logo
    logo_path = output_dir / "mitsumi_logo.png"
    if logo_path.exists():
        try:
            story.append(Image(str(logo_path), width=32, height=32))
            story.append(Spacer(1, 4))
        except Exception:
            pass

    story.append(Paragraph(title, styles["ExTitle"]))
    story.append(Paragraph(f"{agent.title()} Agent &middot; Exported {now_str}", styles["ExSub"]))
    story.append(HRFlowable(width="100%", color=brand, thickness=2, spaceAfter=12))

    for msg in messages:
        role = msg.get("role", "user")
        content = (msg.get("content") or "").strip()
        if not content:
            continue
        # Skip upload indicators
        if content.startswith("[Uploaded:"):
            continue
        # Clean markdown for PDF
        import re as _re
        content = _re.sub(r"\*\*(.+?)\*\*", r"\1", content)  # bold
        content = _re.sub(r"\*(.+?)\*", r"\1", content)       # italic
        content = _re.sub(r"`([^`]+)`", r"\1", content)       # code
        content = _re.sub(r"^#{1,4}\s+", "", content, flags=_re.MULTILINE)  # headings
        content = _re.sub(r"\[(.+?)\]\(.+?\)", r"\1", content)  # links
        # Strip table separators
        content = _re.sub(r"^\|[-:|\s]+\|$", "", content, flags=_re.MULTILINE)
        # Clean table rows to readable format
        lines_out = []
        for line in content.split("\n"):
            if line.strip().startswith("|") and line.strip().endswith("|"):
                cells = [c.strip() for c in line.split("|") if c.strip()]
                lines_out.append("  ".join(cells))
            else:
                lines_out.append(line)
        content = "\n".join(lines_out)
        content = content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        content = content[:3000]

        if role == "user":
            story.append(Paragraph("YOU", styles["ExRole"]))
            story.append(Paragraph(content, styles["ExUser"]))
        else:
            story.append(Paragraph("MITSUMI AI", styles["ExRole"]))
            story.append(Paragraph(content, styles["ExBot"]))
        story.append(Spacer(1, 4))

    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", color=muted, thickness=0.5, spaceAfter=8))
    story.append(Paragraph(
        f"Confidential &middot; Mitsumi Distribution &middot; {len(messages)} messages",
        styles["ExFooter"]))

    doc.build(story)
    return FileResponse(str(fpath), filename=fname, media_type="application/pdf")


@router.post("/chats/{chat_id}/upload")
async def upload_to_chat(chat_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload a file to a chat for document interaction."""
    from app.core.documents import upload_document

    chat = await chat_service.get_chat_with_messages(user_id=user["id"], chat_id=chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    content = await file.read()
    max_size = 20 * 1024 * 1024  # 20MB
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")

    result = await upload_document(
        chat_id=chat_id,
        filename=file.filename or "uploaded_file",
        content=content,
        user_email=user.get("email", ""),
    )
    return result


@router.get("/chats/{chat_id}/documents")
async def list_chat_documents(chat_id: str, user=Depends(get_current_user)):
    """List documents uploaded to a chat."""
    from app.core.documents import list_documents

    chat = await chat_service.get_chat_with_messages(user_id=user["id"], chat_id=chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return await list_documents(chat_id)


@router.get("/chats/{chat_id}/context")
async def get_chat_context(chat_id: str, user=Depends(get_current_user)):
    """Get context metadata for the chat (message count, summary status, docs)."""
    from app.core.documents import get_context_info
    return await get_context_info(chat_id)



# ---------- Notes ----------

class NoteCreate(BaseModel):
    content: str


@router.post("/chats/{chat_id}/notes")
async def add_note(chat_id: str, payload: NoteCreate, user=Depends(get_current_user)):
    """Add a note to a chat."""
    from app.core.notes import create_note
    return await create_note(chat_id, payload.content, user.get("email", ""))


@router.get("/chats/{chat_id}/notes")
async def get_notes(chat_id: str, user=Depends(get_current_user)):
    """List notes for a chat."""
    from app.core.notes import list_notes
    return await list_notes(chat_id)


@router.delete("/chats/{chat_id}/notes")
async def remove_note(chat_id: str, payload: NoteCreate, user=Depends(get_current_user)):
    """Delete a note."""
    from app.core.notes import delete_note
    ok = await delete_note(chat_id, payload.content, user.get("email", ""))
    return {"ok": ok}


# ---------- Artifacts (generated files for this chat) ----------

@router.get("/chats/{chat_id}/artifacts")
async def list_artifacts(chat_id: str, user=Depends(get_current_user)):
    """List all artifacts (uploaded docs + generated files) for a chat."""
    from app.core.documents import list_documents
    docs = await list_documents(chat_id)
    # Also find any generated files referenced in messages
    chat = await chat_service.get_chat_with_messages(user_id=user["id"], chat_id=chat_id)
    generated = []
    if chat:
        import re
        for msg in chat.get("messages", []):
            content = msg.get("content", "")
            for m in re.finditer(r'generated/([\w._-]+\.(pdf|xlsx|csv))', content):
                fname = m.group(1)
                if fname not in [g["filename"] for g in generated]:
                    generated.append({"filename": fname, "format": m.group(2), "source": "generated", "url": f"/static/{fname}"})
    return {"uploaded": docs, "generated": generated}
