#!/usr/bin/env python3
"""从 ADREC recent_sales CSV 计算滚动 12 个月月度均价，辅助更新 rolling12.json。"""
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "rolling12.json"

DEFAULT_MONTHS = [
    "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10",
    "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
]

LABELS = [
    "5月'25", "6月'25", "7月'25", "8月'25", "9月'25", "10月'25",
    "11月'25", "12月'25", "1月'26", "2月'26", "3月'26", "4月'26",
]


def load_csv(path: str, months: list[str]):
    apt = defaultdict(list)
    villa = defaultdict(list)
    rows = 0
    with open(path, encoding="utf-8-sig") as f:
        for row in csv.reader(f):
            rows += 1
            if len(row) < 12 or row[0].strip() != "residential":
                continue
            prop = row[1].strip()
            month = row[2].strip()[:7]
            if month not in months:
                continue
            try:
                sqm = float(row[11])
            except (ValueError, IndexError):
                continue
            if sqm <= 0 or sqm > 100_000:
                continue
            if prop == "apartment":
                apt[month].append(sqm)
            elif prop == "villa":
                villa[month].append(sqm)
    return rows, apt, villa


def avg_k(values: list[float]) -> float:
    if not values:
        return 0.0
    return round(sum(values) / len(values) / 1000, 1)


def main():
    if len(sys.argv) < 2:
        print("用法: python update_rolling12.py <recent_sales.csv> [months...]")
        print("示例: python update_rolling12.py ~/Downloads/recent_sales.csv")
        sys.exit(1)

    csv_path = sys.argv[1]
    months = sys.argv[2:] if len(sys.argv) > 2 else DEFAULT_MONTHS

    rows, apt, villa = load_csv(csv_path, months)

    apt_prices = [avg_k(apt[m]) for m in months]
    villa_prices = [avg_k(villa[m]) for m in months]

    print(f"Rows scanned: {rows}")
    print(f"\n{'Month':<12} {'Apt K':>8} {'N':>6} {'Villa K':>8} {'N':>6}")
    print("-" * 44)
    for i, m in enumerate(months):
        print(f"{m:<12} {apt_prices[i]:>8} {len(apt[m]):>6} {villa_prices[i]:>8} {len(villa[m]):>6}")

    if OUT.exists():
        data = json.loads(OUT.read_text(encoding="utf-8"))
        data["months"]["labels"] = LABELS[: len(months)]
        data["months"]["apartmentPriceSqmK"] = apt_prices
        data["months"]["villaPriceSqmK"] = villa_prices
        data["meta"]["updated"] = __import__("datetime").date.today().isoformat()
        OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\n已更新 {OUT} 中的均价字段。")
        print("成交量、区域分布等字段请根据 ADREC 报表手动核对后更新。")
    else:
        print(f"\n未找到 {OUT}，请手动复制上述均价到 rolling12.json")


if __name__ == "__main__":
    main()
