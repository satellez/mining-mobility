"""
Carga el modelo estrella en Supabase a partir de los JSON del dataset de
Siniestros Viales Consolidados — Bogotá D.C.
"""
import json, os, sys
from datetime import datetime
import psycopg2
from psycopg2.extras import execute_batch

CONN_STR = (
    "postgresql://postgres.kxbjbjuzcagmpggdtgos:Minenuco0202*"
    "@aws-1-us-west-2.pooler.supabase.com:6543/postgres"
    "?sslmode=require"
)

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

LOC_NOMBRES = {
    1:'Usaquén', 2:'Chapinero', 3:'Santa Fe', 4:'San Cristóbal',
    5:'Usme', 6:'Tunjuelito', 7:'Bosa', 8:'Kennedy', 9:'Fontibón',
    10:'Engativá', 11:'Suba', 12:'Barrios Unidos', 13:'Teusaquillo',
    14:'Los Mártires', 15:'Antonio Nariño', 16:'Puente Aranda',
    17:'La Candelaria', 18:'Rafael Uribe Uribe', 19:'Ciudad Bolívar',
    20:'Sumapaz',
}
MESES = {1:'Enero',2:'Febrero',3:'Marzo',4:'Abril',5:'Mayo',6:'Junio',
         7:'Julio',8:'Agosto',9:'Septiembre',10:'Octubre',11:'Noviembre',12:'Diciembre'}
DIAS  = {0:'Lunes',1:'Martes',2:'Miércoles',3:'Jueves',
         4:'Viernes',5:'Sábado',6:'Domingo'}

def load_json(name):
    path = os.path.join(DATA_DIR, name)
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def ins(cur, sql, rows, page=500):
    for i in range(0, len(rows), page):
        execute_batch(cur, sql, rows[i:i+page], page_size=page)

