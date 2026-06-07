#!/usr/bin/env python3
"""
抽出済み env_flights.json から、静的サイト用の軽量データを生成する。

出力（docs/data/）:
  - summary.json          … 総件数・月別・目的別などのサマリ
  - municipalities.json   … 出発地（市区町村）別の集計（月×カテゴリのバケット）

出発地は行政区域の代表地点に秘匿化されているため、約29万件の環境用途レコードは
実質約1,800地点に収束する。ヒートマップ・分布表示はこの市区町村集計から
クライアント側で描画し、巨大な個票ファイルの静的配信を避ける。

カテゴリ t: 0=環境調査のみ, 1=自然観測のみ, 2=両方
c: 包括申請（業務目的フラグが極端に多い行）フラグ
飛行範囲ポリゴン（geometry）は約29万件と大規模なため、本ビルドでは静的出力せず、
ベクトルタイル化（今後）を前提とする。
"""
import datetime as dt
import json
import os
import sys


def rec_type(r):
    e, n = r.get("env"), r.get("nat")
    if e and n:
        return 2
    if n:
        return 1
    return 0


def pick_lnglat(r):
    if r.get("deplng") is not None and r.get("deplat") is not None:
        return r["deplng"], r["deplat"]
    if r.get("clng") is not None and r.get("clat") is not None:
        return r["clng"], r["clat"]
    return None, None


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "data/env_flights.json"
    outdir = sys.argv[2] if len(sys.argv) > 2 else "docs/data"
    os.makedirs(outdir, exist_ok=True)

    with open(src, encoding="utf-8") as f:
        data = json.load(f)
    records = data["records"]
    scanned_total = data.get("generated_total_features", 0)

    months = sorted({r["month"] for r in records})

    # --- municipality aggregation ---
    muni = {}  # dep -> {"lng","lat","m": {month: {e,n,b,ce,cn,cb}}}
    by_month = {m: {"genuine": 0, "comprehensive": 0} for m in months}
    by_purpose = {"環境調査": 0, "自然観測": 0}
    genuine_total = 0
    comprehensive_total = 0

    for r in records:
        t = rec_type(r)
        comp = bool(r.get("comprehensive"))
        mo = r["month"]
        lng, lat = pick_lnglat(r)

        if comp:
            comprehensive_total += 1
            by_month[mo]["comprehensive"] += 1
        else:
            genuine_total += 1
            by_month[mo]["genuine"] += 1
            if r.get("env"):
                by_purpose["環境調査"] += 1
            if r.get("nat"):
                by_purpose["自然観測"] += 1

        # municipality buckets
        dep = r.get("dep")
        if dep and lng is not None:
            m = muni.setdefault(dep, {"lng": lng, "lat": lat, "m": {}})
            b = m["m"].setdefault(mo, {})
            key = {0: "e", 1: "n", 2: "b"}[t]
            if comp:
                key = "c" + key
            b[key] = b.get(key, 0) + 1

    # --- write municipalities.json ---
    items = []
    for dep, v in muni.items():
        items.append({"dep": dep, "lng": round(v["lng"], 6), "lat": round(v["lat"], 6), "m": v["m"]})
    items.sort(key=lambda x: x["dep"])
    with open(os.path.join(outdir, "municipalities.json"), "w", encoding="utf-8") as f:
        json.dump({"generated": now(), "months": months, "items": items}, f, ensure_ascii=False)

    # --- summary.json ---
    summary = {
        "generated": now(),
        "months": months,
        "scanned_total": scanned_total,
        "total": len(records),
        "genuine_total": genuine_total,
        "comprehensive_total": comprehensive_total,
        "municipality_count": len(muni),
        "by_month": by_month,
        "by_purpose": by_purpose,
        "has_areas": False,
    }
    with open(os.path.join(outdir, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=1)

    # 旧フォーマットの残骸を掃除
    for stale in ["points.geojson", "points_comp.geojson", "areas.geojson"]:
        p = os.path.join(outdir, stale)
        if os.path.exists(p):
            os.remove(p)

    print("months:", months)
    print("scanned_total:", scanned_total)
    print("env/nature total:", len(records))
    print("  genuine:", genuine_total, " comprehensive:", comprehensive_total)
    print("municipalities:", len(muni))
    print("by_month:", json.dumps(by_month, ensure_ascii=False))
    for name in ["summary.json", "municipalities.json"]:
        p = os.path.join(outdir, name)
        if os.path.exists(p):
            print(f"  {name}: {os.path.getsize(p)/1e6:.2f} MB")


def now():
    return dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).strftime("%Y-%m-%d %H:%M JST")


if __name__ == "__main__":
    main()
