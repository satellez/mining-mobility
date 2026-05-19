"""
Migración: extraer dim_localidad de fact_siniestros.

- Crea dim_localidad con 3 campos: codigo_localidad, nombre, zona
- Agrega localidad_id FK en fact_siniestros
- Elimina los campos inline codigo_localidad y localidad_nombre
"""

import psycopg2

ADMIN_URL = (
    "postgresql://postgres.kxbjbjuzcagmpggdtgos:Minenuco0202*"
    "@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require"
)
RO_USER = "dashboard_ro"

ZONA = {
    1:  'Norte',      2:  'Norte',      3:  'Centro',     4:  'Sur',
    5:  'Sur',        6:  'Sur',        7:  'Occidente',  8:  'Occidente',
    9:  'Occidente',  10: 'Occidente',  11: 'Norte',      12: 'Norte',
    13: 'Norte',      14: 'Centro',     15: 'Centro',     16: 'Centro',
    17: 'Centro',     18: 'Sur',        19: 'Sur',        20: 'Sur',
}


def run():
    conn = psycopg2.connect(ADMIN_URL)
    conn.autocommit = True
    cur = conn.cursor()

    print("\n--- Localidades actuales en fact_siniestros ---")
    cur.execute(
        "SELECT DISTINCT codigo_localidad, localidad_nombre "
        "FROM fact_siniestros ORDER BY codigo_localidad"
    )
    localidades = cur.fetchall()
    for cod, nom in localidades:
        print(f"  {cod:>2} | {nom}")

    print("\n--- Creando dim_localidad ---")
    cur.execute("DROP TABLE IF EXISTS dim_localidad CASCADE")
    cur.execute("""
        CREATE TABLE dim_localidad (
            localidad_id    SERIAL PRIMARY KEY,
            codigo_localidad INT  NOT NULL UNIQUE,
            nombre          TEXT NOT NULL,
            zona            TEXT NOT NULL
        )
    """)
    for cod, nom in localidades:
        zona = ZONA.get(cod, 'Desconocida')
        cur.execute(
            "INSERT INTO dim_localidad (codigo_localidad, nombre, zona) VALUES (%s, %s, %s)",
            (cod, nom, zona)
        )
    print(f"  Insertadas {len(localidades)} localidades")

    print("\n--- Migrando fact_siniestros ---")
    cur.execute("ALTER TABLE fact_siniestros ADD COLUMN localidad_id INT")
    cur.execute("""
        UPDATE fact_siniestros f
        SET localidad_id = l.localidad_id
        FROM dim_localidad l
        WHERE f.codigo_localidad = l.codigo_localidad
    """)
    cur.execute("ALTER TABLE fact_siniestros ALTER COLUMN localidad_id SET NOT NULL")
    cur.execute("ALTER TABLE fact_siniestros DROP COLUMN codigo_localidad")
    cur.execute("ALTER TABLE fact_siniestros DROP COLUMN localidad_nombre")
    cur.execute("""
        ALTER TABLE fact_siniestros
        ADD CONSTRAINT fk_fact_localidad
        FOREIGN KEY (localidad_id) REFERENCES dim_localidad(localidad_id)
    """)
    cur.execute("CREATE INDEX idx_fact_localidad ON fact_siniestros(localidad_id)")
    print("  localidad_id FK creado, campos inline eliminados")

    print("\n--- Permisos ---")
    cur.execute(f"GRANT SELECT ON dim_localidad TO {RO_USER}")
    print(f"  GRANT SELECT a {RO_USER}")

    print("\n--- Verificacion ---")
    cur.execute("SELECT COUNT(*) FROM dim_localidad")
    print(f"  dim_localidad: {cur.fetchone()[0]} filas")
    cur.execute("SELECT COUNT(*) FROM fact_siniestros WHERE localidad_id IS NOT NULL")
    print(f"  fact_siniestros con localidad_id: {cur.fetchone()[0]:,}")
    cur.execute("""
        SELECT l.zona, COUNT(*) AS total
        FROM fact_siniestros s
        JOIN dim_localidad l ON s.localidad_id = l.localidad_id
        GROUP BY l.zona ORDER BY total DESC
    """)
    print("  Siniestros por zona:")
    for zona, total in cur.fetchall():
        print(f"    {zona}: {total:,}")

    conn.close()
    print("\nMigracion completada.\n")


if __name__ == "__main__":
    run()
