"""
FreightX API — Pydantic Models

INTERVIEW NOTE: Pydantic is the foundation of FastAPI. Every request body,
response body, and query parameter is validated through Pydantic models.

Key interview concepts:
- BaseModel: defines the shape of data (like TypeScript interfaces)
- Field(): adds validation rules, descriptions, examples
- model_validator: cross-field validation (e.g., pickup_date < delivery_date)
- response_model: controls what gets sent back (hides internal fields)

"What's the difference between Pydantic v1 and v2?"
Answer: v2 is a complete rewrite in Rust (pydantic-core). 5-50x faster.
Key changes: model_config replaces Config class, field_validator replaces
validator, model_validator replaces root_validator.
"""
