"""
FreightX API — Router Registry

INTERVIEW NOTE: This __init__.py imports all routers so main.py can do:
    from routers import health, loads, rates, ...

Without this, you'd need:
    from routers.health import router as health_router
    from routers.loads import router as loads_router
    ... (repetitive)

Some projects use auto-discovery (scanning the routers/ directory), but
explicit imports are simpler and more readable.
"""
