import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from queries import MODELADO_QUERIES
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
load_dotenv()

conn = psycopg2.connect(os.environ['DB_URL'], cursor_factory=RealDictCursor)
cur = conn.cursor()

checks = {
    'gravedad':           ('descripcion', 'total'),
    'causas_fatales':     ('descripcion', 'total'),
    'clase_gravedad':     ('clase', 'gravedad', 'total'),
    'evolucion_gravedad': ('anio', 'descripcion', 'total'),
    'hora_fatal':         ('hora', 'muertos', 'total'),
    'actores_estado':     ('condicion', 'estado', 'total'),
    'tabla_localidades':  ('nombre', 'total', 'con_muertos'),
    '_conteos':           ('tabla', 'filas'),
}

all_ok = True
for name, cols in checks.items():
    sql = MODELADO_QUERIES[name].strip().rstrip(';')
    wrapped = f"SELECT * FROM ({sql}) AS _q LIMIT 2"
    cur.execute(wrapped)
    rows = cur.fetchall()
    if not rows:
        print(f'  EMPTY  {name}')
        all_ok = False
        continue
    row = rows[0]
    missing = [c for c in cols if c not in row]
    if missing:
        print(f'  ERROR  {name} — columnas faltantes: {missing} | row: {dict(row)}')
        all_ok = False
    else:
        print(f'  OK     {name} — {dict(row)}')

conn.close()
if all_ok:
    print('\nTodas las queries OK')
