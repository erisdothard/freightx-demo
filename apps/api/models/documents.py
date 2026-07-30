"""
FreightX API — Document Models
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    """Metadata for a freight document (BOL, Rate Con, POD, etc.)."""
    id: str
    load_id: str
    document_type: str = Field(..., description="bol, rate_confirmation, pod, invoice, etc.")
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    signed: bool = False
    signed_at: Optional[datetime] = None
    signed_by: Optional[str] = None
    hash_sha256: Optional[str] = Field(None, description="Cryptographic hash for chain of custody")
    attestation_hash: Optional[str] = Field(None, description="Carrier attestation hash at signing")
    created_at: datetime
