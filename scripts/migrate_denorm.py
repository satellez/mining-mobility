"""
Migración: denormalizar dim_localidad, dim_gravedad, dim_clase, dim_hipotesis
y dim_vehiculo directamente dentro de fact_siniestros.

- dim_localidad  (codigo_localidad + nombre)       → campos inline en fact
- dim_gravedad   (descripcion + nivel)              → campos inline en fact
- dim_clase      (descripcion)                      → campo inline en fact
- dim_hipotesis  (descripcion, 1:N)                 → TEXT[] en fact
- dim_vehiculo   (clase, 1:N)                       → TEXT[] en fact

Tablas que se mantienen sin cambios:
- dim_fecha    (demasiados campos derivados para inline)
- dim_actor    (1:N con 3+ campos por actor: condicion, estado, sexo)
"""

import psycopg2

ADMIN_URL = (
    "postgresql://postgres.kxbjbjuzcagmpggdtgos:Minenuco0202*"
    "@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require"
)
RO_USER = "dashboard_ro"

STEPS = [
    # ── 1. Crear nueva fact con todos los campos inline + arrays ─────────────
    ("Crear fact_siniestros_new", """
        CREATE TABLE fact_siniestros_new AS
        SELECT
            f.siniestro_id,
            f.codigo_accidente,
            f.fecha_id,
            COALESCE(l.codigo_localidad, 0)        AS codigo_localidad,
            COALESCE(l.nombre,     'Desconocida')  AS localidad_nombre,
            COALESCE(g.descripcion,'Desconocida')  AS gravedad,
            COALESCE(g.nivel,      0)              AS gravedad_nivel,
            COALESCE(c.descripcion,'Desconocida')  AS clase,
            COALESCE(h.hip_arr, ARRAY[]::TEXT[])   AS hipotesis,
            COALESCE(v.veh_arr, ARRAY[]::TEXT[])   AS vehiculos_clase,
            f.hora,
            f.direccion,
            f.n_vehiculos,
            f.n_actores
        FROM fact_siniestros f
        LEFT JOIN dim_localidad l ON f.localidad_id = l.localidad_id
        LEFT JOIN dim_gravedad  g ON f.gravedad_id  = g.gravedad_id
        LEFT JOIN dim_clase     c ON f.clase_id     = c.clase_id
        LEFT JOIN (
            SELECT siniestro_id,
                   ARRAY_AGG(descripcion ORDER BY hipotesis_id) AS hip_arr
            FROM dim_hipotesis
            GROUP BY siniestro_id
        ) h ON f.siniestro_id = h.siniestro_id
        LEFT JOIN (
            SELECT siniestro_id,
                   ARRAY_AGG(clase ORDER BY vehiculo_id) AS veh_arr
            FROM dim_vehiculo
            GROUP BY siniestro_id
        ) v ON f.siniestro_id = v.siniestro_id
    """),

    # ── 2. PK + índices en la nueva tabla ────────────────────────────────────
    ("PK fact_siniestros_new",
        "ALTER TABLE fact_siniestros_new ADD PRIMARY KEY (siniestro_id)"),
    ("UNIQUE codigo_accidente",
        "ALTER TABLE fact_siniestros_new "
        "ADD CONSTRAINT uq_fact_new_codigo UNIQUE (codigo_accidente)"),
    ("Índice fecha_id",
        "CREATE INDEX idx_fact_new_fecha  ON fact_siniestros_new (fecha_id)"),
    ("Índice gravedad_nivel",
        "CREATE INDEX idx_fact_new_grav   ON fact_siniestros_new (gravedad_nivel)"),
    ("Índice codigo_localidad",
        "CREATE INDEX idx_fact_new_loc    ON fact_siniestros_new (codigo_localidad)"),
    ("Índice clase",
        "CREATE INDEX idx_fact_new_clase  ON fact_siniestros_new (clase)"),

    # ── 3. Eliminar FK de dim_actor hacia la fact vieja ──────────────────────
    #   (CASCADE en el DROP lo haría igual, pero siendo explícitos)
    ("Drop FK dim_actor → fact (si existe)",
        "ALTER TABLE dim_actor "
        "DROP CONSTRAINT IF EXISTS fk_dim_act_sin"),

    # ── 4. Reemplazar fact_siniestros ────────────────────────────────────────
    ("Drop fact_siniestros CASCADE",
        "DROP TABLE fact_siniestros CASCADE"),
    ("Renombrar fact_siniestros_new → fact_siniestros",
        "ALTER TABLE fact_siniestros_new RENAME TO fact_siniestros"),

    # ── 5. Re-establecer FK desde fact hacia dim_fecha ───────────────────────
    ("FK fact_siniestros → dim_fecha",
        "ALTER TABLE fact_siniestros "
        "ADD CONSTRAINT fk_fact_fecha "
        "FOREIGN KEY (fecha_id) REFERENCES dim_fecha(fecha_id)"),

    # ── 6. Re-establecer FK desde dim_actor hacia la nueva fact ──────────────
    ("FK dim_actor → fact_siniestros (nueva)",
        "ALTER TABLE dim_actor "
        "ADD CONSTRAINT fk_dim_act_sin "
        "FOREIGN KEY (siniestro_id) REFERENCES fact_siniestros(siniestro_id)"),

    # ── 7. Eliminar las 5 dimensiones que ya viven inline ────────────────────
    ("Drop dim_localidad",  "DROP TABLE IF EXISTS dim_localidad  CASCADE"),
    ("Drop dim_gravedad",   "DROP TABLE IF EXISTS dim_gravedad   CASCADE"),
    ("Drop dim_clase",      "DROP TABLE IF EXISTS dim_clase      CASCADE"),
    ("Drop dim_hipotesis",  "DROP TABLE IF EXISTS dim_hipotesis  CASCADE"),
    ("Drop dim_vehiculo",   "DROP TABLE IF EXISTS dim_vehiculo   CASCADE"),

    # ── 8. Permisos para usuario de solo lectura ──────────────────────────────
    (f"Grant fact_siniestros → {RO_USER}",
        f"GRANT SELECT ON fact_siniestros TO {RO_USER}"),
]

