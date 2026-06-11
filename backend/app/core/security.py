import os
import hashlib
import jwt
from datetime import datetime, timedelta

# Simple security config (normally this would be in configuration settings)
JWT_SECRET = os.getenv("JWT_SECRET", "erp-peps-super-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 # 24 Hours

def hash_password(password: str) -> str:
    """Generates a secure PBKDF2 hash from a password string with a random salt."""
    salt = os.urandom(16)
    db_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    return f"{salt.hex()}${db_hash.hex()}"

def verify_password(password: str, hashed_password: str) -> bool:
    """Verifies a password against a stored PBKDF2 hash."""
    try:
        salt_hex, hash_hex = hashed_password.split("$")
        salt = bytes.fromhex(salt_hex)
        expected_hash = bytes.fromhex(hash_hex)
        db_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
        return db_hash == expected_hash
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Creates a JWT access token for a user."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> dict:
    """Decodes a JWT token, verifying its signature and expiry. Returns payload or None."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
