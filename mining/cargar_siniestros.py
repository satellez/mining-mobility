import json
import numpy as np
from Orange.data import Table, Domain, DiscreteVariable, ContinuousVariable

PATH = 'D:/movilidad_bogota/mining-mobility/data/siniestros_detalle_completo.json'

print('Cargando JSON...')
with open(PATH, 'r', encoding='utf-8') as f:
    registros = json.load(f)
print(f'Total registros: {len(registros):,}')

filas = []
for r in registros:
    hora_str = r.get('HORA') or '00:00:00'
    try:
        hora_num = float(hora_str.split(':')[0])
    except Exception:
        hora_num = float('nan')
    hips = r.get('HIPOTESIS_LISTA') or []
    hip  = hips[0] if hips else 'Desconocida'
    vehs = r.get('VEHICULOS_INVOLUCRADOS') or []
    veh  = vehs[0].get('CLASE', 'Otro') if vehs else 'Otro'
    acts = r.get('ACTORES_INVOLUCRADOS') or []
    filas.append((
        hora_num,
        r.get('GRAVEDAD', ''),
        r.get('CLASE', ''),
        str(r.get('CODIGO_LOCALIDAD', 0)),
        hip, veh,
        float(len(vehs)),
        float(len(acts)),
    ))

gravedades  = sorted({f[1] for f in filas if f[1]})
clases      = sorted({f[2] for f in filas if f[2]})
localidades = sorted({f[3] for f in filas})
hipotesis   = sorted({f[4] for f in filas if f[4]})
tipos_veh   = sorted({f[5] for f in filas if f[5]})

g_idx  = {v: i for i, v in enumerate(gravedades)}
cl_idx = {v: i for i, v in enumerate(clases)}
lo_idx = {v: i for i, v in enumerate(localidades)}
hi_idx = {v: i for i, v in enumerate(hipotesis)}
tv_idx = {v: i for i, v in enumerate(tipos_veh)}

domain = Domain(
    [
        ContinuousVariable('hora'),
        DiscreteVariable('clase_siniestro', values=clases),
        DiscreteVariable('localidad',       values=localidades),
        DiscreteVariable('hipotesis',       values=hipotesis),
        DiscreteVariable('tipo_vehiculo',   values=tipos_veh),
        ContinuousVariable('num_vehiculos'),
        ContinuousVariable('num_actores'),
    ],
    class_vars=DiscreteVariable('gravedad', values=gravedades)
)

X, Y = [], []
for f in filas:
    if not f[1]:
        continue
    X.append([
        f[0],
        float(cl_idx.get(f[2], float('nan'))),
        float(lo_idx.get(f[3], float('nan'))),
        float(hi_idx.get(f[4], float('nan'))),
        float(tv_idx.get(f[5], float('nan'))),
        f[6], f[7],
    ])
    Y.append(float(g_idx.get(f[1], 0)))

out_data = Table.from_numpy(
    domain,
    np.array(X, dtype=float),
    np.array(Y, dtype=float),
)
print(f'Tabla lista: {len(out_data):,} filas, {len(domain.attributes)} atributos')
print(f'Clases objetivo: {gravedades}')
