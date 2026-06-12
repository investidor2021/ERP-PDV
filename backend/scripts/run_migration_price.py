import os
from sqlalchemy import create_engine, text

# Conecta ao master.db do tenant 1 (assumindo SQLite para dev, ou pegando engine)
# O ambiente do projeto parece usar multi-tenant schema com `master.db` ou postgres.
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
db_path = os.path.join(backend_dir, "erp_peps.db")
print(f"Running migration on {db_path}")

engine = create_engine(f"sqlite:///{db_path}")

migration_sql = """
ALTER TABLE produtos ADD COLUMN preco_custo FLOAT NOT NULL DEFAULT 0.0;
ALTER TABLE produtos ADD COLUMN preco_sugerido_venda FLOAT NULL;
UPDATE produtos SET preco_custo = preco_venda WHERE preco_custo = 0;
"""

with engine.connect() as conn:
    for stmt in migration_sql.split(";"):
        if stmt.strip():
            try:
                conn.execute(text(stmt))
                conn.commit()
                print(f"Executed: {stmt.strip()}")
            except Exception as e:
                print(f"Error or already migrated: {e}")
