/* ─── CONFIGURACIÓN GLOBAL Chart.js ─────────────────────────────────────────── */
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
const MESES    = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmt(n) { return Number(n).toLocaleString('es-CO'); }

/* ─── KPIs ───────────────────────────────────────────────────────────────────── */
function renderKPIs() {
  const muertos = DATA_GRAVEDAD.find(d => d.descripcion === 'Con Muertos')?.total || 0;
  const heridos = DATA_GRAVEDAD.find(d => d.descripcion === 'Con Heridos')?.total || 0;
  const danos   = DATA_GRAVEDAD.find(d => d.descripcion === 'Solo Daños')?.total  || 0;
  const total   = Number(muertos) + Number(heridos) + Number(danos);

  document.getElementById('kpi-total').textContent    = fmt(total);
  document.getElementById('kpi-muertos').textContent  = fmt(muertos);
  document.getElementById('kpi-heridos').textContent  = fmt(heridos);
  document.getElementById('kpi-danos').textContent    = fmt(danos);
  document.getElementById('kpi-muertos-pct').textContent = ((muertos / total) * 100).toFixed(2) + '% del total';
  document.getElementById('kpi-heridos-pct').textContent = ((heridos / total) * 100).toFixed(1) + '% del total';
  document.getElementById('kpi-danos-pct').textContent   = ((danos   / total) * 100).toFixed(1) + '% del total';
}

/* ─── TENDENCIA MENSUAL ─────────────────────────────────────────────────────── */
function renderTendencia() {
  const labels  = DATA_TENDENCIA.map(d => `${MESES[d.mes - 1]} ${d.anio}`);
  const valores = DATA_TENDENCIA.map(d => d.total);

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
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: GRID, ticks: { ...TICKS, maxTicksLimit: 12,
          callback(v, i) { return labels[i].startsWith('Ene') ? labels[i] : ''; }, maxRotation: 0 } },
        y: { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) }, min: 0 },
      },
    },
  });
}

/* ─── EVOLUCIÓN ANUAL POR GRAVEDAD ──────────────────────────────────────────── */
function renderEvolucion() {
  const anios = [...new Set(DATA_EVOLUCION.map(d => d.anio))].sort();
  const graveColors = { 'Con Muertos': C_RED, 'Con Heridos': C_AMBER, 'Solo Daños': 'rgba(59,130,246,0.6)' };
  const gravedades  = ['Con Muertos', 'Con Heridos', 'Solo Daños'];

  const datasets = gravedades.map(g => ({
    label: g,
    data: anios.map(a => { const r = DATA_EVOLUCION.find(d => d.anio === a && d.descripcion === g); return r ? r.total : 0; }),
    backgroundColor: graveColors[g],
    borderColor: graveColors[g],
    borderWidth: 1,
    borderRadius: 2,
  }));

  new Chart(document.getElementById('chart-evolucion'), {
    type: 'bar',
    data: { labels: anios, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 9 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } } },
      scales: {
        x: { grid: GRID, ticks: TICKS },
        y: { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) } },
      },
    },
  });
}

/* ─── HORA FATAL DUAL AXIS ──────────────────────────────────────────────────── */
function renderHoraFatal() {
  const labels  = DATA_HORA_FATAL.map(d => `${String(d.hora).padStart(2,'0')}h`);
  const totales = DATA_HORA_FATAL.map(d => d.total);
  const muertos = DATA_HORA_FATAL.map(d => d.muertos);

  new Chart(document.getElementById('chart-horafatal'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Total accidentes', data: totales, backgroundColor: 'rgba(59,130,246,0.25)', borderWidth: 0, borderRadius: 2, yAxisID: 'y' },
        { label: 'Con muertos', data: muertos, type: 'line', borderColor: C_RED,
          backgroundColor: 'transparent', borderWidth: 2, pointRadius: 2, pointHoverRadius: 5, tension: 0.3, yAxisID: 'y2' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 10 } } } },
      scales: {
        x:  { grid: GRID, ticks: { ...TICKS, font: { size: 9 }, maxRotation: 0 } },
        y:  { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) }, position: 'left' },
        y2: { grid: { display: false }, ticks: { ...TICKS, color: C_RED + 'cc' }, position: 'right' },
      },
    },
  });
}

