"""Shared rate limiter — slowapi (in-memory; Redis if REDIS_URL is set)."""
import os
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.environ.get("REDIS_URL") or "memory://",
    default_limits=["200/minute"],
)
