import json, os, re, time
from flask import Flask, render_template, redirect
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from queries import MODELADO_QUERIES

load_dotenv()

app = Flask(__name__)

@app.template_filter('format_miles')
def format_miles(n):
    return f'{int(n):,}'.replace(',', '.')

DATA_DIR  = os.path.join(os.path.dirname(__file__), 'data')
DB_URL    = os.environ.get('DB_URL')
CACHE_TTL = 600

_cache: dict = {}


def _load(filename):
    with open(os.path.join(DATA_DIR, filename), 'r', encoding='utf-8') as f:
        return json.load(f)


def db_query_batch(query_map: dict) -> dict:
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


@app.route('/modelo')
@app.route('/analisis')
@app.route('/victimas')
def legado():
    return redirect('/modelado')


@app.route('/mining')
def legado_mining():
    return redirect('/mineria')


@app.route('/modelado')
def modelado():
    def fetch():
        return db_query_batch(MODELADO_QUERIES)
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


@app.route('/spark')
def spark_view():
    stats_path = os.path.join(DATA_DIR, 'spark_stats.json')
    ml_path    = os.path.join(DATA_DIR, 'spark_ml.json')
    stats = _load('spark_stats.json') if os.path.exists(stats_path) else None
    ml    = _load('spark_ml.json')    if os.path.exists(ml_path)    else None
    return render_template('spark.html', stats=stats, ml=ml)


@app.route('/mineria')
def mineria():
    img_dir = os.path.join(os.path.dirname(__file__), 'static', 'mining')
    imagenes = set()
    if os.path.isdir(img_dir):
        for fname in os.listdir(img_dir):
            if re.match(r'^\d+\.(png|jpg|jpeg|webp)$', fname, re.IGNORECASE):
                imagenes.add(fname.lower())
    return render_template('mineria.html', imagenes=imagenes)


if __name__ == '__main__':
    app.run(debug=True)