/* ─── SINIESTROS POR HORA ───────────────────────────────────────────────────── */
function renderHora() {
  const labels = DATA_HORA.map(d => `${String(d.hora).padStart(2,'0')}h`);
  const vals   = DATA_HORA.map(d => d.total);
  const maxVal = Math.max(...vals);
  const bgColors = vals.map(v => {
    const r = v / maxVal;
    if (r > 0.85) return C_RED;
    if (r > 0.65) return C_AMBER;
    if (r > 0.40) return C_BLUE;
    return 'rgba(59,130,246,0.35)';
  });

  new Chart(document.getElementById('chart-hora'), {
    type: 'bar',
    data: { labels, datasets: [{ data: vals, backgroundColor: bgColors, borderWidth: 0, borderRadius: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: GRID, ticks: { ...TICKS, font: { size: 9 }, maxRotation: 0 } },
        y: { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) } },
      },
    },
  });
}

/* ─── CAUSAS FATALES ────────────────────────────────────────────────────────── */
function renderCausas() {
  const labels = DATA_CAUSAS.map(d => d.descripcion.length > 44 ? d.descripcion.slice(0,44)+'…' : d.descripcion);
  new Chart(document.getElementById('chart-causas'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Accidentes mortales', data: DATA_CAUSAS.map(d => d.total),
        backgroundColor: C_RED + '99', borderColor: C_RED, borderWidth: 1, borderRadius: 2 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) } },
        y: { grid: { display: false }, ticks: { ...TICKS, font: { size: 10 } } },
      },
    },
  });
}

/* ─── ESTADO ACTORES ────────────────────────────────────────────────────────── */
function renderActores() {
  const condiciones = [...new Set(DATA_ACTORES.map(d => d.condicion))];
  const estados = ['ILESO', 'HERIDO', 'MUERTO'];
  const colors  = { ILESO: C_GREEN+'99', HERIDO: C_AMBER+'cc', MUERTO: C_RED };
  const labels  = condiciones.map(c => c.charAt(0) + c.slice(1).toLowerCase());

  const datasets = estados.map(e => ({
    label: e.charAt(0) + e.slice(1).toLowerCase(),
    data: condiciones.map(c => { const r = DATA_ACTORES.find(d => d.condicion === c && d.estado === e); return r ? r.total : 0; }),
    backgroundColor: colors[e], borderWidth: 0,
  }));

  new Chart(document.getElementById('chart-actores'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 9 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } } },
      scales: {
        x: { stacked: true, grid: GRID, ticks: { ...TICKS, font: { size: 9 } } },
        y: { stacked: true, grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) } },
      },
    },
  });
}

/* ─── HIPÓTESIS GENERALES ───────────────────────────────────────────────────── */
function renderHipotesis() {
  const labels = DATA_HIPOTESIS.map(d => d.descripcion.length > 44 ? d.descripcion.slice(0,44)+'…' : d.descripcion);
  new Chart(document.getElementById('chart-hipotesis'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Frecuencia', data: DATA_HIPOTESIS.map(d => d.total),
        backgroundColor: 'rgba(56,189,248,0.5)', borderColor: C_SKY, borderWidth: 1, borderRadius: 2 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) } },
        y: { grid: { display: false }, ticks: { ...TICKS, font: { size: 10 } } },
      },
    },
  });
}

