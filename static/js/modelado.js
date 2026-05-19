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

/* ─── CLASE × GRAVEDAD (fact ⋈ dim_clase ⋈ dim_gravedad) ────────────────────── */
function renderClaseGravedad() {
  const totalesPorClase = {};
  DATA_CLASE_GRAVEDAD.forEach(d => {
    totalesPorClase[d.clase] = (totalesPorClase[d.clase] || 0) + d.total;
  });
  const clases = Object.keys(totalesPorClase).sort((a, b) => totalesPorClase[b] - totalesPorClase[a]);

  const gravedades  = ['Solo Daños', 'Con Heridos', 'Con Muertos'];
  const graveColors = { 'Con Muertos': C_RED, 'Con Heridos': C_AMBER, 'Solo Daños': 'rgba(59,130,246,0.6)' };

  const datasets = gravedades.map(g => ({
    label: g,
    data: clases.map(c => {
      const r = DATA_CLASE_GRAVEDAD.find(d => d.clase === c && d.gravedad === g);
      return r ? r.total : 0;
    }),
    backgroundColor: graveColors[g],
    borderWidth: 0,
    borderRadius: 2,
  }));

  new Chart(document.getElementById('chart-clase-gravedad'), {
    type: 'bar',
    data: { labels: clases, datasets },
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
            footer: items => {
              const total = items.reduce((s, i) => s + i.parsed.x, 0);
              const pct   = ((items[0].parsed.x / total) * 100).toFixed(1);
              return `Total clase: ${fmt(totalesPorClase[items[0].label])}`;
            },
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

/* ─── EVOLUCIÓN ANUAL % NORMALIZADO (fact ⋈ dim_fecha ⋈ dim_gravedad) ──────── */
function renderEvolucion() {
  const anios = [...new Set(DATA_EVOLUCION.map(d => d.anio))].sort();
  const gravedades  = ['Con Muertos', 'Con Heridos', 'Solo Daños'];
  const graveColors = { 'Con Muertos': C_RED, 'Con Heridos': C_AMBER, 'Solo Daños': 'rgba(59,130,246,0.6)' };

  /* Calcular totales por año para normalizar */
  const totalAnio = {};
  anios.forEach(a => {
    totalAnio[a] = DATA_EVOLUCION.filter(d => d.anio === a).reduce((s, d) => s + d.total, 0);
  });

  const datasets = gravedades.map(g => ({
    label: g,
    data: anios.map(a => {
      const r = DATA_EVOLUCION.find(d => d.anio === a && d.descripcion === g);
      return r && totalAnio[a] ? +((r.total / totalAnio[a]) * 100).toFixed(2) : 0;
    }),
    backgroundColor: graveColors[g],
    borderColor: graveColors[g],
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
        legend: { position: 'top', labels: { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 9 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
          },
        },
      },
      scales: {
        x: { stacked: true, grid: GRID, ticks: TICKS },
        y: { stacked: true, grid: GRID, min: 0, max: 100, ticks: { ...TICKS, callback: v => v + '%' } },
      },
    },
  });
}

/* ─── HORA FATAL DUAL AXIS (fact ⋈ dim_gravedad GROUP BY hora) ──────────────── */
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
          backgroundColor: 'rgba(59,130,246,0.22)',
          borderWidth: 0,
          borderRadius: 2,
          yAxisID: 'y',
        },
        {
          label: 'Con muertos',
          data: muertos,
          type: 'line',
          borderColor: C_RED,
          backgroundColor: 'rgba(239,68,68,0.08)',
          borderWidth: 2,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: true,
          yAxisID: 'y2',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: '#6b82a8', font: { family: "'DM Mono', monospace", size: 10 } } },
        tooltip: {
          callbacks: {
            label: ctx => ctx.datasetIndex === 0
              ? ` Total: ${fmt(ctx.parsed.y)}`
              : ` Con muertos: ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x:  { grid: GRID, ticks: { ...TICKS, font: { size: 9 }, maxRotation: 0 } },
        y:  { grid: GRID, ticks: { ...TICKS, callback: v => fmt(v) }, position: 'left' },
        y2: { grid: { display: false }, ticks: { ...TICKS, color: C_RED + 'bb' }, position: 'right' },
      },
    },
  });
}

/* ─── CAUSAS FATALES (fact ⋈ dim_hipotesis ⋈ dim_gravedad WHERE nivel=1) ─────── */
function renderCausas() {
  const labels = DATA_CAUSAS.map(d => d.descripcion.length > 44 ? d.descripcion.slice(0,44)+'…' : d.descripcion);
  new Chart(document.getElementById('chart-causas'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Accidentes mortales',
        data: DATA_CAUSAS.map(d => d.total),
        backgroundColor: C_RED + '88',
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

/* ─── TASA DE MORTALIDAD POR ACTOR VIAL (fact ⋈ dim_actor) ─────────────────── */
function renderActorFatalidad() {
  const byCondicion = {};
  DATA_ACTORES.forEach(d => {
    if (!byCondicion[d.condicion]) byCondicion[d.condicion] = { muertos: 0, heridos: 0, ilesos: 0, total: 0 };
    byCondicion[d.condicion].total += d.total;
    if (d.estado === 'MUERTO') byCondicion[d.condicion].muertos = d.total;
    if (d.estado === 'HERIDO') byCondicion[d.condicion].heridos = d.total;
    if (d.estado === 'ILESO')  byCondicion[d.condicion].ilesos  = d.total;
  });

  const MAP = {
    CONDUCTOR: 'Conductor', MOTOCICLISTA: 'Motociclista',
    'PASAJERO/ACOMPAÑANTE': 'Pasajero', PEATON: 'Peatón', CICLISTA: 'Ciclista',
  };

  const data = Object.entries(byCondicion)
    .map(([c, v]) => ({
      label: MAP[c] || c,
      tasa: v.total > 0 ? +(v.muertos / v.total * 1000).toFixed(2) : 0,
      muertos: v.muertos,
      total: v.total,
    }))
    .sort((a, b) => b.tasa - a.tasa);

  const maxTasa = Math.max(...data.map(d => d.tasa));
  const bgColors = data.map(d => {
    const r = d.tasa / maxTasa;
    if (r > 0.7) return C_RED;
    if (r > 0.4) return C_AMBER;
    return C_SKY;
  });

  new Chart(document.getElementById('chart-actor-fatalidad'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Tasa mortalidad (‰)',
        data: data.map(d => d.tasa),
        backgroundColor: bgColors,
        borderWidth: 0,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.y.toFixed(2)}‰ de mortalidad`,
            afterLabel: ctx => {
              const d = data[ctx.dataIndex];
              return ` ${fmt(d.muertos)} muertos de ${fmt(d.total)} actores`;
            },
          },
        },
      },
      scales: {
        x: { grid: GRID, ticks: TICKS },
        y: { grid: GRID, ticks: { ...TICKS, callback: v => v.toFixed(1) + '‰' }, min: 0 },
      },
    },
  });
}

