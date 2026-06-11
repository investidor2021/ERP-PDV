from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# For sqlite databases, connect_args={"check_same_thread": False} is required
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(settings.DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI dependency to yield database sessions."""
    db = SessionLocal()
    try:
        # Enable sqlite foreign keys on connection
        if settings.DATABASE_URL.startswith("sqlite"):
            db.execute(text("PRAGMA foreign_keys = ON;"))
        yield db
    finally:
        db.close()
