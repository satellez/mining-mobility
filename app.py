from flask import Flask, render_template
import json, os

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

def _load(filename):
    with open(os.path.join(DATA_DIR, filename), 'r', encoding='utf-8') as f:
        return json.load(f)

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

if __name__ == '__main__':
    app.run(debug=True)