# ─── DDL ────────────────────────────────────────────────────────────────────────
DDL = """
DROP TABLE IF EXISTS bridge_siniestro_actor     CASCADE;
DROP TABLE IF EXISTS bridge_siniestro_vehiculo  CASCADE;
DROP TABLE IF EXISTS bridge_siniestro_hipotesis CASCADE;
DROP TABLE IF EXISTS fact_siniestros            CASCADE;
DROP TABLE IF EXISTS dim_fecha                  CASCADE;
DROP TABLE IF EXISTS dim_localidad              CASCADE;
DROP TABLE IF EXISTS dim_gravedad               CASCADE;
DROP TABLE IF EXISTS dim_clase                  CASCADE;
DROP TABLE IF EXISTS dim_hipotesis              CASCADE;
DROP TABLE IF EXISTS dim_vehiculo_clase         CASCADE;
DROP TABLE IF EXISTS dim_condicion_actor        CASCADE;
DROP TABLE IF EXISTS agg_tendencia_mensual      CASCADE;
DROP TABLE IF EXISTS agg_localidades_gravedad   CASCADE;

CREATE TABLE dim_fecha (
    fecha_id    SERIAL PRIMARY KEY,
    fecha       DATE    NOT NULL UNIQUE,
    anio        INT     NOT NULL,
    mes         INT     NOT NULL,
    dia         INT     NOT NULL,
    trimestre   INT     NOT NULL,
    nombre_mes  VARCHAR(20),
    dia_semana  VARCHAR(20)
);

CREATE TABLE dim_localidad (
    localidad_id     SERIAL PRIMARY KEY,
    codigo_localidad INT         NOT NULL UNIQUE,
    nombre           VARCHAR(100)
);

CREATE TABLE dim_gravedad (
    gravedad_id SERIAL PRIMARY KEY,
    descripcion VARCHAR(50) NOT NULL UNIQUE,
    nivel       INT         NOT NULL
);

CREATE TABLE dim_clase (
    clase_id    SERIAL PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE dim_hipotesis (
    hipotesis_id SERIAL PRIMARY KEY,
    descripcion  TEXT NOT NULL UNIQUE
);

CREATE TABLE dim_vehiculo_clase (
    vehiculo_clase_id SERIAL PRIMARY KEY,
    descripcion       VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE dim_condicion_actor (
    condicion_id SERIAL PRIMARY KEY,
    descripcion  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE fact_siniestros (
    siniestro_id     SERIAL  PRIMARY KEY,
    codigo_accidente INT     NOT NULL UNIQUE,
    fecha_id         INT     REFERENCES dim_fecha(fecha_id),
    localidad_id     INT     REFERENCES dim_localidad(localidad_id),
    gravedad_id      INT     REFERENCES dim_gravedad(gravedad_id),
    clase_id         INT     REFERENCES dim_clase(clase_id),
    hora             INT,
    direccion        TEXT,
    n_vehiculos      INT     DEFAULT 0,
    n_actores        INT     DEFAULT 0
);

CREATE TABLE bridge_siniestro_hipotesis (
    siniestro_id INT REFERENCES fact_siniestros(siniestro_id),
    hipotesis_id INT REFERENCES dim_hipotesis(hipotesis_id),
    PRIMARY KEY (siniestro_id, hipotesis_id)
);

CREATE TABLE bridge_siniestro_vehiculo (
    id                SERIAL PRIMARY KEY,
    siniestro_id      INT REFERENCES fact_siniestros(siniestro_id),
    vehiculo_clase_id INT REFERENCES dim_vehiculo_clase(vehiculo_clase_id),
    servicio          VARCHAR(50)
);

CREATE TABLE bridge_siniestro_actor (
    id           SERIAL PRIMARY KEY,
    siniestro_id INT REFERENCES fact_siniestros(siniestro_id),
    condicion_id INT REFERENCES dim_condicion_actor(condicion_id),
    estado       VARCHAR(50),
    sexo         VARCHAR(20)
);

CREATE TABLE agg_tendencia_mensual (
    id               SERIAL PRIMARY KEY,
    anio             INT NOT NULL,
    mes              INT NOT NULL,
    total_accidentes INT NOT NULL,
    UNIQUE(anio, mes)
);

CREATE TABLE agg_localidades_gravedad (
    id               SERIAL PRIMARY KEY,
    codigo_localidad INT         NOT NULL,
    gravedad         VARCHAR(50) NOT NULL,
    total            INT         NOT NULL,
    UNIQUE(codigo_localidad, gravedad)
);
"""

