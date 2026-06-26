/**
 * Abu Dhabi Market Report — chart renderer
 * Loads annual.json + halfyear.json (+ rolling12.json 附录)
 */
(function () {
  'use strict';

  const COLORS = {
    primary: '#0d4f3c',
    primaryLight: '#1a6b52',
    accent: '#c9a227',
    apt: '#1a6b52',
    villa: '#c9a227',
    offplan: '#0d4f3c',
    ready: '#94a3b8',
    emirati: '#64748b',
    resident: '#0d4f3c',
    fdi: '#c9a227',
    primaryMarket: '#0d4f3c',
    secondaryMarket: '#64748b',
    muted: '#64748b',
    grid: '#e8ede9',
  };

  const DISTRICT_ZH = {
    'Al Reem Island': '里姆岛',
    'Yas Island': '亚斯岛',
    'Al Saadiyat Island': '萨迪亚特岛',
    'Al Maryah Island': '玛丽亚岛',
    'Al Rahah': '阿尔拉哈',
    'Al Hidayriyyat': '胡代里亚特岛',
    'Ramhan Island': '拉姆汉岛',
    'Masdar City': '马斯达尔城',
    'Al Reef': 'Al Reef',
    'Al Layyan': 'Al Layyan',
    'Al Bahyah': '巴希亚',
    'Khalifa City': '哈立德城',
    'Fahid Island': '法希德岛',
    'Ghantout': 'Ghantout',
    'Zayed City': '扎耶德城',
    'Al Shamkhah': '沙姆哈',
    'Al Jubail Island': '朱拜勒岛',
    '其他区域': '其他区域',
  };

  Chart.defaults.font.family =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = COLORS.muted;

  const charts = [];
  const t = (k, vars) => (window.SiteI18n ? SiteI18n.t(k, vars) : k);
  const isEn = () => window.SiteI18n && SiteI18n.getLang() === 'en';

  function fmt(n) {
    const locale = window.SiteI18n && SiteI18n.getLang() === 'en' ? 'en-US' : 'zh-CN';
    return Number(n).toLocaleString(locale);
  }

  function zhLabels(labels) {
    if (isEn()) return labels.slice();
    return labels.map((l) => {
      const z = DISTRICT_ZH[l];
      return z && z !== l ? `${z}` : l;
    });
  }

  function formatMonthLabels(labels) {
    if (!isEn()) return labels;
    return labels.map((label) => {
      const m = /^(\d+)月'(\d+)$/.exec(label);
      if (!m) return label;
      return `${m[1]}/${m[2]}`;
    });
  }

  function buyerLabels(annual) {
    if (!isEn()) return annual.buyers.labels;
    return [t('chart.buyer.resident'), t('chart.buyer.local'), t('chart.buyer.fdi')];
  }

  function linearTrend(data) {
    const points = data
      .map((y, x) => (y != null && !Number.isNaN(y) ? { x, y } : null))
      .filter(Boolean);
    if (points.length < 2) return data.map(() => null);
    const meanX = points.reduce((s, p) => s + p.x, 0) / points.length;
    const meanY = points.reduce((s, p) => s + p.y, 0) / points.length;
    let num = 0;
    let den = 0;
    points.forEach(({ x, y }) => {
      num += (x - meanX) * (y - meanY);
      den += (x - meanX) ** 2;
    });
    const slope = num / den;
    const intercept = meanY - slope * meanX;
    return data.map((y, x) =>
      y != null && !Number.isNaN(y) ? parseFloat((intercept + slope * x).toFixed(2)) : null
    );
  }

  function destroyCharts() {
    charts.forEach((c) => c.destroy());
    charts.length = 0;
    priceCharts.all = null;
    priceCharts.iz = null;
  }

  function track(chart) {
    charts.push(chart);
    return chart;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function renderMacroKpis(annual) {
    const k = annual.kpi;
    const grid = document.getElementById('macro-kpis');
    if (!grid) return;

    const items = [
      { value: `${k.transactionValueAedYi} ${t('unit.yi')}`, label: t('kpi.macro.value.label'), sub: t('kpi.macro.value.sub', { pct: k.transactionValueYoY }), cls: 'gold' },
      { value: `${k.offPlanSharePct}%`, label: t('kpi.macro.offplan.label'), sub: t('kpi.macro.offplan.sub', { pct: k.cashSharePct }), cls: '' },
      { value: `${annual.buyers.sharePct2025[0]}%`, label: t('kpi.macro.buyer.label'), sub: t('kpi.macro.buyer.sub', { pct: annual.buyers.sharePct2025[2] }), cls: '' },
      { value: `${k.populationEmirateMn} ${t('unit.million')}`, label: t('kpi.macro.population.label'), sub: t('kpi.macro.population.sub', { pct: k.populationVsDubaiPct }), cls: '' },
      { value: `${k.occupiedGrowthPct}%`, label: t('kpi.macro.occupied.label'), sub: t('kpi.macro.occupied.sub', { pct: k.supplyGrowthPct }), cls: 'warn' },
    ];

    grid.innerHTML = items
      .map(
        (item) => `
      <div class="stat-card ${item.cls}">
        <div class="stat-value">${item.value}</div>
        <div class="stat-label">${item.label}</div>
        ${item.sub ? `<div class="stat-sub">${item.sub}</div>` : ''}
      </div>`
      )
      .join('');

    setText('data-updated', annual.meta.updated);
    setText('annual-source', annual.meta.source);
  }

  function renderHalfYearKpis(hy) {
    const all = hy.all.summary;
    const iz = hy.investmentZone.summary;
    const grid = document.getElementById('halfyear-kpis');
    if (!grid) return;

    const items = [
      { value: fmt(all.totalTransactions), label: t('kpi.half.total.label'), sub: t('kpi.half.total.sub', { tx: fmt(iz.totalTransactions), pct: hy.compare.izShareOfTransactionsPct }), cls: '' },
      { value: `${all.totalValueAedYi} ${t('unit.yi')}`, label: t('kpi.half.value.label'), sub: t('kpi.half.value.sub', { value: iz.totalValueAedYi }), cls: 'gold' },
      { value: `${iz.offPlanSharePct}%`, label: t('kpi.half.offplan.label'), sub: t('kpi.half.offplan.sub', { pct: all.offPlanSharePct }), cls: '' },
      { value: `${iz.primarySharePct}%`, label: t('kpi.half.primary.label'), sub: t('kpi.half.primary.sub', { pct: iz.secondarySharePct }), cls: '' },
      { value: `+${iz.aptPriceChangePct}%`, label: t('kpi.half.apt.label'), sub: `${fmt(iz.aptPriceStart)} → ${fmt(iz.aptPriceEnd)}`, cls: '' },
      { value: `${iz.villaPriceChangePct >= 0 ? '+' : ''}${iz.villaPriceChangePct}%`, label: t('kpi.half.villa.label'), sub: `${fmt(iz.villaPriceStart)} → ${fmt(iz.villaPriceEnd)}`, cls: '' },
    ];

    grid.innerHTML = items
      .map(
        (item) => `
      <div class="stat-card ${item.cls}">
        <div class="stat-value">${item.value}</div>
        <div class="stat-label">${item.label}</div>
        ${item.sub ? `<div class="stat-sub">${item.sub}</div>` : ''}
      </div>`
      )
      .join('');

    setText('halfyear-period', isEn() ? `${hy.meta.periodStart} — ${hy.meta.periodEnd}` : hy.meta.periodLabel);
    setText('halfyear-source', hy.meta.source);
    setText('excluded-projects', hy.meta.excludedProjects.join(isEn() ? ', ' : '、'));

    const sticky = document.getElementById('sticky-summary');
    if (sticky) {
      sticky.innerHTML = `
        <span><a href="#part-report" style="color:inherit;text-decoration:none">${t('sticky.report')}</a> 761${t('unit.yi')} · 51%</span>
        <span><a href="#part-data" style="color:inherit;text-decoration:none">${t('sticky.data')}</a> <strong>${fmt(iz.totalTransactions)}</strong> ${t('unit.tx')}</span>
        <span><strong>${iz.offPlanSharePct}%</strong> ${t('sticky.offplan')}</span>
      `;
    }
  }

  function renderCrossRef(annual, hy) {
    const grid = document.getElementById('crossref-grid');
    if (!grid) return;
    const all = hy.all.summary;
    const iz = hy.investmentZone.summary;
    const izRegions = hy.investmentZone.regions;
    const cr = hy.adrecCrossRef;
    const rows = [
      { label: t('cross.row1.label'), annual: t('cross.row1.annual', { pct: cr.annualOffPlanPct2025 }), half: t('cross.row1.half', { all: all.offPlanSharePct, iz: iz.offPlanSharePct }), note: t('cross.row1.note') },
      { label: t('cross.row2.label'), annual: t('cross.row2.annual', { pct: annual.kpi.cashSharePct }), half: t('common.na'), note: t('cross.row2.note') },
      { label: t('cross.row3.label'), annual: t('cross.row3.annual', { value: cr.annualTransactionValueAedYi }), half: t('cross.row3.half', { all: all.totalValueAedYi, iz: iz.totalValueAedYi }), note: t('cross.row3.note') },
      { label: t('cross.row4.label'), annual: t('cross.row4.annual', { pct: cr.stockShareInvestmentZonePct }), half: t('cross.row4.half', { pct: hy.compare.izShareOfTransactionsPct }), note: t('cross.row4.note') },
      { label: t('cross.row5.label'), annual: t('cross.row5.annual', { resident: annual.buyers.sharePct2025[0], local: annual.buyers.sharePct2025[1] }), half: t('common.na'), note: t('cross.row5.note') },
      { label: t('cross.row6.label'), annual: t('cross.row6.annual'), half: t('cross.row6.half', { pct: izRegions.apartment.topThreeSharePct }), note: t('cross.row6.note') },
    ];

    grid.innerHTML = rows
      .map(
        (r) => `
      <div class="crossref-row">
        <div class="crossref-label">${r.label}</div>
        <div class="crossref-annual">${r.annual}</div>
        <div class="crossref-half">${r.half}</div>
        <div class="crossref-note">${r.note}</div>
      </div>`
      )
      .join('');

    setText(
      'crossref-note',
      isEn()
        ? t('cross.dynamic.note', { pct: hy.compare.izShareOfTransactionsPct, stock: cr.stockShareInvestmentZonePct })
        : cr.note
    );
  }

  function renderInvestmentZoneSection(hy) {
    const iz = hy.investmentZone;
    const cmp = hy.compare;
    const s = iz.summary;

    const periodLabel = isEn() ? `${hy.meta.periodStart} — ${hy.meta.periodEnd}` : hy.meta.periodLabel;
    setText('iz-period-note', `${periodLabel} · ${t('common.excluded')} ${hy.meta.excludedProjects.join(isEn() ? ', ' : '、')}`);

    const kpiGrid = document.getElementById('iz-kpis');
    if (kpiGrid) {
      kpiGrid.innerHTML = [
        { value: fmt(s.totalTransactions), label: t('kpi.iz.total.label'), sub: t('kpi.iz.total.sub', { pct: cmp.izShareOfTransactionsPct }) },
        { value: `${s.offPlanSharePct}%`, label: t('kpi.iz.offplan.label'), sub: t('kpi.iz.offplan.sub', { pct: s.offPlanAptPct }) },
        { value: `${s.primarySharePct}%`, label: t('kpi.iz.primary.label'), sub: t('kpi.iz.primary.sub', { month: s.peakMonth }) },
        { value: `+${s.aptPriceChangePct}%`, label: t('kpi.iz.apt.label'), sub: t('kpi.iz.apt.sub') },
      ]
        .map(
          (item) => `
        <div class="stat-card">
          <div class="stat-value">${item.value}</div>
          <div class="stat-label">${item.label}</div>
          <div class="stat-sub">${item.sub}</div>
        </div>`
        )
        .join('');
    }

    const nonIzEl = document.getElementById('non-iz-districts');
    if (nonIzEl && cmp.topNonIzDistricts?.length) {
      nonIzEl.innerHTML = cmp.topNonIzDistricts
        .map((d) => `<li><strong>${zhLabels([d.district])[0]}</strong>: ${fmt(d.count)} ${t('unit.tx')}</li>`)
        .join('');
    }

    renderVolumeChart(iz, 'barChartIz');
    renderStructureCharts(iz, 'Iz');
    priceCharts.iz = renderPriceChart(iz, 'lineChartIz', priceMode);
    renderRegionCharts(iz, 'Iz');

    track(
      new Chart(document.getElementById('pieIzShare'), {
        type: 'doughnut',
        data: {
          labels: [
            t('chart.iz.share.in', { pct: cmp.izShareOfTransactionsPct }),
            t('chart.iz.share.out', { pct: Math.round((100 - cmp.izShareOfTransactionsPct) * 10) / 10 }),
          ],
          datasets: [{
            data: [s.totalTransactions, cmp.nonIzTransactions],
            backgroundColor: [COLORS.primary, '#cbd5e1'],
            borderWidth: 2,
            borderColor: '#fff',
          }],
        },
        options: { responsive: true, maintainAspectRatio: true, cutout: '55%', plugins: { legend: { position: 'bottom' } } },
      })
    );
  }

  function renderBuyerCharts(annual) {
    const b = annual.buyers;
    const labels = buyerLabels(annual);

    track(
      new Chart(document.getElementById('buyerPie'), {
        type: 'doughnut',
        data: {
          labels: labels.map((l, i) => `${l} ${b.sharePct2025[i]}%`),
          datasets: [{ data: b.sharePct2025, backgroundColor: [COLORS.resident, COLORS.emirati, COLORS.fdi], borderWidth: 2, borderColor: '#fff' }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '58%',
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.label} (${b.valueAedYi2025[ctx.dataIndex]} ${t('unit.yi')} AED)` } },
          },
        },
      })
    );

    track(
      new Chart(document.getElementById('buyerTrend'), {
        type: 'bar',
        data: {
          labels: ['2019', '2025'],
          datasets: [
            { label: labels[0], data: [b.sharePct2019[0], b.sharePct2025[0]], backgroundColor: COLORS.resident, borderRadius: 4 },
            { label: labels[1], data: [b.sharePct2019[1], b.sharePct2025[1]], backgroundColor: COLORS.emirati, borderRadius: 4 },
            { label: labels[2], data: [b.sharePct2019[2], b.sharePct2025[2]], backgroundColor: COLORS.fdi, borderRadius: 4 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color: COLORS.grid }, ticks: { callback: (v) => v + '%' }, max: 70 },
          },
        },
      })
    );
  }

  function renderVolumeChart(micro, canvasId) {
    const m = micro.months;
    track(
      new Chart(document.getElementById(canvasId), {
        type: 'bar',
        data: {
          labels: formatMonthLabels(m.labels),
          datasets: [
            { label: t('chart.apartment'), data: m.apartmentVolume, backgroundColor: COLORS.apt, borderRadius: 3 },
            { label: t('chart.villaTownhouse'), data: m.villaVolume, backgroundColor: COLORS.villa, borderRadius: 3 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, grid: { color: COLORS.grid }, ticks: { callback: (v) => fmt(v) } },
          },
        },
      })
    );
  }

  function renderStructureCharts(micro, suffix = '') {
    const structure = micro.structure;
    const typeTotal = structure.typeSplit.data.reduce((a, b) => a + b, 0);
    const typeLabels = [
      `${t('chart.apartment')} ${Math.round((structure.typeSplit.data[0] / typeTotal) * 1000) / 10}%`,
      `${t('chart.villaTownhouse')} ${Math.round((structure.typeSplit.data[1] / typeTotal) * 1000) / 10}%`,
    ];
    track(
      new Chart(document.getElementById(`pieType${suffix}`), {
        type: 'doughnut',
        data: {
          labels: typeLabels,
          datasets: [{ data: structure.typeSplit.data, backgroundColor: [COLORS.apt, COLORS.villa], borderWidth: 2, borderColor: '#fff' }],
        },
        options: { responsive: true, maintainAspectRatio: true, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } },
      })
    );

    const off = structure.offPlanAll || structure.offPlanApt;
    const offTotal = off.data.reduce((a, b) => a + b, 0);
    const offLabels = [
      `${t('chart.offplan')} ${Math.round((off.data[0] / offTotal) * 1000) / 10}%`,
      `${t('chart.ready')} ${Math.round((off.data[1] / offTotal) * 1000) / 10}%`,
    ];
    track(
      new Chart(document.getElementById(`pieOffplan${suffix}`), {
        type: 'doughnut',
        data: {
          labels: offLabels,
          datasets: [{ data: off.data, backgroundColor: [COLORS.offplan, COLORS.ready], borderWidth: 2, borderColor: '#fff' }],
        },
        options: { responsive: true, maintainAspectRatio: true, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } },
      })
    );

    if (structure.saleSequence) {
      const total = structure.saleSequence.data.reduce((a, b) => a + b, 0);
      track(
        new Chart(document.getElementById(`piePrimary${suffix}`), {
          type: 'doughnut',
          data: {
            labels: [
              `${t('chart.primary')} ${Math.round((structure.saleSequence.data[0] / total) * 1000) / 10}%`,
              `${t('chart.secondary')} ${Math.round((structure.saleSequence.data[1] / total) * 1000) / 10}%`,
            ],
            datasets: [{ data: structure.saleSequence.data, backgroundColor: [COLORS.primaryMarket, COLORS.secondaryMarket], borderWidth: 2, borderColor: '#fff' }],
          },
          options: { responsive: true, maintainAspectRatio: true, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } },
        })
      );
    }
  }

  const priceCharts = { all: null, iz: null };
  let halfyearRef = null;
  let priceMode = 'all';

  const PRICE_NOTES = {
    all: {
      main: 'note.price.main.all',
      iz: 'note.price.iz.all',
    },
    primary: {
      main: 'note.price.main.primary',
      iz: 'note.price.iz.primary',
    },
    secondary: {
      main: 'note.price.main.secondary',
      iz: 'note.price.iz.secondary',
    },
  };

  function getPriceSeries(months, mode) {
    if (mode === 'primary' && months.primary) {
      return { apt: months.primary.apartmentPriceSqmK, villa: months.primary.villaPriceSqmK };
    }
    if (mode === 'secondary' && months.secondary) {
      return { apt: months.secondary.apartmentPriceSqmK, villa: months.secondary.villaPriceSqmK };
    }
    return { apt: months.apartmentPriceSqmK, villa: months.villaPriceSqmK };
  }

  function priceChartDatasets(months, mode) {
    const { apt, villa } = getPriceSeries(months, mode);
    return [
      { label: t('chart.apartment'), data: apt, borderColor: COLORS.apt, backgroundColor: 'rgba(26,107,82,0.08)', borderWidth: 2, pointRadius: 3, fill: true, tension: 0.4, spanGaps: false },
      { label: t('chart.villaTownhouse'), data: villa, borderColor: COLORS.villa, backgroundColor: 'rgba(201,162,39,0.1)', borderWidth: 2, pointRadius: 3, fill: true, tension: 0.4, spanGaps: false },
      { label: t('chart.apartmentTrend'), data: linearTrend(apt), borderColor: '#8fb8a8', borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: false, tension: 0, spanGaps: false },
      { label: t('chart.villaTrend'), data: linearTrend(villa), borderColor: '#dcc67a', borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: false, tension: 0, spanGaps: false },
    ];
  }

  function renderPriceChart(micro, canvasId, mode = 'all') {
    const m = micro.months;
    return track(
      new Chart(document.getElementById(canvasId), {
        type: 'line',
        data: { labels: formatMonthLabels(m.labels), datasets: priceChartDatasets(m, mode) },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              filter: (item) => !item.dataset.label.includes(t('chart.trendKeyword')),
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y;
                  return v == null ? ` ${ctx.dataset.label}: ${t('common.noTransaction')}` : ` ${ctx.dataset.label}: ${v}K AED/m²`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color: COLORS.grid }, ticks: { callback: (v) => v + 'K' } },
          },
        },
      })
    );
  }

  function updatePriceCharts(mode) {
    priceMode = mode;
    if (halfyearRef) {
      const pairs = [
        { chart: priceCharts.all, micro: halfyearRef.all },
        { chart: priceCharts.iz, micro: halfyearRef.investmentZone },
      ];
      pairs.forEach(({ chart, micro }) => {
        if (!chart || !micro?.months) return;
        chart.data.datasets = priceChartDatasets(micro.months, mode);
        chart.update();
      });
    }
    const notes = PRICE_NOTES[mode] || PRICE_NOTES.all;
    setText('price-note', t(notes.main));
    setText('price-note-iz', t(notes.iz));
    document.querySelectorAll('.price-filter .price-filter-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  function setupPriceFilter() {
    document.querySelectorAll('.price-filter').forEach((filter) => {
      if (filter.dataset.bound === '1') return;
      filter.dataset.bound = '1';
      filter.addEventListener('click', (e) => {
        const btn = e.target.closest('.price-filter-btn');
        if (!btn || btn.dataset.mode === priceMode) return;
        updatePriceCharts(btn.dataset.mode);
      });
    });
  }

  function regionBarColors(labels, highlight, originalLabels) {
    const src = originalLabels || labels;
    return src.map((_, i) => (highlight && highlight.includes(i) ? COLORS.primary : COLORS.primaryLight));
  }

  function renderRegionCharts(micro, suffix = '') {
    if (!micro?.regions?.apartment || !micro?.regions?.villa) return;
    const apt = micro.regions.apartment;
    const villa = micro.regions.villa;
    const aptLabels = zhLabels(apt.labels);

    track(
      new Chart(document.getElementById(`barApt${suffix}`), {
        type: 'bar',
        data: {
          labels: aptLabels,
          datasets: [{ label: t('chart.transactions'), data: apt.data, backgroundColor: regionBarColors(aptLabels, apt.highlight, apt.labels), borderRadius: 4 }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: COLORS.grid }, ticks: { callback: (v) => fmt(v) } },
            y: { grid: { display: false } },
          },
        },
      })
    );

    track(
      new Chart(document.getElementById(`barVilla${suffix}`), {
        type: 'bar',
        data: {
          labels: zhLabels(villa.labels),
          datasets: [{ label: t('chart.transactions'), data: villa.data, backgroundColor: COLORS.villa, borderRadius: 4 }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: COLORS.grid }, ticks: { callback: (v) => fmt(v) } },
            y: { grid: { display: false } },
          },
        },
      })
    );
  }

  function renderObservations(annual) {
    const grid = document.getElementById('observations-grid');
    if (!grid) return;
    grid.innerHTML = annual.observations
      .map(
        (o, idx) => `
      <article class="obs-card">
        <div class="obs-head"><span class="obs-icon">${o.icon}</span><h3>${t(`obs.${idx}.title`, null) === `obs.${idx}.title` ? o.title : t(`obs.${idx}.title`)}</h3></div>
        <p class="obs-data"><strong>${t('obs.dataLabel')}</strong>${t(`obs.${idx}.data`, null) === `obs.${idx}.data` ? o.data : t(`obs.${idx}.data`)}</p>
        <p class="obs-meaning"><strong>${t('obs.meaningLabel')}</strong>${t(`obs.${idx}.meaning`, null) === `obs.${idx}.meaning` ? o.meaning : t(`obs.${idx}.meaning`)}</p>
        <p class="obs-caveat"><strong>${t('obs.caveatLabel')}</strong>${t(`obs.${idx}.caveat`, null) === `obs.${idx}.caveat` ? o.caveat : t(`obs.${idx}.caveat`)}</p>
      </article>`
      )
      .join('');
  }

  function renderSupplyVisual(annual) {
    const k = annual.kpi;
    const bars = document.getElementById('supply-bars');
    if (!bars) return;
    const max = Math.max(k.occupiedGrowthPct, k.supplyGrowthPct);
    bars.innerHTML = [
      { label: t('supply.bar.occupied'), value: k.occupiedGrowthPct, cls: 'occupied' },
      { label: t('supply.bar.new'), value: k.supplyGrowthPct, cls: 'supply' },
    ]
      .map(
        (item) => `
      <div class="supply-row">
        <span class="supply-label">${item.label}</span>
        <div class="supply-track"><div class="supply-fill ${item.cls}" style="width:${(item.value / max) * 100}%"></div></div>
        <span class="supply-val">${item.value}%</span>
      </div>`
      )
      .join('');
  }

  function renderRollingAppendix(rolling) {
    const el = document.getElementById('rolling-appendix-body');
    if (!el) return;
    const s = rolling.summary;
    el.innerHTML = `
      <p class="card-note" style="margin-top:0">${t('appendix.period', { start: rolling.meta.periodStart, end: rolling.meta.periodEnd })}</p>
      <div class="kpi-grid" style="margin:12px 0">
        <div class="stat-card"><div class="stat-value">${fmt(s.totalTransactions)}</div><div class="stat-label">${t('appendix.kpi.tx12m')}</div></div>
        <div class="stat-card"><div class="stat-value">${s.offPlanSharePct}%</div><div class="stat-label">${t('appendix.kpi.offplan')}</div></div>
        <div class="stat-card"><div class="stat-value">+${s.aptPriceChangePct}%</div><div class="stat-label">${t('appendix.kpi.apt')}</div></div>
        <div class="stat-card"><div class="stat-value">+${s.villaPriceChangePct}%</div><div class="stat-label">${t('appendix.kpi.villa')}</div></div>
      </div>
      <div class="chart-wrap" style="height:220px"><canvas id="barChart12"></canvas></div>
    `;
    renderVolumeChart(rolling, 'barChart12');
  }

  function setupNav() {
    const nav = document.getElementById('section-nav');
    if (!nav || nav.dataset.bound === '1') return;
    nav.dataset.bound = '1';
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = link.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' });
      });
    });
    const sections = ['macro', 'supply', 'buyers', 'observations', 'crossref', 'volume', 'structure', 'price', 'regions', 'investment-zone'];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  function setupCollapsibles() {
    document.querySelectorAll('[data-collapse]').forEach((btn) => {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      btn.addEventListener('click', () => {
        const open = panel.hidden;
        panel.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
      });
    });
  }

  function setupMethodology(annual, hy, rolling) {
    const body = document.getElementById('methodology-body');
    if (!body) return;
    body.innerHTML = `
      <h4>${t('method.l1.title')}</h4>
      <ul>
        <li>${t('method.source')}${annual.meta.source}</li>
        <li>${t('method.l1.v1', { value: annual.kpi.transactionValueAedYi })}</li>
        <li>${t('method.l1.v2')}</li>
      </ul>
      <h4>${t('method.l2.title', { period: hy.meta.periodLabel })}</h4>
      <ul>
        <li>${t('method.source')}${hy.meta.source}</li>
        <li>${t('method.l2.v1', { value: hy.all.summary.totalValueAedYi })}</li>
        <li>${t('method.l2.v2', { list: hy.meta.excludedProjects.join(isEn() ? ', ' : '、') })}</li>
        <li>${t('method.l2.v3', { count: hy.meta.investmentZoneDistricts })}</li>
        <li>${t('method.l2.v4', { all: hy.all.summary.totalTransactions, iz: hy.investmentZone.summary.totalTransactions, pct: hy.compare.izShareOfTransactionsPct })}</li>
        <li>${t('method.l2.v5')}</li>
      </ul>
      <h4>${t('method.l3.title', { start: rolling.meta.periodStart, end: rolling.meta.periodEnd })}</h4>
      <ul><li>${t('method.l3.v1')}</li></ul>
    `;
  }

  async function loadData() {
    const base = document.querySelector('script[data-base]')?.dataset.base || '.';
    const fetchJson = (path) => fetch(`${base}/data/${path}`).then((r) => { if (!r.ok) throw new Error(path); return r.json(); });
    const [annual, halfyear, rolling] = await Promise.all([fetchJson('annual.json'), fetchJson('halfyear.json'), fetchJson('rolling12.json')]);
    return { annual, halfyear, rolling };
  }

  function showError(err) {
    const el = document.getElementById('load-error');
    if (el) { el.hidden = false; el.textContent = t('error.load', { msg: err.message }); }
  }

  async function init() {
    try {
      destroyCharts();
      const { annual, halfyear, rolling } = await loadData();
      if (!halfyear?.all || !halfyear?.investmentZone) {
        throw new Error(t('error.halfyearInvalid'));
      }
      halfyearRef = halfyear;
      priceMode = 'all';
      renderMacroKpis(annual);
      renderHalfYearKpis(halfyear);
      renderCrossRef(annual, halfyear);
      renderSupplyVisual(annual);
      renderBuyerCharts(annual);
      renderVolumeChart(halfyear.all, 'barChart');
      renderInvestmentZoneSection(halfyear);
      renderStructureCharts(halfyear.all);
      priceCharts.all = renderPriceChart(halfyear.all, 'lineChart', priceMode);
      renderRegionCharts(halfyear.all);
      renderObservations(annual);
      renderRollingAppendix(rolling);
      setupMethodology(annual, halfyear, rolling);
      setupPriceFilter();
      updatePriceCharts(priceMode);
      setupNav();
      setupCollapsibles();
      document.getElementById('app')?.classList.remove('loading');
    } catch (err) {
      console.error(err);
      showError(err);
    }
  }

  window.addEventListener('site-lang-change', () => {
    if (halfyearRef) init();
  });

  init();
})();
