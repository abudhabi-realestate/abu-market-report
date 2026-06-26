/**
 * 分析 recent_sales CSV → data/halfyear.json
 * 区间：2025-10 至 2026-04
 * 排除：Private / Al Deem Towerhome / Bal Ghaiylam
 * 输出：capitalRegion（全首都圈匹配记录）+ investmentZone（投资区 District 筛选）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.join(__dirname, '..', '..', 'recent_sales (3).csv');
const OUT = path.join(__dirname, '..', 'data', 'halfyear.json');
const IZ_CONFIG = path.join(__dirname, '..', 'data', 'investment_zones.json');

const MONTHS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04'];
const LABELS = ["10月'25", "11月'25", "12月'25", "1月'26", "2月'26", "3月'26", "4月'26"];
const EXCLUDED_PROJECTS = new Set(['Private', 'Al Deem Towerhome', 'Bal Ghaiylam']);
const APT = new Set(['apartment']);
const VILLA = new Set(['villa', 'townhouse / attached villa']);
const THREE_ISLANDS = new Set(['Al Reem Island', 'Yas Island', 'Al Saadiyat Island']);

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

function avg(arr) {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
}
function avgK(arr) {
  return arr.length ? Math.round(avg(arr) / 100) / 10 : 0;
}
function avgKOrNull(arr) {
  return arr.length ? Math.round(avg(arr) / 100) / 10 : null;
}
function pctChange(a, b) {
  return a ? Math.round(((b - a) / a) * 100) : 0;
}
function pct(part, whole) {
  return whole ? Math.round((part / whole) * 1000) / 10 : 0;
}

function toYi(aed) {
  return Math.round(aed / 1e7) / 10;
}
function topN(map, n) {
  const items = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const top = items.slice(0, n);
  return { labels: top.map(([k]) => k), data: top.map(([, v]) => v) };
}

function emptyBucket() {
  const monthEntry = () => ({
    apt: [],
    villa: [],
    apt_primary: [],
    villa_primary: [],
    apt_secondary: [],
    villa_secondary: [],
    apt_vol: 0,
    villa_vol: 0,
  });
  return {
    monthly: Object.fromEntries(MONTHS.map(m => [m, monthEntry()])),
    offplan: { apt: 0, villa: 0, apt_ready: 0, villa_ready: 0 },
    districtsApt: new Map(),
    districtsVilla: new Map(),
    saleType: new Map(),
    totalValue: 0,
    totalCount: 0,
  };
}

function addRecord(bucket, row) {
  const m = row.date.slice(0, 7);
  if (!MONTHS.includes(m)) return;
  const { prop, district, rate, price, isOff, seq } = row;
  if (!APT.has(prop) && !VILLA.has(prop)) return;

  bucket.totalCount++;
  bucket.totalValue += price;
  bucket.saleType.set(seq, (bucket.saleType.get(seq) || 0) + 1);

  if (APT.has(prop)) {
    bucket.monthly[m].apt_vol++;
    bucket.monthly[m].apt.push(rate);
    bucket.districtsApt.set(district, (bucket.districtsApt.get(district) || 0) + 1);
    if (isOff) bucket.offplan.apt++; else bucket.offplan.apt_ready++;
    if (seq === 'primary') bucket.monthly[m].apt_primary.push(rate);
    else if (seq === 'secondary') bucket.monthly[m].apt_secondary.push(rate);
  } else {
    bucket.monthly[m].villa_vol++;
    bucket.monthly[m].villa.push(rate);
    bucket.districtsVilla.set(district, (bucket.districtsVilla.get(district) || 0) + 1);
    if (isOff) bucket.offplan.villa++; else bucket.offplan.villa_ready++;
    if (seq === 'primary') bucket.monthly[m].villa_primary.push(rate);
    else if (seq === 'secondary') bucket.monthly[m].villa_secondary.push(rate);
  }
}

function buildSlice(bucket, label) {
  const aptVol = MONTHS.map(m => bucket.monthly[m].apt_vol);
  const villaVol = MONTHS.map(m => bucket.monthly[m].villa_vol);
  const aptPriceK = MONTHS.map(m => avgK(bucket.monthly[m].apt));
  const villaPriceK = MONTHS.map(m => avgK(bucket.monthly[m].villa));
  const aptTotal = aptVol.reduce((a, b) => a + b, 0);
  const villaTotal = villaVol.reduce((a, b) => a + b, 0);
  const total = bucket.totalCount;
  const offTotal = bucket.offplan.apt + bucket.offplan.villa;
  const monthlyTotals = MONTHS.map((m, i) => aptVol[i] + villaVol[i]);
  const peakIdx = monthlyTotals.indexOf(Math.max(...monthlyTotals));

  const threeVol = [...bucket.districtsApt.entries()]
    .filter(([k]) => THREE_ISLANDS.has(k))
    .reduce((s, [, v]) => s + v, 0);

  const aptOct = avg(bucket.monthly['2025-10'].apt);
  const aptApr = avg(bucket.monthly['2026-04'].apt);
  const villaOct = avg(bucket.monthly['2025-10'].villa);
  const villaApr = avg(bucket.monthly['2026-04'].villa);

  const aptRegions = topN(bucket.districtsApt, 6);
  const villaRegions = topN(bucket.districtsVilla, 6);

  return {
    label,
    summary: {
      totalTransactions: total,
      totalValueAedYi: toYi(bucket.totalValue),
      peakMonth: MONTHS[peakIdx],
      peakMonthTotal: monthlyTotals[peakIdx],
      apartmentSharePct: pct(aptTotal, total),
      villaSharePct: pct(villaTotal, total),
      offPlanSharePct: pct(offTotal, total),
      offPlanAptPct: pct(bucket.offplan.apt, aptTotal),
      offPlanVillaPct: pct(bucket.offplan.villa, villaTotal),
      readySharePct: pct(bucket.offplan.apt_ready + bucket.offplan.villa_ready, total),
      aptPriceChangePct: pctChange(aptOct, aptApr),
      villaPriceChangePct: pctChange(villaOct, villaApr),
      aptPriceStart: aptOct,
      aptPriceEnd: aptApr,
      villaPriceStart: villaOct,
      villaPriceEnd: villaApr,
      primarySharePct: pct(bucket.saleType.get('primary') || 0, total),
      secondarySharePct: pct(bucket.saleType.get('secondary') || 0, total),
    },
    months: {
      labels: LABELS,
      apartmentVolume: aptVol,
      villaVolume: villaVol,
      apartmentPriceSqmK: aptPriceK,
      villaPriceSqmK: villaPriceK,
      primary: {
        apartmentPriceSqmK: MONTHS.map(m => avgKOrNull(bucket.monthly[m].apt_primary)),
        villaPriceSqmK: MONTHS.map(m => avgKOrNull(bucket.monthly[m].villa_primary)),
      },
      secondary: {
        apartmentPriceSqmK: MONTHS.map(m => avgKOrNull(bucket.monthly[m].apt_secondary)),
        villaPriceSqmK: MONTHS.map(m => avgKOrNull(bucket.monthly[m].villa_secondary)),
      },
    },
    structure: {
      typeSplit: {
        labels: [`公寓 ${pct(aptTotal, total)}%`, `别墅/联排 ${pct(villaTotal, total)}%`],
        data: [aptTotal, villaTotal],
      },
      offPlanAll: {
        labels: [`期房 ${pct(offTotal, total)}%`, `现房 ${pct(bucket.offplan.apt_ready + bucket.offplan.villa_ready, total)}%`],
        data: [offTotal, bucket.offplan.apt_ready + bucket.offplan.villa_ready],
      },
      saleSequence: {
        labels: ['一级市场', '二级市场'],
        data: [bucket.saleType.get('primary') || 0, bucket.saleType.get('secondary') || 0],
      },
    },
    regions: {
      apartment: {
        labels: aptRegions.labels,
        data: aptRegions.data,
        highlight: aptRegions.labels.map((l, i) => (THREE_ISLANDS.has(l) ? i : -1)).filter(i => i >= 0),
        topThreeSharePct: pct(threeVol, aptTotal),
      },
      villa: { labels: villaRegions.labels, data: villaRegions.data },
    },
    highlights: {
      aptPeakMonth: { month: MONTHS[aptVol.indexOf(Math.max(...aptVol))], volume: Math.max(...aptVol) },
      villaPeakMonth: { month: MONTHS[villaVol.indexOf(Math.max(...villaVol))], volume: Math.max(...villaVol) },
      aptPricePeak: { month: MONTHS[aptPriceK.indexOf(Math.max(...aptPriceK))], priceSqmK: Math.max(...aptPriceK) },
      villaPricePeak: { month: MONTHS[villaPriceK.indexOf(Math.max(...villaPriceK))], priceSqmK: Math.max(...villaPriceK) },
    },
  };
}

// ── 读取 CSV ──
const izConfig = JSON.parse(fs.readFileSync(IZ_CONFIG, 'utf8'));
const IZ = new Set(izConfig.districts);

const allBucket = emptyBucket();
const izBucket = emptyBucket();

const text = fs.readFileSync(CSV, 'utf8');
for (const line of text.split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue;
  const row = parseCsvLine(line);
  if (row.length < 13 || row[0].trim() !== 'residential') continue;
  if (EXCLUDED_PROJECTS.has(row[8].trim())) continue;

  const rate = parseFloat(row[11]);
  const price = parseFloat(row[9]);
  if (!(rate > 0 && rate <= 100000)) continue;

  const rec = {
    date: row[2].trim(),
    prop: row[1].trim(),
    district: row[6].trim() || '其他',
    rate,
    price,
    isOff: row[12].trim().toLowerCase() === 'off-plan',
    seq: (row[13] || 'unknown').trim(),
  };

  addRecord(allBucket, rec);
  if (IZ.has(rec.district)) addRecord(izBucket, rec);
}

const all = buildSlice(allBucket, '首都圈成交（已排除三类项目）');
const investmentZone = buildSlice(izBucket, '永久产权投资区');

const result = {
  meta: {
    source: 'Abu Dhabi Real Estate Centre 住宅成交记录',
    periodStart: '2025-10-01',
    periodEnd: '2026-04-30',
    periodLabel: '2025年10月 — 2026年4月（近半年）',
    updated: '2026-06-26',
    excludedProjects: [...EXCLUDED_PROJECTS],
    propertyTypes: ['apartment', 'villa', 'townhouse / attached villa'],
    csvFile: 'recent_sales (3).csv',
    investmentZoneDistricts: izConfig.districts.length,
    note: '已排除 Private / Al Deem Towerhome / Bal Ghaiylam 三类项目；投资区按 District 字段匹配 ADREC 名录。',
  },
  all,
  investmentZone,
  investmentZoneMeta: izConfig.meta,
  compare: {
    izShareOfTransactionsPct: pct(investmentZone.summary.totalTransactions, all.summary.totalTransactions),
    izShareOfValuePct: pct(investmentZone.summary.totalValueAedYi, all.summary.totalValueAedYi),
    nonIzTransactions: all.summary.totalTransactions - investmentZone.summary.totalTransactions,
    topNonIzDistricts: [...[...allBucket.districtsApt.entries(), ...allBucket.districtsVilla.entries()]
      .reduce((m, [k, v]) => { if (!IZ.has(k)) m.set(k, (m.get(k) || 0) + v); return m; }, new Map())
      .entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([district, count]) => ({ district, count })),
  },
  adrecCrossRef: {
    annualOffPlanPct2025: 71,
    halfYearOffPlanPctAll: all.summary.offPlanSharePct,
    halfYearOffPlanPctIz: investmentZone.summary.offPlanSharePct,
    annualCashPct2025: 87,
    annualTransactionValueAedYi: 761,
    halfYearValueAllAedYi: all.summary.totalValueAedYi,
    halfYearValueIzAedYi: investmentZone.summary.totalValueAedYi,
    stockShareInvestmentZonePct: 21,
    note: '投资区成交占近半年总量约七成——与 ADREC「投资区存量约占 21%」不矛盾：小盘子里交易更活跃；购前须 DARI 核验单元产权。',
  },
};

fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log('All:', all.summary.totalTransactions, '| IZ:', investmentZone.summary.totalTransactions, `(${result.compare.izShareOfTransactionsPct}%)`);
console.log('Written:', OUT);
