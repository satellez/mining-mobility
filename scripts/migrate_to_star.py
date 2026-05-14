"""
Migración: eliminar tablas bridge y convertirlas en dimensiones directas.

Cambios:
  bridge_siniestro_hipotesis + dim_hipotesis     → dim_hipotesis   (nueva)
  bridge_siniestro_vehiculo  + dim_vehiculo_clase → dim_vehiculo    (nueva)
  bridge_siniestro_actor     + dim_condicion_actor → dim_actor      (nueva)
"""

import psycopg2

ADMIN_URL = (
    "postgresql://postgres.kxbjbjuzcagmpggdtgos:Minenuco0202*"
    "@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require"
)
RO_USER = "dashboard_ro"

STEPS = [
    # ── 1. Crear nuevas tablas fusionadas ────────────────────────────────────
    ("Crear dim_hipotesis_new", """
        CREATE TABLE dim_hipotesis_new AS
        SELECT
            ROW_NUMBER() OVER () AS hipotesis_id,
            bh.siniestro_id,
            h.descripcion
        FROM bridge_siniestro_hipotesis bh
        JOIN dim_hipotesis h ON bh.hipotesis_id = h.hipotesis_id
    """),
    ("Crear dim_vehiculo_new", """
        CREATE TABLE dim_vehiculo_new AS
        SELECT
            ROW_NUMBER() OVER () AS vehiculo_id,
            bv.siniestro_id,
            v.descripcion AS clase
        FROM bridge_siniestro_vehiculo bv
        JOIN dim_vehiculo_clase v ON bv.vehiculo_clase_id = v.vehiculo_clase_id
    """),
    ("Crear dim_actor_new", """
        CREATE TABLE dim_actor_new AS
        SELECT
            ROW_NUMBER() OVER () AS actor_id,
            ba.siniestro_id,
            ca.descripcion AS condicion,
            ba.estado,
            ba.sexo
        FROM bridge_siniestro_actor ba
        JOIN dim_condicion_actor ca ON ba.condicion_id = ca.condicion_id
    """),

    # ── 2. PKs e índices ─────────────────────────────────────────────────────
    ("PK dim_hipotesis_new",
        "ALTER TABLE dim_hipotesis_new ADD PRIMARY KEY (hipotesis_id)"),
    ("PK dim_vehiculo_new",
        "ALTER TABLE dim_vehiculo_new ADD PRIMARY KEY (vehiculo_id)"),
    ("PK dim_actor_new",
        "ALTER TABLE dim_actor_new ADD PRIMARY KEY (actor_id)"),

    ("Índice dim_hipotesis_new.siniestro_id",
        "CREATE INDEX idx_dim_hip_sin ON dim_hipotesis_new (siniestro_id)"),
    ("Índice dim_vehiculo_new.siniestro_id",
        "CREATE INDEX idx_dim_veh_sin ON dim_vehiculo_new (siniestro_id)"),
    ("Índice dim_actor_new.siniestro_id",
        "CREATE INDEX idx_dim_act_sin ON dim_actor_new (siniestro_id)"),
    ("Índice dim_actor_new.condicion",
        "CREATE INDEX idx_dim_act_cond ON dim_actor_new (condicion)"),
    ("Índice dim_actor_new.estado",
        "CREATE INDEX idx_dim_act_est ON dim_actor_new (estado)"),

    # ── 3. Eliminar tablas antiguas ──────────────────────────────────────────
    ("Drop bridge_siniestro_hipotesis",
        "DROP TABLE bridge_siniestro_hipotesis"),
    ("Drop bridge_siniestro_vehiculo",
        "DROP TABLE bridge_siniestro_vehiculo"),
    ("Drop bridge_siniestro_actor",
        "DROP TABLE bridge_siniestro_actor"),
    ("Drop dim_hipotesis (vieja)",
        "DROP TABLE dim_hipotesis"),
    ("Drop dim_vehiculo_clase",
        "DROP TABLE dim_vehiculo_clase"),
    ("Drop dim_condicion_actor",
        "DROP TABLE dim_condicion_actor"),

    # ── 4. Renombrar nuevas tablas ───────────────────────────────────────────
    ("Renombrar → dim_hipotesis",
        "ALTER TABLE dim_hipotesis_new RENAME TO dim_hipotesis"),
    ("Renombrar → dim_vehiculo",
        "ALTER TABLE dim_vehiculo_new RENAME TO dim_vehiculo"),
    ("Renombrar → dim_actor",
        "ALTER TABLE dim_actor_new RENAME TO dim_actor"),

    # ── 5. Permisos para usuario de solo lectura ─────────────────────────────
    (f"Grant dim_hipotesis → {RO_USER}",
        f"GRANT SELECT ON dim_hipotesis TO {RO_USER}"),
    (f"Grant dim_vehiculo → {RO_USER}",
        f"GRANT SELECT ON dim_vehiculo TO {RO_USER}"),
    (f"Grant dim_actor → {RO_USER}",
        f"GRANT SELECT ON dim_actor TO {RO_USER}"),
]

VERIFY = {
    "dim_hipotesis": "SELECT COUNT(*) FROM dim_hipotesis",
    "dim_vehiculo":  "SELECT COUNT(*) FROM dim_vehiculo",
    "dim_actor":     "SELECT COUNT(*) FROM dim_actor",
}


def run():
    conn = psycopg2.connect(ADMIN_URL)
    conn.autocommit = True
    cur = conn.cursor()

    print("\n─── Verificando conteos originales ───────────────────────────────")
    for tabla in ("bridge_siniestro_hipotesis", "bridge_siniestro_vehiculo",
                  "bridge_siniestro_actor"):
        cur.execute(f"SELECT COUNT(*) FROM {tabla}")
        print(f"  {tabla}: {cur.fetchone()[0]:,}")

    print("\n─── Ejecutando migración ─────────────────────────────────────────")
    for nombre, sql in STEPS:
        try:
            cur.execute(sql)
            print(f"  ✓ {nombre}")
        except Exception as e:
            print(f"  ✗ {nombre}\n    {e}")
            conn.close()
            raise SystemExit(1)

    print("\n─── Verificando tablas nuevas ────────────────────────────────────")
    for tabla, sql in VERIFY.items():
        cur.execute(sql)
        print(f"  {tabla}: {cur.fetchone()[0]:,} filas")

    conn.close()
    print("\n✓ Migración completada.\n")


if __name__ == "__main__":
    run()
