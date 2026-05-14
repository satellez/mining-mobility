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

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES_NOMBRE = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmt(n) { return Number(n).toLocaleString('es-CO'); }

/* ─── KPIs ───────────────────────────────────────────────────────────────────── */
function renderKPIs() {
  // Accidentes mortales
  const totalSin  = DATA_TASA_LOC.reduce((s, d) => s + Number(d.total), 0);
  const totalMort = DATA_TASA_LOC.reduce((s, d) => s + Number(d.muertos), 0);
  document.getElementById('kpi-mortales').textContent      = fmt(totalMort);
  document.getElementById('kpi-mortales-pct').textContent  = ((totalMort / totalSin) * 100).toFixed(2) + '% del total';

  // Actor más vulnerable (más muertes absolutas)
  const byActor = {};
  DATA_ACTORES_ESTADO.forEach(d => {
    if (d.estado === 'MUERTO') byActor[d.condicion] = (byActor[d.condicion] || 0) + Number(d.total);
  });
  const topActor = Object.entries(byActor).sort((a, b) => b[1] - a[1])[0];
  if (topActor) {
    const nombre = topActor[0].charAt(0).toUpperCase() + topActor[0].slice(1).toLowerCase();
    document.getElementById('kpi-actor').textContent    = nombre;
    document.getElementById('kpi-actor-sub').textContent = fmt(topActor[1]) + ' muertes registradas';
  }

  // Localidad con mayor tasa de mortalidad
  const topLoc = DATA_TASA_LOC[0];
  if (topLoc) {
    document.getElementById('kpi-localidad').textContent    = topLoc.nombre;
    document.getElementById('kpi-localidad-sub').textContent = topLoc.tasa + ' por cada 1.000 accidentes';
  }

  // Hora de mayor mortalidad
  const topHora = DATA_HORA_FATAL.reduce((best, d) => Number(d.muertos) > Number(best.muertos) ? d : best, DATA_HORA_FATAL[0]);
  if (topHora) {
    document.getElementById('kpi-hora').textContent    = String(topHora.hora).padStart(2, '0') + ':00';
    document.getElementById('kpi-hora-sub').textContent = fmt(topHora.muertos) + ' accidentes mortales';
  }
}

/* ─── EVOLUCIÓN ANUAL POR GRAVEDAD (grouped bar) ────────────────────────────── */
function renderEvolucion() {
  const anios = [...new Set(DATA_EVOLUCION.map(d => d.anio))].sort();
  const graveColors = { 'Con Muertos': C_RED, 'Con Heridos': C_AMBER, 'Solo Daños': 'rgba(59,130,246,0.6)' };

  const gravedades = [...new Set(DATA_EVOLUCION.map(d => d.descripcion))];
  const datasets = gravedades.map(g => ({
    label: g,
    data: anios.map(a => {
      const row = DATA_EVOLUCION.find(d => d.anio === a && d.descripcion === g);
      return row ? row.total : 0;
    }),
    backgroundColor: (graveColors[g] || C_PURPLE) + (g === 'Solo Daños' ? '' : 'cc'),
    borderColor: graveColors[g] || C_PURPLE,
    borderWidth: 1,
    borderRadius: 2,
  }));

  new Chart(document.getElementById('chart-evolucion'), {
    type: 'bar',
    data: { labels: anios, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 10 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
      },
      scales: {
        x: { grid: GRID, ticks: TICKS },
        y: { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) } },
      },
    },
  });
}