/* ─── TABLA CON FILTROS Y ORDEN ─────────────────────────────────────────────── */
function initTable() {
  let sortCol = 'con_muertos';
  let sortDir = 'desc';

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

  function applyFilters() {
    const nombre  = document.getElementById('filter-nombre').value.trim().toLowerCase();
    const tasaMin = parseFloat(document.getElementById('filter-tasa').value) || 0;
    const tbody   = document.getElementById('tabla-body');
    const rows    = [...tbody.querySelectorAll('tr')];

    let visible = 0;
    rows.forEach(row => {
      const matchNombre = row.dataset.nombre.toLowerCase().includes(nombre);
      const matchTasa   = parseFloat(row.dataset.tasa_mortalidad) >= tasaMin;
      const show = matchNombre && matchTasa;
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });

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
    rows.filter(r => r.style.display === 'none').forEach(r => tbody.appendChild(r));

    document.getElementById('filter-count').textContent =
      visible === DATA_TABLA.length ? `${visible} localidades` : `${visible} de ${DATA_TABLA.length}`;
    document.getElementById('table-empty').style.display = visible === 0 ? '' : 'none';
  }

  function setSortCol(col) {
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = col === 'nombre' ? 'asc' : 'desc';
    }
    document.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.sort === col);
    });
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
    });
    const th = document.querySelector(`th[data-col="${col}"]`);
    if (th) th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    applyFilters();
  }

  document.getElementById('filter-nombre').addEventListener('input', applyFilters);
  document.getElementById('filter-tasa').addEventListener('change', applyFilters);
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

  setSortCol('con_muertos');
}

/* ─── INIT ───────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderKPIs();
  renderClaseGravedad();
  renderHoraFatal();
  renderEvolucion();
  renderCausas();
  renderActorFatalidad();
  initTable();
});
