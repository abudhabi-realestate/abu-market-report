#!/usr/bin/env python3
"""分析 recent_sales CSV，输出半年（2025-10 至 2026-04）聚合 JSON。"""
import csv
import json
from collections import defaultdict
from pathlib import Path

CSV = Path(__file__).resolve().parent.parent.parent / "recent_sales (3).csv"
MONTHS = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"]
LABELS = ["10月'25", "11月'25", "12月'25", "1月'26", "2月'26", "3月'26", "4月'26"]
EXCLUDED_PROJECTS = {"Private", "Al Deem Towerhome", "Bal Ghaiylam"}
APT_TYPES = {"apartment"}
VILLA_TYPES = {"villa", "townhouse / attached villa"}


def month_key(date_str: str) -> str:
    return date_str.strip()[:7]


def analyze():
    monthly = {m: {"apt": [], "villa": [], "apt_vol": 0, "villa_vol": 0} for m in MONTHS}
    offplan = {"apt": 0, "villa": 0, "apt_ready": 0, "villa_ready": 0}
    districts_apt = defaultdict(int)
    districts_villa = defaultdict(int)
    districts_all = defaultdict(int)
    sale_type = defaultdict(int)
    total_value = 0.0
    total_count = 0

    with open(CSV, encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) < 13 or row[0].strip() != "residential":
                continue
            project = row[8].strip()
            if project in EXCLUDED_PROJECTS:
                continue
            prop = row[1].strip()
            m = month_key(row[2])
            if m not in MONTHS:
                continue
            try:
                rate = float(row[11])
                price = float(row[9])
            except ValueError:
                continue
            if rate <= 0 or rate > 100_000:
                continue

            district = row[6].strip() or "其他"
            app_type = row[12].strip().lower()
            is_offplan = app_type == "off-plan"

            total_count += 1
            total_value += price
            sale_type[row[13].strip() if len(row) > 13 else "unknown"] += 1
            districts_all[district] += 1

            if prop in APT_TYPES:
                monthly[m]["apt_vol"] += 1
                monthly[m]["apt"].append(rate)
                districts_apt[district] += 1
                if is_offplan:
                    offplan["apt"] += 1
                else:
                    offplan["apt_ready"] += 1
            elif prop in VILLA_TYPES:
                monthly[m]["villa_vol"] += 1
                monthly[m]["villa"].append(rate)
                districts_villa[district] += 1
                if is_offplan:
                    offplan["villa"] += 1
                else:
                    offplan["villa_ready"] += 1

    def avg(lst):
        return round(sum(lst) / len(lst)) if lst else 0

    def avg_k(lst):
        return round(avg(lst) / 1000, 1) if lst else 0

    apt_vol = [monthly[m]["apt_vol"] for m in MONTHS]
    villa_vol = [monthly[m]["villa_vol"] for m in MONTHS]
    apt_price_k = [avg_k(monthly[m]["apt"]) for m in MONTHS]
    villa_price_k = [avg_k(monthly[m]["villa"]) for m in MONTHS]

    apt_total = sum(apt_vol)
    villa_total = sum(villa_vol)
    offplan_apt_total = offplan["apt"]
    offplan_villa_total = offplan["villa"]

    # Top districts - merge for apartment chart (top 5 + other)
    def top_n(d: dict, n=5):
        items = sorted(d.items(), key=lambda x: -x[1])
        top = items[:n]
        other = sum(v for _, v in items[n:])
        labels = [k for k, _ in top]
        data = [v for _, v in top]
        if other:
            labels.append("其他区域")
            data.append(other)
        return labels, data

    apt_labels, apt_data = top_n(districts_apt, 5)
    villa_labels, villa_data = top_n(districts_villa, 6)

    # Three islands share for apartments
    three_islands = {"Al Reem Island", "Yas Island", "Al Saadiyat Island"}
    three_vol = sum(districts_apt.get(d, 0) for d in three_islands)
    three_share = round(three_vol / apt_total * 100) if apt_total else 0

    # Price change Oct vs Apr
    apt_oct = avg(monthly["2025-10"]["apt"])
    apt_apr = avg(monthly["2026-04"]["apt"])
    villa_oct = avg(monthly["2025-10"]["villa"])
    villa_apr = avg(monthly["2026-04"]["villa"])

    def pct_change(a, b):
        if not a:
            return 0
        return round((b - a) / a * 100)

    result = {
        "meta": {
            "source": "Abu Dhabi Real Estate Centre 住宅成交记录",
            "periodStart": "2025-10-01",
            "periodEnd": "2026-04-30",
            "periodLabel": "2025年10月 — 2026年4月（近半年）",
            "updated": "2026-06-26",
            "excluded": list(EXCLUDED_PROJECTS),
            "propertyTypes": ["apartment", "villa", "townhouse / attached villa"],
            "csvFile": "recent_sales (3).csv",
            "note": "近半年微观成交；与 ADREC 2025 年报口径不同。",
        },
        "summary": {
            "totalTransactions": total_count,
            "totalValueAedBn": round(total_value / 1e9, 1),
            "peakMonth": MONTHS[apt_vol.index(max(apt_vol + villa_vol))],
            "peakMonthTotal": max(a + b for a, b in zip(apt_vol, villa_vol)),
            "apartmentSharePct": round(apt_total / total_count * 100, 1) if total_count else 0,
            "villaSharePct": round(villa_total / total_count * 100, 1) if total_count else 0,
            "offPlanSharePct": round((offplan_apt_total + offplan_villa_total) / total_count * 100, 1) if total_count else 0,
            "offPlanAptPct": round(offplan_apt_total / apt_total * 100, 1) if apt_total else 0,
            "offPlanVillaPct": round(offplan_villa_total / villa_total * 100, 1) if villa_total else 0,
            "readySharePct": round((offplan["apt_ready"] + offplan["villa_ready"]) / total_count * 100, 1) if total_count else 0,
            "aptPriceChangePct": pct_change(apt_oct, apt_apr),
            "villaPriceChangePct": pct_change(villa_oct, villa_apr),
            "aptPriceStart": apt_oct,
            "aptPriceEnd": apt_apr,
            "villaPriceStart": villa_oct,
            "villaPriceEnd": villa_apr,
            "primarySharePct": round(sale_type.get("primary", 0) / total_count * 100, 1) if total_count else 0,
            "secondarySharePct": round(sale_type.get("secondary", 0) / total_count * 100, 1) if total_count else 0,
        },
        "months": {
            "labels": LABELS,
            "apartmentVolume": apt_vol,
            "villaVolume": villa_vol,
            "apartmentPriceSqmK": apt_price_k,
            "villaPriceSqmK": villa_price_k,
        },
        "structure": {
            "typeSplit": {
                "labels": [f"公寓 {round(apt_total/total_count*100,1)}%", f"别墅/联排 {round(villa_total/total_count*100,1)}%"],
                "data": [apt_total, villa_total],
            },
            "offPlanAll": {
                "labels": [
                    f"期房 {round((offplan_apt_total+offplan_villa_total)/total_count*100,1)}%",
                    f"现房 {round((offplan['apt_ready']+offplan['villa_ready'])/total_count*100,1)}%",
                ],
                "data": [offplan_apt_total + offplan_villa_total, offplan["apt_ready"] + offplan["villa_ready"]],
            },
            "saleSequence": {
                "labels": ["一级市场 primary", "二级市场 secondary"],
                "data": [sale_type.get("primary", 0), sale_type.get("secondary", 0)],
            },
        },
        "regions": {
            "apartment": {
                "labels": apt_labels,
                "data": apt_data,
                "highlight": [i for i, l in enumerate(apt_labels) if l in three_islands],
                "topThreeSharePct": three_share,
            },
            "villa": {"labels": villa_labels, "data": villa_data},
        },
        "highlights": {
            "aptPeakMonth": {"month": MONTHS[apt_vol.index(max(apt_vol))], "volume": max(apt_vol)},
            "villaPeakMonth": {"month": MONTHS[villa_vol.index(max(villa_vol))], "volume": max(villa_vol)},
            "aptPricePeak": {"month": MONTHS[apt_price_k.index(max(apt_price_k))], "priceSqmK": max(apt_price_k)},
            "villaPricePeak": {"month": MONTHS[villa_price_k.index(max(villa_price_k))], "priceSqmK": max(villa_price_k)},
        },
        "adrecCrossRef": {
            "annualOffPlanPct2025": 71,
            "halfYearOffPlanPct": round((offplan_apt_total + offplan_villa_total) / total_count * 100, 1) if total_count else 0,
            "annualCashPct2025": 87,
            "note": "近半年期房占比通常高于或接近年报，因 2025 后段新盘集中入市；一级市场占比高说明仍以开发商 primary 销售为主。",
        },
    }

    out = Path(__file__).resolve().parent.parent / "data" / "halfyear.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"\nWritten: {out}")


if __name__ == "__main__":
    analyze()
