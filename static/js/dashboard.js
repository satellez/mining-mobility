/* ─── CONFIGURACIÓN GLOBAL Chart.js ─────────────────────────────────────────── */
Chart.defaults.color           = '#6b82a8';
Chart.defaults.font.family     = "'DM Mono', monospace";
Chart.defaults.font.size       = 11;
Chart.defaults.plugins.legend.labels.boxWidth  = 10;
Chart.defaults.plugins.legend.labels.padding   = 16;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(9,15,31,0.95)';
Chart.defaults.plugins.tooltip.borderColor     = 'rgba(59,130,246,0.3)';
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.tooltip.titleFont       = { family: "'DM Mono', monospace", size: 11 };
Chart.defaults.plugins.tooltip.bodyFont        = { family: "'DM Mono', monospace", size: 11 };

const GRID  = { color: 'rgba(147,197,253,0.06)', drawBorder: false };
const TICKS = { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 10 } };

const C_BLUE   = '#3b82f6';
const C_GREEN  = '#10b981';
const C_SKY    = '#38bdf8';
const C_RED    = '#ef4444';
const C_AMBER  = '#f59e0b';
const C_PURPLE = '#818cf8';
const C_PINK   = '#ec4899';

function fmt(n) { return n.toLocaleString('es-CO'); }

/* ─── KPI CARDS ─────────────────────────────────────────────────────────────── */
function renderKPIs(totales) {
  const t = totales.siniestros;
  document.getElementById('kpi-total').textContent    = fmt(t);
  document.getElementById('kpi-muertos').textContent  = fmt(totales.con_muertos);
  document.getElementById('kpi-heridos').textContent  = fmt(totales.con_heridos);
  document.getElementById('kpi-danos').textContent    = fmt(totales.solo_danos);
  document.getElementById('kpi-muertos-pct').textContent = ((totales.con_muertos / t) * 100).toFixed(2) + '% del total';
  document.getElementById('kpi-heridos-pct').textContent = ((totales.con_heridos / t) * 100).toFixed(1) + '% del total';
  document.getElementById('kpi-danos-pct').textContent   = ((totales.solo_danos  / t) * 100).toFixed(1) + '% del total';
}

/* ─── TENDENCIA MENSUAL ─────────────────────────────────────────────────────── */
function renderTendencia(rawData) {
  const labels  = rawData.map(d => {
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${meses[d.MES - 1]} ${d['AÑO']}`;
  });
  const valores = rawData.map(d => d.TOTAL_ACCIDENTES);

  new Chart(document.getElementById('chart-tendencia'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Siniestros / mes',
        data: valores,
        borderColor: C_BLUE,
        backgroundColor: 'rgba(59,130,246,0.08)',
        borderWidth: 1.5,
        pointRadius: 0,
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
            maxTicksLimit: 12,
            callback(val, i) { return labels[i].startsWith('Ene') ? labels[i] : ''; },
            maxRotation: 0,
          },
        },
        y: {
          grid: GRID,
          ticks: { ...TICKS, callback: v => fmt(v) },
          min: 0,
        },
      },
    },
  });
}

/* ─── SINIESTROS POR HORA ───────────────────────────────────────────────────── */
function renderHora(porHora) {
  const labels = porHora.map(d => `${String(d.hora).padStart(2,'0')}h`);
  const vals   = porHora.map(d => d.total);
  const maxVal = Math.max(...vals);

  const bgColors = vals.map(v => {
    const ratio = v / maxVal;
    if (ratio > 0.85) return C_RED;
    if (ratio > 0.65) return C_AMBER;
    if (ratio > 0.40) return C_BLUE;
    return 'rgba(59,130,246,0.35)';
  });

  new Chart(document.getElementById('chart-hora'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Siniestros',
        data: vals,
        backgroundColor: bgColors,
        borderWidth: 0,
        borderRadius: 2,
      }],
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

/* ─── LOCALIDADES × GRAVEDAD (stacked horizontal) ──────────────────────────── */
function renderLocalidades(rawLoc) {
  const byLoc = {};
  rawLoc.forEach(d => {
    if (!byLoc[d.CODIGO_LOCALIDAD]) byLoc[d.CODIGO_LOCALIDAD] = { Heridos: 0, Muertos: 0, Danos: 0 };
    if (d.GRAVEDAD === 'Con Heridos') byLoc[d.CODIGO_LOCALIDAD].Heridos = d.TOTAL;
    if (d.GRAVEDAD === 'Con Muertos') byLoc[d.CODIGO_LOCALIDAD].Muertos = d.TOTAL;
    if (d.GRAVEDAD === 'Solo Daños')  byLoc[d.CODIGO_LOCALIDAD].Danos   = d.TOTAL;
  });

  const sorted = Object.entries(byLoc)
    .map(([cod, g]) => ({ cod: +cod, total: g.Heridos + g.Muertos + g.Danos, ...g }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const labels  = sorted.map(d => LOC_NOMBRES[d.cod] || `Loc. ${d.cod}`);
  const heridos = sorted.map(d => d.Heridos);
  const muertos = sorted.map(d => d.Muertos);
  const danos   = sorted.map(d => d.Danos);

  new Chart(document.getElementById('chart-localidades'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Solo Daños',   data: danos,   backgroundColor: 'rgba(59,130,246,0.55)',  borderWidth: 0 },
        { label: 'Con Heridos',  data: heridos, backgroundColor: C_AMBER,                  borderWidth: 0 },
        { label: 'Con Muertos',  data: muertos, backgroundColor: C_RED,                    borderWidth: 0 },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 10 } },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.x)}`,
          },
        },
      },
      scales: {
        x: { stacked: true, grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) } },
        y: { stacked: true, grid: { display: false }, ticks: TICKS },
      },
    },
  });
}

