---
paths:
  - 'api/**/*.py'
  - 'src/lib/api/**/*.ts'
---

# API Design Rules

- All FastAPI routes return { data, error } shape
- Use Pydantic models for all request bodies — no raw dicts
- Async handlers only — no sync def in FastAPI routes
- All endpoints must handle and return explicit error responses
- Never expose internal error messages to the client
- Auth check on every protected route — no exceptions
