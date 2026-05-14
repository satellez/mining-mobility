"""
Agrega FK constraints a dim_hipotesis, dim_vehiculo y dim_actor
para que el Schema Visualizer de Supabase muestre las conexiones.
"""

import psycopg2

ADMIN_URL = (
    "postgresql://postgres.kxbjbjuzcagmpggdtgos:Minenuco0202*"
    "@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require"
)

STEPS = [
    ("FK dim_hipotesis -> fact_siniestros", """
        ALTER TABLE dim_hipotesis
        ADD CONSTRAINT fk_dim_hip_sin
        FOREIGN KEY (siniestro_id) REFERENCES fact_siniestros(siniestro_id)
    """),
    ("FK dim_vehiculo -> fact_siniestros", """
        ALTER TABLE dim_vehiculo
        ADD CONSTRAINT fk_dim_veh_sin
        FOREIGN KEY (siniestro_id) REFERENCES fact_siniestros(siniestro_id)
    """),
    ("FK dim_actor -> fact_siniestros", """
        ALTER TABLE dim_actor
        ADD CONSTRAINT fk_dim_act_sin
        FOREIGN KEY (siniestro_id) REFERENCES fact_siniestros(siniestro_id)
    """),
]

VERIFY_SQL = """
    SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name  AS ref_table,
        ccu.column_name AS ref_column,
        tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name
"""


def run():
    conn = psycopg2.connect(ADMIN_URL)
    conn.autocommit = True
    cur = conn.cursor()

    print("\n--- Agregando FK constraints ---")
    for nombre, sql in STEPS:
        try:
            cur.execute(sql)
            print(f"  OK  {nombre}")
        except psycopg2.errors.DuplicateObject:
            print(f"  --  {nombre} (ya existe, omitiendo)")
        except Exception as e:
            print(f"  ERR {nombre}\n      {e}")
            conn.close()
            raise SystemExit(1)

    print("\n--- FK constraints activas ---")
    cur.execute(VERIFY_SQL)
    for row in cur.fetchall():
        print(f"  {row[0]}.{row[1]} -> {row[2]}.{row[3]}")

    conn.close()
    print("\nListo. Recarga el Schema Visualizer en Supabase.\n")


if __name__ == "__main__":
    run()