/* ─── CLASE DE SINIESTRO (doughnut) ────────────────────────────────────────── */
function renderClase(porClase) {
  const colores = [C_BLUE, C_AMBER, C_GREEN, C_PURPLE, C_SKY, C_RED, C_PINK];
  new Chart(document.getElementById('chart-clase'), {
    type: 'doughnut',
    data: {
      labels:   porClase.map(d => d.clase),
      datasets: [{
        data:            porClase.map(d => d.total),
        backgroundColor: porClase.map((_, i) => colores[i % colores.length]),
        borderColor:     'rgba(9,15,31,0.6)',
        borderWidth:     2,
        hoverOffset:     6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 10 }, padding: 12 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)} (${((ctx.parsed / ctx.dataset.data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`,
          },
        },
      },
    },
  });
}

/* ─── HIPÓTESIS (horizontal bar) ────────────────────────────────────────────── */
function renderHipotesis(hipotesis) {
  const labels = hipotesis.map(d => d.hipotesis.length > 42 ? d.hipotesis.slice(0, 42) + '…' : d.hipotesis);
  const vals   = hipotesis.map(d => d.total);

  new Chart(document.getElementById('chart-hipotesis'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Frecuencia',
        data: vals,
        backgroundColor: 'rgba(56,189,248,0.55)',
        borderColor: C_SKY,
        borderWidth: 1,
        borderRadius: 2,
      }],
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

/* ─── TIPO DE VEHÍCULO (horizontal bar) ─────────────────────────────────────── */
function renderVehiculo(porVehiculo) {
  const colores = [C_BLUE, C_GREEN, C_AMBER, C_RED, C_PURPLE, C_SKY, C_PINK, C_BLUE];
  new Chart(document.getElementById('chart-vehiculo'), {
    type: 'bar',
    data: {
      labels:   porVehiculo.map(d => d.clase),
      datasets: [{
        label: 'Vehículos involucrados',
        data:  porVehiculo.map(d => d.total),
        backgroundColor: porVehiculo.map((_, i) => colores[i % colores.length] + 'aa'),
        borderColor:     porVehiculo.map((_, i) => colores[i % colores.length]),
        borderWidth: 1,
        borderRadius: 2,
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

/* ─── CONDICIÓN ACTOR VIAL (bar) ─────────────────────────────────────────────── */
function renderCondicion(porCondicion) {
  const colores = {
    'CONDUCTOR':          C_BLUE,
    'MOTOCICLISTA':       C_AMBER,
    'PASAJERO/ACOMPAÑANTE': C_GREEN,
    'PEATON':             C_RED,
    'CICLISTA':           C_SKY,
  };
  const bg = porCondicion.map(d => (colores[d.condicion] || C_PURPLE) + 'aa');
  const br = porCondicion.map(d => colores[d.condicion] || C_PURPLE);

  const labels = porCondicion.map(d => {
    const m = { 'CONDUCTOR':'Conductor','MOTOCICLISTA':'Motociclista',
      'PASAJERO/ACOMPAÑANTE':'Pasajero/Acomp.','PEATON':'Peatón','CICLISTA':'Ciclista' };
    return m[d.condicion] || d.condicion;
  });

  new Chart(document.getElementById('chart-condicion'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Actores viales',
        data:  porCondicion.map(d => d.total),
        backgroundColor: bg,
        borderColor: br,
        borderWidth: 1,
        borderRadius: 2,
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

/* ─── INIT ───────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderKPIs(DATA_AGG.totales);
  renderTendencia(DATA_TEND);
  renderHora(DATA_AGG.por_hora);
  renderLocalidades(DATA_LOC);
  renderClase(DATA_AGG.por_clase);
  renderHipotesis(DATA_AGG.hipotesis);
  renderVehiculo(DATA_AGG.por_vehiculo);
  renderCondicion(DATA_AGG.por_condicion);
});
