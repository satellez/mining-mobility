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

function fmt(n) { return Number(n).toLocaleString('es-CO'); }

/* ─── KPI CARDS ─────────────────────────────────────────────────────────────── */
function renderKPIs(gravedad) {
  const muertos = gravedad.find(d => d.descripcion === 'Con Muertos')?.total || 0;
  const heridos = gravedad.find(d => d.descripcion === 'Con Heridos')?.total || 0;
  const danos   = gravedad.find(d => d.descripcion === 'Solo Daños')?.total  || 0;
  const total   = muertos + heridos + danos;

  document.getElementById('kpi-total').textContent    = fmt(total);
  document.getElementById('kpi-muertos').textContent  = fmt(muertos);
  document.getElementById('kpi-heridos').textContent  = fmt(heridos);
  document.getElementById('kpi-danos').textContent    = fmt(danos);
  document.getElementById('kpi-muertos-pct').textContent = ((muertos / total) * 100).toFixed(2) + '% del total';
  document.getElementById('kpi-heridos-pct').textContent = ((heridos / total) * 100).toFixed(1) + '% del total';
  document.getElementById('kpi-danos-pct').textContent   = ((danos   / total) * 100).toFixed(1) + '% del total';
}

/* ─── TENDENCIA MENSUAL ─────────────────────────────────────────────────────── */
function renderTendencia(rawData) {
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const labels  = rawData.map(d => `${meses[d.mes - 1]} ${d.anio}`);
  const valores = rawData.map(d => d.total);

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
    const nombre = d.nombre;
    if (!byLoc[nombre]) byLoc[nombre] = { muertos: 0, heridos: 0, danos: 0 };
    if (d.gravedad === 'Con Muertos') byLoc[nombre].muertos = d.total;
    if (d.gravedad === 'Con Heridos') byLoc[nombre].heridos = d.total;
    if (d.gravedad === 'Solo Daños')  byLoc[nombre].danos   = d.total;
  });

  const sorted = Object.entries(byLoc)
    .map(([nombre, g]) => ({ nombre, total: g.muertos + g.heridos + g.danos, ...g }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const labels  = sorted.map(d => d.nombre);
  const muertos = sorted.map(d => d.muertos);
  const heridos = sorted.map(d => d.heridos);
  const danos   = sorted.map(d => d.danos);

  new Chart(document.getElementById('chart-localidades'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Solo Daños',  data: danos,   backgroundColor: 'rgba(59,130,246,0.55)', borderWidth: 0 },
        { label: 'Con Heridos', data: heridos, backgroundColor: C_AMBER,                 borderWidth: 0 },
        { label: 'Con Muertos', data: muertos, backgroundColor: C_RED,                   borderWidth: 0 },
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
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.x)}` },
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
      labels:   porClase.map(d => d.descripcion),
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
  const labels = hipotesis.map(d => d.descripcion.length > 42 ? d.descripcion.slice(0, 42) + '…' : d.descripcion);
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
      labels:   porVehiculo.map(d => d.descripcion),
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
  const palette = [C_BLUE, C_AMBER, C_GREEN, C_RED, C_SKY, C_PURPLE, C_PINK];
  const bg = porCondicion.map((_, i) => palette[i % palette.length] + 'aa');
  const br = porCondicion.map((_, i) => palette[i % palette.length]);

  new Chart(document.getElementById('chart-condicion'), {
    type: 'bar',
    data: {
      labels:   porCondicion.map(d => d.descripcion),
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
  renderKPIs(DATA_GRAVEDAD);
  renderTendencia(DATA_TENDENCIA);
  renderHora(DATA_HORA);
  renderLocalidades(DATA_LOCALIDADES);
  renderClase(DATA_CLASE);
  renderHipotesis(DATA_HIPOTESIS);
  renderVehiculo(DATA_VEHICULOS);
  renderCondicion(DATA_CONDICION);
});
