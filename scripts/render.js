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

  function fmt(n) {
    return Number(n).toLocaleString('zh-CN');
  }

  function zhLabels(labels) {
    return labels.map((l) => {
      const z = DISTRICT_ZH[l];
      return z && z !== l ? `${z}` : l;
    });
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
      { value: `${k.transactionValueAedYi} 亿`, label: '2025 住宅成交额（亿 AED）', sub: `同比 +${k.transactionValueYoY}%`, cls: 'gold' },
      { value: `${k.offPlanSharePct}%`, label: '全年期房占比', sub: `现金成交 ${k.cashSharePct}%`, cls: '' },
      { value: `${annual.buyers.sharePct2025[0]}%`, label: '居留外籍买家（按金额）', sub: `海外投资 ${annual.buyers.sharePct2025[2]}%`, cls: '' },
      { value: `${k.populationEmirateMn} 百万`, label: '酋长国常住人口', sub: `比迪拜多约 ${k.populationVsDubaiPct}%`, cls: '' },
      { value: `${k.occupiedGrowthPct}%`, label: '入住单元增速', sub: `新增供应仅 ${k.supplyGrowthPct}%`, cls: 'warn' },
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
      { value: fmt(all.totalTransactions), label: '成交总量（已排除三类项目）', sub: `投资区 ${fmt(iz.totalTransactions)} 套（${hy.compare.izShareOfTransactionsPct}%）`, cls: '' },
      { value: `${all.totalValueAedYi} 亿`, label: '成交额 · 全部（亿 AED）', sub: `投资区 ${iz.totalValueAedYi} 亿 · 7 个月`, cls: 'gold' },
      { value: `${iz.offPlanSharePct}%`, label: '期房占比 · 投资区', sub: `全部 ${all.offPlanSharePct}%`, cls: '' },
      { value: `${iz.primarySharePct}%`, label: '一级市场 · 投资区', sub: `二级 ${iz.secondarySharePct}%`, cls: '' },
      { value: `+${iz.aptPriceChangePct}%`, label: '公寓均价 · 投资区', sub: `${fmt(iz.aptPriceStart)} → ${fmt(iz.aptPriceEnd)}`, cls: '' },
      { value: `${iz.villaPriceChangePct >= 0 ? '+' : ''}${iz.villaPriceChangePct}%`, label: '别墅均价 · 投资区', sub: `${fmt(iz.villaPriceStart)} → ${fmt(iz.villaPriceEnd)}`, cls: '' },
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

    setText('halfyear-period', hy.meta.periodLabel);
    setText('halfyear-source', hy.meta.source);
    setText('excluded-projects', hy.meta.excludedProjects.join('、'));

    const sticky = document.getElementById('sticky-summary');
    if (sticky) {
      sticky.innerHTML = `
        <span><a href="#part-report" style="color:inherit;text-decoration:none">报告</a> 761亿 · 51%居留</span>
        <span><a href="#part-data" style="color:inherit;text-decoration:none">数据</a> <strong>${fmt(iz.totalTransactions)}</strong> 套</span>
        <span><strong>${iz.offPlanSharePct}%</strong> 期房</span>
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
      { label: '期房占比', annual: `${cr.annualOffPlanPct2025}%（2025全年）`, half: `全部 ${all.offPlanSharePct}% / 投资区 ${iz.offPlanSharePct}%`, note: '投资区新盘推盘更集中' },
      { label: '现金成交', annual: `${annual.kpi.cashSharePct}%（ADREC 2025）`, half: '—', note: '现金占比仅年报披露' },
      { label: '住宅成交额', annual: `${cr.annualTransactionValueAedYi} 亿（2025 全年）`, half: `全部 ${all.totalValueAedYi} 亿 / 投资区 ${iz.totalValueAedYi} 亿（7 个月）`, note: '周期不同，宜比结构不宜比绝对值' },
      { label: '投资区存量', annual: `约占存量 ${cr.stockShareInvestmentZonePct}%`, half: `占近半年成交 ${hy.compare.izShareOfTransactionsPct}%`, note: '小盘子交易更活跃，与存量占比不矛盾' },
      { label: '买家结构', annual: `居留 ${annual.buyers.sharePct2025[0]}% / 本国 ${annual.buyers.sharePct2025[1]}%`, half: '—', note: '国籍拆分见 ADREC 年报' },
      { label: '三岛公寓集中度', annual: '约 72%（ADREC 2025）', half: `投资区内 ${izRegions.apartment.topThreeSharePct}%`, note: '里姆 + 亚斯 + 萨迪亚特' },
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

    setText('crossref-note', cr.note);
  }

  function renderInvestmentZoneSection(hy) {
    const iz = hy.investmentZone;
    const cmp = hy.compare;
    const s = iz.summary;

    setText('iz-period-note', `${hy.meta.periodLabel} · 已排除 ${hy.meta.excludedProjects.join('、')}`);

    const kpiGrid = document.getElementById('iz-kpis');
    if (kpiGrid) {
      kpiGrid.innerHTML = [
        { value: fmt(s.totalTransactions), label: '投资区成交', sub: `占全部 ${cmp.izShareOfTransactionsPct}%` },
        { value: `${s.offPlanSharePct}%`, label: '期房占比', sub: `公寓 ${s.offPlanAptPct}%` },
        { value: `${s.primarySharePct}%`, label: '一级市场', sub: `峰值月 ${s.peakMonth}` },
        { value: `+${s.aptPriceChangePct}%`, label: '公寓均价涨幅', sub: '10月→4月' },
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
        .map((d) => `<li><strong>${DISTRICT_ZH[d.district] || d.district}</strong>：${fmt(d.count)} 套</li>`)
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
          labels: [`投资区 ${cmp.izShareOfTransactionsPct}%`, `非投资区 ${Math.round((100 - cmp.izShareOfTransactionsPct) * 10) / 10}%`],
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

    track(
      new Chart(document.getElementById('buyerPie'), {
        type: 'doughnut',
        data: {
          labels: b.labels.map((l, i) => `${l} ${b.sharePct2025[i]}%`),
          datasets: [{ data: b.sharePct2025, backgroundColor: [COLORS.resident, COLORS.emirati, COLORS.fdi], borderWidth: 2, borderColor: '#fff' }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '58%',
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}（${b.valueAedYi2025[ctx.dataIndex]} 亿 AED）` } },
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
            { label: '居留外籍', data: [b.sharePct2019[0], b.sharePct2025[0]], backgroundColor: COLORS.resident, borderRadius: 4 },
            { label: '本国买家', data: [b.sharePct2019[1], b.sharePct2025[1]], backgroundColor: COLORS.emirati, borderRadius: 4 },
            { label: '海外投资', data: [b.sharePct2019[2], b.sharePct2025[2]], backgroundColor: COLORS.fdi, borderRadius: 4 },
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
          labels: m.labels,
          datasets: [
            { label: '公寓', data: m.apartmentVolume, backgroundColor: COLORS.apt, borderRadius: 3 },
            { label: '别墅/联排', data: m.villaVolume, backgroundColor: COLORS.villa, borderRadius: 3 },
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
    const t = micro.structure;
    track(
      new Chart(document.getElementById(`pieType${suffix}`), {
        type: 'doughnut',
        data: {
          labels: t.typeSplit.labels,
          datasets: [{ data: t.typeSplit.data, backgroundColor: [COLORS.apt, COLORS.villa], borderWidth: 2, borderColor: '#fff' }],
        },
        options: { responsive: true, maintainAspectRatio: true, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } },
      })
    );

    const off = t.offPlanAll || t.offPlanApt;
    track(
      new Chart(document.getElementById(`pieOffplan${suffix}`), {
        type: 'doughnut',
        data: {
          labels: off.labels,
          datasets: [{ data: off.data, backgroundColor: [COLORS.offplan, COLORS.ready], borderWidth: 2, borderColor: '#fff' }],
        },
        options: { responsive: true, maintainAspectRatio: true, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } },
      })
    );

    if (t.saleSequence) {
      track(
        new Chart(document.getElementById(`piePrimary${suffix}`), {
          type: 'doughnut',
          data: {
            labels: t.saleSequence.labels.map((l, i) => `${l} ${Math.round((t.saleSequence.data[i] / t.saleSequence.data.reduce((a, b) => a + b, 0)) * 1000) / 10}%`),
            datasets: [{ data: t.saleSequence.data, backgroundColor: [COLORS.primaryMarket, COLORS.secondaryMarket], borderWidth: 2, borderColor: '#fff' }],
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
      main: '公寓近半年 +15%；3 月峰值 25.8K 后 4 月回落。别墅区间基本持平。',
      iz: '投资区公寓近半年 +15%；3 月峰值 25.8K 后 4 月回落。购前须 DARI 核验单元产权类型。',
    },
    primary: {
      main: '一手（一级市场 primary）：开发商直售为主，均价整体高于二手；公寓 3 月峰值 28.4K。',
      iz: '投资区一手成交占主导；均价走势反映新盘定价与推盘节奏，非单一区域指标。',
    },
    secondary: {
      main: '二手（二级市场 secondary）：样本量约为全部的 23%，均价低于一手；公寓近半年呈温和上行。',
      iz: '投资区二手样本更少，单月波动更大——解读时建议结合成交量与具体 District。',
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
      { label: '公寓', data: apt, borderColor: COLORS.apt, backgroundColor: 'rgba(26,107,82,0.08)', borderWidth: 2, pointRadius: 3, fill: true, tension: 0.4, spanGaps: false },
      { label: '别墅/联排', data: villa, borderColor: COLORS.villa, backgroundColor: 'rgba(201,162,39,0.1)', borderWidth: 2, pointRadius: 3, fill: true, tension: 0.4, spanGaps: false },
      { label: '公寓趋势', data: linearTrend(apt), borderColor: '#8fb8a8', borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: false, tension: 0, spanGaps: false },
      { label: '别墅趋势', data: linearTrend(villa), borderColor: '#dcc67a', borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: false, tension: 0, spanGaps: false },
    ];
  }

  function renderPriceChart(micro, canvasId, mode = 'all') {
    const m = micro.months;
    return track(
      new Chart(document.getElementById(canvasId), {
        type: 'line',
        data: { labels: m.labels, datasets: priceChartDatasets(m, mode) },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              filter: (item) => !item.dataset.label.includes('趋势'),
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y;
                  return v == null ? ` ${ctx.dataset.label}: 无成交` : ` ${ctx.dataset.label}: ${v}K AED/m²`;
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
    setText('price-note', notes.main);
    setText('price-note-iz', notes.iz);
    document.querySelectorAll('.price-filter .price-filter-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  function setupPriceFilter() {
    document.querySelectorAll('.price-filter').forEach((filter) => {
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
          datasets: [{ label: '成交套数', data: apt.data, backgroundColor: regionBarColors(aptLabels, apt.highlight, apt.labels), borderRadius: 4 }],
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
          datasets: [{ label: '成交套数', data: villa.data, backgroundColor: COLORS.villa, borderRadius: 4 }],
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
        (o) => `
      <article class="obs-card">
        <div class="obs-head"><span class="obs-icon">${o.icon}</span><h3>${o.title}</h3></div>
        <p class="obs-data"><strong>数据：</strong>${o.data}</p>
        <p class="obs-meaning"><strong>解读：</strong>${o.meaning}</p>
        <p class="obs-caveat"><strong>注意：</strong>${o.caveat}</p>
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
      { label: '入住单元增速', value: k.occupiedGrowthPct, cls: 'occupied' },
      { label: '新增供应增速', value: k.supplyGrowthPct, cls: 'supply' },
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
      <p class="card-note" style="margin-top:0">区间 ${rolling.meta.periodStart} — ${rolling.meta.periodEnd}，供与近半年数据对照。</p>
      <div class="kpi-grid" style="margin:12px 0">
        <div class="stat-card"><div class="stat-value">${fmt(s.totalTransactions)}</div><div class="stat-label">12 个月成交</div></div>
        <div class="stat-card"><div class="stat-value">${s.offPlanSharePct}%</div><div class="stat-label">期房占比</div></div>
        <div class="stat-card"><div class="stat-value">+${s.aptPriceChangePct}%</div><div class="stat-label">公寓均价涨幅</div></div>
        <div class="stat-card"><div class="stat-value">+${s.villaPriceChangePct}%</div><div class="stat-label">别墅均价涨幅</div></div>
      </div>
      <div class="chart-wrap" style="height:220px"><canvas id="barChart12"></canvas></div>
    `;
    renderVolumeChart(rolling, 'barChart12');
  }

  function setupNav() {
    const nav = document.getElementById('section-nav');
    if (!nav) return;
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
      <h4>第一层 · ADREC 2025 年报</h4>
      <ul>
        <li>来源：${annual.meta.source}</li>
        <li>住宅成交额 ${annual.kpi.transactionValueAedYi} 亿 AED（2025 全年 · 酋长国全境）</li>
        <li>买家结构、现金占比、全年期房等宏观指标</li>
      </ul>
      <h4>第二层 · 近半年成交（${hy.meta.periodLabel}）</h4>
      <ul>
        <li>来源：${hy.meta.source}</li>
        <li>成交额 ${hy.all.summary.totalValueAedYi} 亿 AED（7 个月 · 全部成交）</li>
        <li>排除项目：${hy.meta.excludedProjects.join('、')}</li>
        <li>投资区筛选：${hy.meta.investmentZoneDistricts} 个 District（见 data/investment_zones.json）</li>
        <li>全部成交 ${hy.all.summary.totalTransactions} 套；投资区 ${hy.investmentZone.summary.totalTransactions} 套（${hy.compare.izShareOfTransactionsPct}%）</li>
        <li>全页金额统一为<strong>亿 AED</strong>（1 亿 = 1×10⁸ AED）</li>
      </ul>
      <h4>附录 · 滚动 12 个月（${rolling.meta.periodStart} — ${rolling.meta.periodEnd}）</h4>
      <ul><li>更长区间趋势参考，与近半年、年报均勿直接相加减</li></ul>
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
    if (el) { el.hidden = false; el.textContent = `数据加载失败：${err.message}。请通过 HTTP 访问，勿用 file:// 打开。`; }
  }

  async function init() {
    try {
      destroyCharts();
      const { annual, halfyear, rolling } = await loadData();
      if (!halfyear?.all || !halfyear?.investmentZone) {
        throw new Error('halfyear.json 格式异常：缺少 all / investmentZone，请运行 node tools/analyze_recent_sales.mjs 重新生成');
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
      setupNav();
      setupCollapsibles();
      document.getElementById('app')?.classList.remove('loading');
    } catch (err) {
      console.error(err);
      showError(err);
    }
  }

  init();
})();