def main():
    print("Cargando JSONs...")
    siniestros = load_json('siniestros_detalle_completo.json')
    tendencia  = load_json('dashboard_tendencia_mensual.json')
    loc_grav   = load_json('dashboard_localidades_gravedad.json')
    print(f"  {len(siniestros):,} siniestros | {len(tendencia)} meses | {len(loc_grav)} filas localidades")

    print("Conectando a Supabase...")
    conn = psycopg2.connect(CONN_STR)
    cur  = conn.cursor()

    # ── Crear esquema ──────────────────────────────────────────────────────────
    print("Creando tablas (modelo estrella)...")
    cur.execute(DDL)
    conn.commit()
    print("  OK — tablas creadas")

    # ── Dimensiones ────────────────────────────────────────────────────────────
    print("Cargando dimensiones...")

    # dim_gravedad (fija)
    ins(cur, "INSERT INTO dim_gravedad(descripcion,nivel) VALUES(%s,%s) ON CONFLICT DO NOTHING",
        [('Con Muertos',1),('Con Heridos',2),('Solo Daños',3)])

    # dim_localidad
    locs = {r['CODIGO_LOCALIDAD'] for r in siniestros if r.get('CODIGO_LOCALIDAD')}
    ins(cur, "INSERT INTO dim_localidad(codigo_localidad,nombre) VALUES(%s,%s) ON CONFLICT DO NOTHING",
        [(c, LOC_NOMBRES.get(c, f'Localidad {c}')) for c in locs])

    # dim_clase
    clases = {r['CLASE'] for r in siniestros if r.get('CLASE')}
    ins(cur, "INSERT INTO dim_clase(descripcion) VALUES(%s) ON CONFLICT DO NOTHING",
        [(c,) for c in clases])

    # dim_hipotesis
    hips = {h for r in siniestros for h in (r.get('HIPOTESIS_LISTA') or []) if h}
    ins(cur, "INSERT INTO dim_hipotesis(descripcion) VALUES(%s) ON CONFLICT DO NOTHING",
        [(h,) for h in hips])

    # dim_vehiculo_clase
    vehs = {v['CLASE'] for r in siniestros
            for v in (r.get('VEHICULOS_INVOLUCRADOS') or []) if v.get('CLASE')}
    ins(cur, "INSERT INTO dim_vehiculo_clase(descripcion) VALUES(%s) ON CONFLICT DO NOTHING",
        [(v,) for v in vehs])

    # dim_condicion_actor
    conds = {a['CONDICION'] for r in siniestros
             for a in (r.get('ACTORES_INVOLUCRADOS') or []) if a.get('CONDICION')}
    ins(cur, "INSERT INTO dim_condicion_actor(descripcion) VALUES(%s) ON CONFLICT DO NOTHING",
        [(c,) for c in conds])

    # dim_fecha
    unique_dates = {r['FECHA_STR'] for r in siniestros if r.get('FECHA_STR')}
    fecha_rows = []
    for d in unique_dates:
        try:
            dt = datetime.strptime(d, '%Y-%m-%d')
            fecha_rows.append((d, dt.year, dt.month, dt.day,
                               (dt.month-1)//3+1, MESES[dt.month], DIAS[dt.weekday()]))
        except ValueError:
            pass
    ins(cur,
        "INSERT INTO dim_fecha(fecha,anio,mes,dia,trimestre,nombre_mes,dia_semana) "
        "VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
        fecha_rows)

    conn.commit()
    print(f"  {len(locs)} localidades | {len(clases)} clases | {len(hips)} hipótesis | "
          f"{len(vehs)} tipos vehículo | {len(conds)} condiciones | {len(fecha_rows)} fechas")

    # ── Lookup maps ────────────────────────────────────────────────────────────
    cur.execute("SELECT fecha::text, fecha_id    FROM dim_fecha");        fecha_map = {r[0]:r[1] for r in cur.fetchall()}
    cur.execute("SELECT codigo_localidad, localidad_id FROM dim_localidad"); loc_map  = {r[0]:r[1] for r in cur.fetchall()}
    cur.execute("SELECT descripcion, gravedad_id FROM dim_gravedad");        grav_map = {r[0]:r[1] for r in cur.fetchall()}
    cur.execute("SELECT descripcion, clase_id    FROM dim_clase");           cls_map  = {r[0]:r[1] for r in cur.fetchall()}
    cur.execute("SELECT descripcion, hipotesis_id FROM dim_hipotesis");      hip_map  = {r[0]:r[1] for r in cur.fetchall()}
    cur.execute("SELECT descripcion, vehiculo_clase_id FROM dim_vehiculo_clase"); veh_map = {r[0]:r[1] for r in cur.fetchall()}
    cur.execute("SELECT descripcion, condicion_id FROM dim_condicion_actor"); cond_map = {r[0]:r[1] for r in cur.fetchall()}

    # ── fact_siniestros ────────────────────────────────────────────────────────
    print("Insertando fact_siniestros...")
    fact_rows = []
    for r in siniestros:
        hora = None
        hs = str(r.get('HORA',''))[:2]
        if hs.isdigit(): hora = int(hs)
        fact_rows.append((
            r['CODIGO_ACCIDENTE'],
            fecha_map.get(r.get('FECHA_STR','')),
            loc_map.get(r.get('CODIGO_LOCALIDAD')),
            grav_map.get(r.get('GRAVEDAD')),
            cls_map.get(r.get('CLASE')),
            hora,
            r.get('DIRECCION'),
            len(r.get('VEHICULOS_INVOLUCRADOS') or []),
            len(r.get('ACTORES_INVOLUCRADOS') or []),
        ))
    ins(cur,
        "INSERT INTO fact_siniestros"
        "(codigo_accidente,fecha_id,localidad_id,gravedad_id,clase_id,hora,direccion,n_vehiculos,n_actores) "
        "VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",
        fact_rows)
    conn.commit()
    print(f"  {len(fact_rows):,} filas insertadas")

    # ── sin_map ────────────────────────────────────────────────────────────────
    cur.execute("SELECT codigo_accidente, siniestro_id FROM fact_siniestros")
    sin_map = {r[0]:r[1] for r in cur.fetchall()}

    # ── bridge_siniestro_hipotesis ─────────────────────────────────────────────
    print("Insertando bridge hipótesis...")
    bh = [(sin_map[r['CODIGO_ACCIDENTE']], hip_map[h])
          for r in siniestros
          for h in (r.get('HIPOTESIS_LISTA') or [])
          if h and r['CODIGO_ACCIDENTE'] in sin_map and h in hip_map]
    ins(cur,
        "INSERT INTO bridge_siniestro_hipotesis(siniestro_id,hipotesis_id) "
        "VALUES(%s,%s) ON CONFLICT DO NOTHING", bh)
    conn.commit()
    print(f"  {len(bh):,} filas")

    # ── bridge_siniestro_vehiculo ──────────────────────────────────────────────
    print("Insertando bridge vehículos...")
    bv = [(sin_map[r['CODIGO_ACCIDENTE']], veh_map[v['CLASE']], v.get('SERVICIO'))
          for r in siniestros
          for v in (r.get('VEHICULOS_INVOLUCRADOS') or [])
          if v.get('CLASE') and r['CODIGO_ACCIDENTE'] in sin_map and v['CLASE'] in veh_map]
    ins(cur,
        "INSERT INTO bridge_siniestro_vehiculo(siniestro_id,vehiculo_clase_id,servicio) "
        "VALUES(%s,%s,%s)", bv)
    conn.commit()
    print(f"  {len(bv):,} filas")

    # ── bridge_siniestro_actor ─────────────────────────────────────────────────
    print("Insertando bridge actores...")
    ba = [(sin_map[r['CODIGO_ACCIDENTE']], cond_map[a['CONDICION']], a.get('ESTADO'), a.get('SEXO'))
          for r in siniestros
          for a in (r.get('ACTORES_INVOLUCRADOS') or [])
          if a.get('CONDICION') and r['CODIGO_ACCIDENTE'] in sin_map and a['CONDICION'] in cond_map]
    ins(cur,
        "INSERT INTO bridge_siniestro_actor(siniestro_id,condicion_id,estado,sexo) "
        "VALUES(%s,%s,%s,%s)", ba)
    conn.commit()
    print(f"  {len(ba):,} filas")

    # ── Tablas agg suplementarias ──────────────────────────────────────────────
    print("Insertando tablas agregadas suplementarias...")
    ins(cur,
        "INSERT INTO agg_tendencia_mensual(anio,mes,total_accidentes) "
        "VALUES(%s,%s,%s) ON CONFLICT DO NOTHING",
        [(r['AÑO'], r['MES'], r['TOTAL_ACCIDENTES']) for r in tendencia])
    ins(cur,
        "INSERT INTO agg_localidades_gravedad(codigo_localidad,gravedad,total) "
        "VALUES(%s,%s,%s) ON CONFLICT DO NOTHING",
        [(r['CODIGO_LOCALIDAD'], r['GRAVEDAD'], r['TOTAL']) for r in loc_grav])
    conn.commit()

    cur.close()
    conn.close()
    print("\n✓ Carga completada. Modelo estrella disponible en Supabase.")

if __name__ == '__main__':
    main()