/* ─── DÍA DE LA SEMANA ──────────────────────────────────────────────────────── */
function renderDiaSemana() {
  // dia_semana puede ser 0-6 (lunes=0) o 1-7; normalizamos
  const sorted = [...DATA_DIA_SEMANA].sort((a, b) => a.dia_semana - b.dia_semana);
  const labels = sorted.map(d => {
    const idx = Number(d.dia_semana) % 7;
    return DIAS_SEMANA[idx] || String(d.dia_semana);
  });
  const vals   = sorted.map(d => d.total);
  const maxVal = Math.max(...vals);
  const bgColors = vals.map((v, i) => {
    const dia = Number(sorted[i].dia_semana) % 7;
    if (dia >= 5) return C_AMBER + 'cc';
    return v === maxVal ? C_RED : 'rgba(59,130,246,0.55)';
  });

  new Chart(document.getElementById('chart-diasemana'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Siniestros', data: vals, backgroundColor: bgColors, borderWidth: 0, borderRadius: 3 }],
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

/* ─── TASA MORTALIDAD POR LOCALIDAD (horizontal bar) ───────────────────────── */
function renderTasaLocalidad() {
  const sorted = [...DATA_TASA_LOC].sort((a, b) => Number(b.tasa) - Number(a.tasa));
  const labels = sorted.map(d => d.nombre);
  const tasas  = sorted.map(d => Number(d.tasa));
  const maxTasa = Math.max(...tasas);

  const bgColors = tasas.map(t => {
    const ratio = t / maxTasa;
    if (ratio > 0.75) return C_RED + 'cc';
    if (ratio > 0.45) return C_AMBER + 'cc';
    return 'rgba(59,130,246,0.5)';
  });

  new Chart(document.getElementById('chart-tasa'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Muertes por 1.000 accidentes',
        data: tasas,
        backgroundColor: bgColors,
        borderWidth: 0,
        borderRadius: 2,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} muertes / 1.000 accidentes` } },
      },
      scales: {
        x: { grid: GRID, ticks: TICKS },
        y: { grid: { display: false }, ticks: TICKS },
      },
    },
  });
}

/* ─── ACTORES POR ESTADO (stacked bar) ─────────────────────────────────────── */
function renderActoresEstado() {
  const condiciones = [...new Set(DATA_ACTORES_ESTADO.map(d => d.condicion))];
  const estados = ['ILESO', 'HERIDO', 'MUERTO'];
  const estadoColors = { ILESO: C_GREEN + '99', HERIDO: C_AMBER + 'cc', MUERTO: C_RED };

  const datasets = estados.map(estado => ({
    label: estado.charAt(0) + estado.slice(1).toLowerCase(),
    data: condiciones.map(c => {
      const row = DATA_ACTORES_ESTADO.find(d => d.condicion === c && d.estado === estado);
      return row ? row.total : 0;
    }),
    backgroundColor: estadoColors[estado],
    borderWidth: 0,
  }));

  const labels = condiciones.map(c => c.charAt(0) + c.slice(1).toLowerCase());

  new Chart(document.getElementById('chart-actores'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 10 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
      },
      scales: {
        x: { stacked: true, grid: GRID, ticks: { ...TICKS, font: { size: 9 } } },
        y: { stacked: true, grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) } },
      },
    },
  });
}

/* ─── CAUSAS FATALES (horizontal bar) ──────────────────────────────────────── */
function renderCausasFatales() {
  const labels = DATA_CAUSAS_FATALES.map(d => d.descripcion.length > 40 ? d.descripcion.slice(0, 40) + '…' : d.descripcion);
  const vals   = DATA_CAUSAS_FATALES.map(d => d.total);

  new Chart(document.getElementById('chart-causas'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Accidentes mortales',
        data: vals,
        backgroundColor: C_RED + '99',
        borderColor: C_RED,
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

/* ─── HORA FATAL vs TOTAL (dual axis line) ──────────────────────────────────── */
function renderHoraFatal() {
  const labels  = DATA_HORA_FATAL.map(d => `${String(d.hora).padStart(2,'0')}h`);
  const totales = DATA_HORA_FATAL.map(d => d.total);
  const muertos = DATA_HORA_FATAL.map(d => d.muertos);

  new Chart(document.getElementById('chart-horafatal'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Total accidentes',
          data: totales,
          backgroundColor: 'rgba(59,130,246,0.25)',
          borderWidth: 0,
          borderRadius: 2,
          yAxisID: 'y',
        },
        {
          label: 'Con muertos',
          data: muertos,
          type: 'line',
          borderColor: C_RED,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.3,
          yAxisID: 'y2',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 10 } } },
      },
      scales: {
        x: { grid: GRID, ticks: { ...TICKS, font: { size: 9 }, maxRotation: 0 } },
        y:  { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) }, position: 'left' },
        y2: { grid: { display: false }, ticks: { ...TICKS, color: C_RED + 'cc' }, position: 'right' },
      },
    },
  });
}

/* ─── VEHÍCULO EN ACCIDENTES FATALES (doughnut) ─────────────────────────────── */
function renderVehiculoFatal() {
  const labels  = DATA_VEH_FATAL.map(d => d.descripcion);
  const muertos = DATA_VEH_FATAL.map(d => d.muertos);
  const colores = [C_RED, C_AMBER, C_BLUE, C_PURPLE, C_SKY, C_GREEN, C_PINK, C_BLUE, C_RED, C_AMBER];

  new Chart(document.getElementById('chart-vehiculofatal'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: muertos,
        backgroundColor: colores.map(c => c + 'cc'),
        borderColor: colores,
        borderWidth: 1,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 9 }, padding: 10 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)} muertos`,
          },
        },
      },
    },
  });
}

/* ─── ESTACIONALIDAD MENSUAL (area) ─────────────────────────────────────────── */
function renderEstacionalidad() {
  const labels = DATA_ESTACIONALIDAD.map(d => MESES_NOMBRE[d.mes - 1] || d.mes);
  const vals   = DATA_ESTACIONALIDAD.map(d => Math.round(d.promedio));

  new Chart(document.getElementById('chart-estacionalidad'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Promedio mensual',
        data: vals,
        borderColor: C_SKY,
        backgroundColor: 'rgba(56,189,248,0.1)',
        borderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: C_SKY,
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)} accidentes (promedio)` } },
      },
      scales: {
        x: { grid: GRID, ticks: TICKS },
        y: { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) }, min: 0 },
      },
    },
  });
}

/* ─── INIT ───────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderKPIs();
  renderEvolucion();
  renderDiaSemana();
  renderTasaLocalidad();
  renderActoresEstado();
  renderCausasFatales();
  renderHoraFatal();
  renderVehiculoFatal();
  renderEstacionalidad();
});
