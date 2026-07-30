"""
FreightX API — Documents Router
"""

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from typing import Optional

from dependencies import require_scope
from models.documents import DocumentResponse
from services.supabase_client import query_table


router = APIRouter(
    prefix="/api/v1/documents",
    tags=["Documents"],
    dependencies=[Depends(require_scope("documents:read"))],
)


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    summary="Get document metadata",
    description="Returns metadata for a freight document (BOL, Rate Con, POD). Use the file_url to download.",
)
async def get_document(
    document_id: str = Path(..., description="UUID of the document"),
):
    """
    INTERVIEW NOTE: This returns metadata, not the file itself.
    The file_url points to Supabase Storage. For a more advanced API,
    you'd generate a pre-signed URL with an expiry time so the client
    can download directly from storage without going through your server.
    This is the "redirect" pattern — reduces bandwidth on your API server.
    """
    docs = await query_table("documents", filters={"id": document_id})
    if not docs:
        raise HTTPException(status_code=404, detail="Document not found")

    return docs[0]


@router.get(
    "",
    response_model=list[DocumentResponse],
    summary="List documents for a load",
)
async def list_documents(
    load_id: str = Query(..., description="UUID of the load"),
    document_type: Optional[str] = Query(None, description="Filter by type: bol, rate_confirmation, pod"),
):
    """List all documents associated with a load."""
    filters = {"load_id": load_id}
    if document_type:
        filters["document_type"] = document_type

    return await query_table(
        table="documents",
        filters=filters,
        order_by="-created_at",
    )