VERIFY = {
    "fact_siniestros (total)":
        "SELECT COUNT(*) FROM fact_siniestros",
    "fact_siniestros (gravedad nivel 1 — Con Muertos)":
        "SELECT COUNT(*) FROM fact_siniestros WHERE gravedad_nivel = 1",
    "fact_siniestros (con hipótesis)":
        "SELECT COUNT(*) FROM fact_siniestros WHERE array_length(hipotesis, 1) > 0",
    "dim_actor (sin cambios)":
        "SELECT COUNT(*) FROM dim_actor",
    "dim_fecha  (sin cambios)":
        "SELECT COUNT(*) FROM dim_fecha",
}

SAMPLE_SQL = """
    SELECT siniestro_id, gravedad, gravedad_nivel, clase,
           localidad_nombre, hipotesis, vehiculos_clase
    FROM fact_siniestros
    LIMIT 3
"""


def run():
    conn = psycopg2.connect(ADMIN_URL)
    conn.autocommit = True
    cur = conn.cursor()

    # Conteos actuales antes de migrar
    print("\n─── Estado previo ────────────────────────────────────────────────")
    for tabla in ("fact_siniestros", "dim_localidad", "dim_gravedad",
                  "dim_clase", "dim_hipotesis", "dim_vehiculo", "dim_actor"):
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

    print("\n─── Verificación post-migración ──────────────────────────────────")
    for label, sql in VERIFY.items():
        cur.execute(sql)
        print(f"  {label}: {cur.fetchone()[0]:,}")

    print("\n─── Muestra de 3 registros ───────────────────────────────────────")
    cur.execute(SAMPLE_SQL)
    for row in cur.fetchall():
        print(f"  id={row[0]} | {row[1]} (nivel {row[2]}) | {row[3]}"
              f" | {row[4]} | hip={row[5]} | veh={row[6]}")

    conn.close()
    print("\n✓ Migración completada — esquema denormalizado activo en Supabase.\n")


if __name__ == "__main__":
    run()
