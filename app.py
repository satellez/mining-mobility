import json, os, time
from flask import Flask, render_template, redirect
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()

app = Flask(__name__)

@app.template_filter('format_miles')
def format_miles(n):
    return f'{int(n):,}'.replace(',', '.')

DATA_DIR  = os.path.join(os.path.dirname(__file__), 'data')
DB_URL    = os.environ.get('DB_URL')
CACHE_TTL = 600  # 10 minutos

_cache: dict = {}


def _load(filename):
    with open(os.path.join(DATA_DIR, filename), 'r', encoding='utf-8') as f:
        return json.load(f)


def db_query_batch(query_map: dict) -> dict:
    """Una sola conexión para todas las queries. Cierra al terminar."""
    conn = psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)
    try:
        results = {}
        with conn.cursor() as cur:
            for name, sql in query_map.items():
                cur.execute(sql)
                results[name] = [dict(r) for r in cur.fetchall()]
        return results
    finally:
        conn.close()


def _cached(key: str, fetch_fn):
    now = time.time()
    if key in _cache and now - _cache[key]['ts'] < CACHE_TTL:
        return _cache[key]['data']
    data = fetch_fn()
    _cache[key] = {'data': data, 'ts': now}
    return data


# ── Vistas ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/dashboard')
def dashboard():
    return render_template(
        'dashboard.html',
        agg         = _load('dashboard_agregaciones.json'),
        localidades = _load('dashboard_localidades_gravedad.json'),
        tendencia   = _load('dashboard_tendencia_mensual.json'),
    )


# Redirecciones de rutas anteriores
@app.route('/modelo')
@app.route('/analisis')
@app.route('/victimas')
def legado():
    return redirect('/modelado')


@app.route('/modelado')
def modelado():
    def fetch():
        return db_query_batch({
            '_conteos': """
                SELECT 'fact_siniestros'         AS tabla, COUNT(*) AS filas FROM fact_siniestros
                UNION ALL SELECT 'dim_fecha',                        COUNT(*) FROM dim_fecha
                UNION ALL SELECT 'dim_localidad',                    COUNT(*) FROM dim_localidad
                UNION ALL SELECT 'dim_gravedad',                     COUNT(*) FROM dim_gravedad
                UNION ALL SELECT 'dim_clase',                        COUNT(*) FROM dim_clase
                UNION ALL SELECT 'dim_hipotesis',                    COUNT(*) FROM dim_hipotesis
                UNION ALL SELECT 'dim_vehiculo_clase',               COUNT(*) FROM dim_vehiculo_clase
                UNION ALL SELECT 'dim_condicion_actor',              COUNT(*) FROM dim_condicion_actor
                UNION ALL SELECT 'bridge_siniestro_hipotesis',       COUNT(*) FROM bridge_siniestro_hipotesis
                UNION ALL SELECT 'bridge_siniestro_vehiculo',        COUNT(*) FROM bridge_siniestro_vehiculo
                UNION ALL SELECT 'bridge_siniestro_actor',           COUNT(*) FROM bridge_siniestro_actor
            """,
            'gravedad': """
                SELECT g.descripcion, COUNT(*) AS total
                FROM fact_siniestros s
                JOIN dim_gravedad g ON s.gravedad_id = g.gravedad_id
                GROUP BY g.descripcion, g.nivel ORDER BY g.nivel
            """,
            'tendencia': """
                SELECT f.anio, f.mes, COUNT(*) AS total
                FROM fact_siniestros s
                JOIN dim_fecha f ON s.fecha_id = f.fecha_id
                GROUP BY f.anio, f.mes ORDER BY f.anio, f.mes
            """,
            'por_hora': """
                SELECT hora, COUNT(*) AS total
                FROM fact_siniestros WHERE hora IS NOT NULL
                GROUP BY hora ORDER BY hora
            """,
            'hipotesis': """
                SELECT h.descripcion, COUNT(*) AS total
                FROM bridge_siniestro_hipotesis bh
                JOIN dim_hipotesis h ON bh.hipotesis_id = h.hipotesis_id
                GROUP BY h.descripcion ORDER BY total DESC LIMIT 10
            """,
            'evolucion_gravedad': """
                SELECT f.anio, g.descripcion, COUNT(*) AS total
                FROM fact_siniestros s
                JOIN dim_fecha   f ON s.fecha_id   = f.fecha_id
                JOIN dim_gravedad g ON s.gravedad_id = g.gravedad_id
                GROUP BY f.anio, g.descripcion, g.nivel ORDER BY f.anio, g.nivel
            """,
            'actores_estado': """
                SELECT ca.descripcion AS condicion, ba.estado, COUNT(*) AS total
                FROM bridge_siniestro_actor ba
                JOIN dim_condicion_actor ca ON ba.condicion_id = ca.condicion_id
                GROUP BY ca.descripcion, ba.estado ORDER BY ca.descripcion, ba.estado
            """,
            'hora_fatal': """
                SELECT s.hora,
                       SUM(CASE WHEN g.nivel = 1 THEN 1 ELSE 0 END) AS muertos,
                       COUNT(*) AS total
                FROM fact_siniestros s
                JOIN dim_gravedad g ON s.gravedad_id = g.gravedad_id
                WHERE s.hora IS NOT NULL
                GROUP BY s.hora ORDER BY s.hora
            """,
            'causas_fatales': """
                SELECT h.descripcion, COUNT(*) AS total
                FROM bridge_siniestro_hipotesis bh
                JOIN dim_hipotesis h    ON bh.hipotesis_id = h.hipotesis_id
                JOIN fact_siniestros s  ON bh.siniestro_id = s.siniestro_id
                JOIN dim_gravedad g     ON s.gravedad_id   = g.gravedad_id
                WHERE g.nivel = 1
                GROUP BY h.descripcion ORDER BY total DESC LIMIT 10
            """,
            'tabla_localidades': """
                SELECT l.nombre,
                       COUNT(*) AS total,
                       SUM(CASE WHEN g.nivel = 1 THEN 1 ELSE 0 END) AS con_muertos,
                       SUM(CASE WHEN g.nivel = 2 THEN 1 ELSE 0 END) AS con_heridos,
                       SUM(CASE WHEN g.nivel = 3 THEN 1 ELSE 0 END) AS solo_danos,
                       ROUND(SUM(CASE WHEN g.nivel = 1 THEN 1 ELSE 0 END) * 1000.0 / COUNT(*), 1) AS tasa_mortalidad
                FROM fact_siniestros s
                JOIN dim_localidad l ON s.localidad_id = l.localidad_id
                JOIN dim_gravedad  g ON s.gravedad_id  = g.gravedad_id
                GROUP BY l.nombre ORDER BY con_muertos DESC
            """,
        })

    data = _cached('modelado', fetch)
    return render_template('modelado.html',
        conteos          = {r['tabla']: r['filas'] for r in data['_conteos']},
        gravedad         = data['gravedad'],
        tendencia        = data['tendencia'],
        por_hora         = data['por_hora'],
        hipotesis        = data['hipotesis'],
        evolucion        = data['evolucion_gravedad'],
        actores_estado   = data['actores_estado'],
        hora_fatal       = data['hora_fatal'],
        causas_fatales   = data['causas_fatales'],
        tabla_localidades= data['tabla_localidades'],
    )


if __name__ == '__main__':
    app.run(debug=True)
