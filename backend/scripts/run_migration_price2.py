import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.core.database import engine
from sqlalchemy import text

migration_sql = """
ALTER TABLE produtos ADD COLUMN preco_custo FLOAT NOT NULL DEFAULT 0.0;
ALTER TABLE produtos ADD COLUMN preco_sugerido_venda FLOAT NULL;
UPDATE produtos SET preco_custo = preco_venda WHERE preco_custo = 0;
"""

print(f"Engine: {engine.url}")

try:
    with engine.connect() as conn:
        for stmt in migration_sql.split(";"):
            if stmt.strip():
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                    print(f"Executed: {stmt.strip()}")
                except Exception as e:
                    print(f"Error or already migrated: {e}")
except Exception as e:
    print(f"Connection error: {e}")
