"""Migrate all SQLite tenant databases to add preco_custo and preco_sugerido_venda columns."""
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from sqlalchemy import create_engine, text, inspect

def migrate_db(db_path):
    print(f"\nMigrating: {db_path}")
    engine = create_engine(f"sqlite:///{db_path}")
    
    # Check if table exists
    insp = inspect(engine)
    if "produtos" not in insp.get_table_names():
        print("  -> No 'produtos' table, skipping.")
        return
    
    existing_cols = {c["name"] for c in insp.get_columns("produtos")}
    
    with engine.begin() as conn:
        if "preco_custo" not in existing_cols:
            conn.execute(text("ALTER TABLE produtos ADD COLUMN preco_custo FLOAT NOT NULL DEFAULT 0.0"))
            conn.execute(text("UPDATE produtos SET preco_custo = preco_venda WHERE preco_custo = 0"))
            print("  -> Added preco_custo")
        else:
            print("  -> preco_custo already exists")
        
        if "preco_sugerido_venda" not in existing_cols:
            conn.execute(text("ALTER TABLE produtos ADD COLUMN preco_sugerido_venda FLOAT NULL"))
            print("  -> Added preco_sugerido_venda")
        else:
            print("  -> preco_sugerido_venda already exists")

# Main db
for fname in ["erp_peps.db", "master.db"]:
    p = os.path.join(backend_dir, fname)
    if os.path.exists(p):
        migrate_db(p)

# Tenant dbs
tenants_dir = os.path.join(backend_dir, "tenants")
if os.path.exists(tenants_dir):
    for f in os.listdir(tenants_dir):
        if f.endswith(".db"):
            migrate_db(os.path.join(tenants_dir, f))

print("\nAll done!")