/* ─── TABLA CON FILTROS Y ORDEN ─────────────────────────────────────────────── */
function initTable() {
  let sortCol = 'con_muertos';
  let sortDir = 'desc';

  // Fila de totales en tfoot (sobre datos completos)
  const totalSin = DATA_TABLA.reduce((s, r) => s + Number(r.total), 0);
  const totalMue = DATA_TABLA.reduce((s, r) => s + Number(r.con_muertos), 0);
  const totalHer = DATA_TABLA.reduce((s, r) => s + Number(r.con_heridos), 0);
  const totalDan = DATA_TABLA.reduce((s, r) => s + Number(r.solo_danos), 0);
  document.getElementById('tabla-total-row').innerHTML = `
    <td class="td-nombre" style="color:var(--accent);letter-spacing:.05em">TOTAL BOGOTÁ</td>
    <td class="td-num" style="color:var(--text)">${fmt(totalSin)}</td>
    <td class="td-num td-red">${fmt(totalMue)}</td>
    <td class="td-num td-amber">${fmt(totalHer)}</td>
    <td class="td-num td-blue">${fmt(totalDan)}</td>
    <td class="td-num"><span class="tasa-badge tasa-mid">${(totalMue / totalSin * 1000).toFixed(1)}‰</span></td>
    <td></td>
  `;

  // ── Lógica de filtrado ──────────────────────────────────────────────────────
  function applyFilters() {
    const nombre  = document.getElementById('filter-nombre').value.trim().toLowerCase();
    const tasaMin = parseFloat(document.getElementById('filter-tasa').value) || 0;
    const tbody   = document.getElementById('tabla-body');
    const rows    = [...tbody.querySelectorAll('tr')];

    // 1. Mostrar / ocultar filas según filtros
    let visible = 0;
    rows.forEach(row => {
      const matchNombre = row.dataset.nombre.toLowerCase().includes(nombre);
      const matchTasa   = parseFloat(row.dataset.tasa_mortalidad) >= tasaMin;
      const show = matchNombre && matchTasa;
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    // 2. Ordenar las visibles
    const visibles = rows.filter(r => r.style.display !== 'none');
    visibles.sort((a, b) => {
      const va = a.dataset[sortCol];
      const vb = b.dataset[sortCol];
      const cmp = sortCol === 'nombre'
        ? va.localeCompare(vb, 'es')
        : Number(va) - Number(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    visibles.forEach(r => tbody.appendChild(r));
    // Mueve las ocultas al final (sin alterar orden visible)
    rows.filter(r => r.style.display === 'none').forEach(r => tbody.appendChild(r));

    // 3. Actualizar contador
    document.getElementById('filter-count').textContent =
      visible === DATA_TABLA.length ? `${visible} localidades` : `${visible} de ${DATA_TABLA.length}`;

    // 4. Mensaje vacío
    document.getElementById('table-empty').style.display = visible === 0 ? '' : 'none';
  }

  // ── Ordenar desde cabecera de la tabla ─────────────────────────────────────
  function setSortCol(col) {
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = col === 'nombre' ? 'asc' : 'desc';
    }
    // Sincronizar pills si la columna coincide
    document.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.sort === col);
    });
    // Actualizar icono de cabecera
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
    });
    const th = document.querySelector(`th[data-col="${col}"]`);
    if (th) th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    applyFilters();
  }

  // ── Eventos ────────────────────────────────────────────────────────────────
  document.getElementById('filter-nombre')
    .addEventListener('input', applyFilters);

  document.getElementById('filter-tasa')
    .addEventListener('change', applyFilters);

  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => setSortCol(btn.dataset.sort));
  });

  document.querySelectorAll('.data-table th.sortable').forEach(th => {
    th.addEventListener('click', () => setSortCol(th.dataset.col));
  });

  document.getElementById('filter-reset').addEventListener('click', () => {
    document.getElementById('filter-nombre').value = '';
    document.getElementById('filter-tasa').value   = '0';
    sortCol = 'con_muertos';
    sortDir = 'desc';
    document.querySelectorAll('.filter-pill').forEach(p =>
      p.classList.toggle('active', p.dataset.sort === 'con_muertos'));
    document.querySelectorAll('.data-table th.sortable').forEach(th =>
      th.classList.remove('sort-asc', 'sort-desc'));
    applyFilters();
  });

  // Estado inicial
  setSortCol('con_muertos');
}

/* ─── INIT ───────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderKPIs();
  renderTendencia();
  renderEvolucion();
  renderHoraFatal();
  renderHora();
  renderCausas();
  renderActores();
  renderHipotesis();
  initTable();
});
