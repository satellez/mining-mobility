Chart.defaults.color           = '#6b82a8';
Chart.defaults.font.family     = "'DM Mono', monospace";
Chart.defaults.font.size       = 11;
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.padding  = 16;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(9,15,31,0.95)';
Chart.defaults.plugins.tooltip.borderColor     = 'rgba(59,130,246,0.3)';
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.tooltip.titleFont = { family: "'DM Mono', monospace", size: 11 };
Chart.defaults.plugins.tooltip.bodyFont  = { family: "'DM Mono', monospace", size: 11 };

const GRID  = { color: 'rgba(147,197,253,0.06)', drawBorder: false };
const TICKS = { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 10 } };

const C_BLUE   = '#3b82f6';
const C_GREEN  = '#10b981';
const C_SKY    = '#38bdf8';
const C_RED    = '#ef4444';
const C_AMBER  = '#f59e0b';
const C_PURPLE = '#818cf8';
const C_PINK   = '#ec4899';

function fmt(n) { return Math.round(n).toLocaleString('es-CO'); }

/* ─── ESTADO DE FILTROS ─────────────────────────────────────────────────────── */
const FILTERS = { anio: 'all', gravedad: 'all', topn: 10 };

/* ─── INSTANCIAS DE CHARTS ──────────────────────────────────────────────────── */
let chTendencia, chHora, chLocalidades, chClase, chHipotesis, chVehiculo, chCondicion;

/* ─── UTILIDAD: destruir y recrear canvas ───────────────────────────────────── */
function resetCanvas(id) {
  const wrap = document.getElementById(id).parentNode;
  document.getElementById(id).remove();
  const c = document.createElement('canvas');
  c.id = id;
  wrap.appendChild(c);
  return document.getElementById(id);
}

/* ─── STATS ─────────────────────────────────────────────────────────────────── */
function updateStats() {
  const { anio } = FILTERS;

  if (anio === 'all') {
    const t = DATA_AGG.totales;
    document.getElementById('fstat-total').textContent   = fmt(t.siniestros);
    document.getElementById('fstat-muertos').textContent = fmt(t.con_muertos);
    document.getElementById('fstat-heridos').textContent = fmt(t.con_heridos);
    document.getElementById('fstat-danos').textContent   = fmt(t.solo_danos);
  } else {
    const filtrado = DATA_TEND.filter(d => String(d['AÑO']) === anio);
    const total = filtrado.reduce((s, d) => s + d.TOTAL_ACCIDENTES, 0);
    document.getElementById('fstat-total').textContent   = fmt(total);
    document.getElementById('fstat-muertos').textContent = '—';
    document.getElementById('fstat-heridos').textContent = '—';
    document.getElementById('fstat-danos').textContent   = '—';
  }
}

/* ─── TENDENCIA MENSUAL ─────────────────────────────────────────────────────── */
function renderTendencia() {
  const { anio } = FILTERS;
  const meses    = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const raw      = anio === 'all' ? DATA_TEND : DATA_TEND.filter(d => String(d['AÑO']) === anio);

  const labels  = raw.map(d => `${meses[d.MES - 1]} ${d['AÑO']}`);
  const valores = raw.map(d => d.TOTAL_ACCIDENTES);

  if (chTendencia) chTendencia.destroy();
  chTendencia = new Chart(resetCanvas('chart-tendencia'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Siniestros / mes',
        data: valores,
        borderColor: C_BLUE,
        backgroundColor: 'rgba(59,130,246,0.08)',
        borderWidth: 1.5,
        pointRadius: anio === 'all' ? 0 : 3,
        pointHoverRadius: 4,
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: GRID,
          ticks: {
            ...TICKS,
            maxTicksLimit: anio === 'all' ? 12 : 12,
            callback(val, i) {
              if (anio === 'all') return labels[i].startsWith('Ene') ? labels[i] : '';
              return labels[i];
            },
            maxRotation: 0,
          },
        },
        y: { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) }, min: 0 },
      },
    },
  });
}

/* ─── SINIESTROS POR HORA ───────────────────────────────────────────────────── */
function renderHora() {
  const porHora = DATA_AGG.por_hora;
  const labels  = porHora.map(d => `${String(d.hora).padStart(2,'0')}h`);
  const vals    = porHora.map(d => d.total);
  const maxVal  = Math.max(...vals);

  const bgColors = vals.map(v => {
    const r = v / maxVal;
    if (r > 0.85) return C_RED;
    if (r > 0.65) return C_AMBER;
    if (r > 0.40) return C_BLUE;
    return 'rgba(59,130,246,0.35)';
  });

  if (chHora) chHora.destroy();
  chHora = new Chart(resetCanvas('chart-hora'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Siniestros', data: vals, backgroundColor: bgColors, borderWidth: 0, borderRadius: 2 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: GRID, ticks: { ...TICKS, maxRotation: 0, font: { size: 9 } } },
        y: { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) } },
      },
    },
  });
}

/* ─── LOCALIDADES × GRAVEDAD ────────────────────────────────────────────────── */
function renderLocalidades() {
  const { gravedad, topn } = FILTERS;

  const byLoc = {};
  DATA_LOC.forEach(d => {
    if (!byLoc[d.CODIGO_LOCALIDAD]) byLoc[d.CODIGO_LOCALIDAD] = { Heridos: 0, Muertos: 0, Danos: 0 };
    if (d.GRAVEDAD === 'Con Heridos') byLoc[d.CODIGO_LOCALIDAD].Heridos = d.TOTAL;
    if (d.GRAVEDAD === 'Con Muertos') byLoc[d.CODIGO_LOCALIDAD].Muertos = d.TOTAL;
    if (d.GRAVEDAD === 'Solo Daños')  byLoc[d.CODIGO_LOCALIDAD].Danos   = d.TOTAL;
  });

  const getTotal = (g) => {
    if (gravedad === 'all')          return g.Heridos + g.Muertos + g.Danos;
    if (gravedad === 'Con Muertos')  return g.Muertos;
    if (gravedad === 'Con Heridos')  return g.Heridos;
    return g.Danos;
  };

  const sorted = Object.entries(byLoc)
    .map(([cod, g]) => ({ cod: +cod, ...g }))
    .sort((a, b) => getTotal(b) - getTotal(a))
    .slice(0, topn);

  const labels = sorted.map(d => LOC_NOMBRES[d.cod] || `Loc. ${d.cod}`);

  let datasets;
  if (gravedad === 'all') {
    datasets = [
      { label: 'Solo Daños',  data: sorted.map(d => d.Danos),   backgroundColor: 'rgba(59,130,246,0.55)', borderWidth: 0 },
      { label: 'Con Heridos', data: sorted.map(d => d.Heridos), backgroundColor: C_AMBER,                  borderWidth: 0 },
      { label: 'Con Muertos', data: sorted.map(d => d.Muertos), backgroundColor: C_RED,                    borderWidth: 0 },
    ];
  } else {
    const color = gravedad === 'Con Muertos' ? C_RED
                : gravedad === 'Con Heridos' ? C_AMBER
                : 'rgba(59,130,246,0.7)';
    datasets = [{ label: gravedad, data: sorted.map(d => getTotal(d)), backgroundColor: color, borderWidth: 0 }];
  }

  if (chLocalidades) chLocalidades.destroy();
  chLocalidades = new Chart(resetCanvas('chart-localidades'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: gravedad === 'all',
          position: 'top',
          labels: { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 10 } },
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.x)}` } },
      },
      scales: {
        x: { stacked: gravedad === 'all', grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) } },
        y: { stacked: gravedad === 'all', grid: { display: false }, ticks: TICKS },
      },
    },
  });
}

/* ─── CLASE DE SINIESTRO ────────────────────────────────────────────────────── */
function renderClase() {
  const colores = [C_BLUE, C_AMBER, C_GREEN, C_PURPLE, C_SKY, C_RED, C_PINK];
  const d       = DATA_AGG.por_clase;

  if (chClase) chClase.destroy();
  chClase = new Chart(resetCanvas('chart-clase'), {
    type: 'doughnut',
    data: {
      labels:   d.map(x => x.clase),
      datasets: [{
        data:            d.map(x => x.total),
        backgroundColor: d.map((_, i) => colores[i % colores.length]),
        borderColor:     'rgba(9,15,31,0.6)',
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 10 }, padding: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)} (${((ctx.parsed / ctx.dataset.data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`,
          },
        },
      },
    },
  });
}

/* ─── HIPÓTESIS ─────────────────────────────────────────────────────────────── */
function renderHipotesis() {
  const d      = DATA_AGG.hipotesis;
  const labels = d.map(x => x.hipotesis.length > 42 ? x.hipotesis.slice(0, 42) + '…' : x.hipotesis);

  if (chHipotesis) chHipotesis.destroy();
  chHipotesis = new Chart(resetCanvas('chart-hipotesis'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Frecuencia', data: d.map(x => x.total), backgroundColor: 'rgba(56,189,248,0.55)', borderColor: C_SKY, borderWidth: 1, borderRadius: 2 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) } },
        y: { grid: { display: false }, ticks: { ...TICKS, font: { size: 10 } } },
      },
    },
  });
}

/* ─── VEHÍCULO ───────────────────────────────────────────────────────────────── */
function renderVehiculo() {
  const colores = [C_BLUE, C_GREEN, C_AMBER, C_RED, C_PURPLE, C_SKY, C_PINK, C_BLUE];
  const d       = DATA_AGG.por_vehiculo;

  if (chVehiculo) chVehiculo.destroy();
  chVehiculo = new Chart(resetCanvas('chart-vehiculo'), {
    type: 'bar',
    data: {
      labels: d.map(x => x.clase),
      datasets: [{
        label: 'Vehículos involucrados',
        data:  d.map(x => x.total),
        backgroundColor: d.map((_, i) => colores[i % colores.length] + 'aa'),
        borderColor:     d.map((_, i) => colores[i % colores.length]),
        borderWidth: 1, borderRadius: 2,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) } },
        y: { grid: { display: false }, ticks: TICKS },
      },
    },
  });
}

/* ─── CONDICIÓN ACTOR VIAL ───────────────────────────────────────────────────── */
function renderCondicion() {
  const MAP = { 'CONDUCTOR':'Conductor','MOTOCICLISTA':'Motociclista','PASAJERO/ACOMPAÑANTE':'Pasajero/Acomp.','PEATON':'Peatón','CICLISTA':'Ciclista' };
  const COL = { 'CONDUCTOR':C_BLUE,'MOTOCICLISTA':C_AMBER,'PASAJERO/ACOMPAÑANTE':C_GREEN,'PEATON':C_RED,'CICLISTA':C_SKY };
  const d   = DATA_AGG.por_condicion;

  if (chCondicion) chCondicion.destroy();
  chCondicion = new Chart(resetCanvas('chart-condicion'), {
    type: 'bar',
    data: {
      labels: d.map(x => MAP[x.condicion] || x.condicion),
      datasets: [{
        label: 'Actores viales',
        data:  d.map(x => x.total),
        backgroundColor: d.map(x => (COL[x.condicion] || C_PURPLE) + 'aa'),
        borderColor:     d.map(x => COL[x.condicion]  || C_PURPLE),
        borderWidth: 1, borderRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: GRID, ticks: TICKS },
        y: { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) } },
      },
    },
  });
}

/* ─── APLICAR FILTROS ────────────────────────────────────────────────────────── */
function applyFilters() {
  renderTendencia();
  renderLocalidades();
  updateStats();
}

/* ─── SETUP FILTROS ──────────────────────────────────────────────────────────── */
function setupFilters() {
  document.querySelectorAll('#filter-anio .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#filter-anio .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      FILTERS.anio = btn.dataset.val;
      applyFilters();
    });
  });

  document.querySelectorAll('#filter-gravedad .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#filter-gravedad .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      FILTERS.gravedad = btn.dataset.val;
      applyFilters();
    });
  });

  document.querySelectorAll('#filter-topn .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#filter-topn .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      FILTERS.topn = parseInt(btn.dataset.val);
      renderLocalidades();
    });
  });
}

/* ─── INIT ───────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  setupFilters();
  updateStats();
  renderTendencia();
  renderHora();
  renderLocalidades();
  renderClase();
  renderHipotesis();
  renderVehiculo();
  renderCondicion();
});
