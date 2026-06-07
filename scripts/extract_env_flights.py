#!/usr/bin/env python3
"""
無人航空機飛行計画データ（2025年度）から「環境調査」「自然観測」を目的に含む
飛行計画のみを抽出し、軽量な GeoJSON / 集計 JSON を生成する。

出典：国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』を加工して作成

各月ファイルは数十MB〜1GB規模のため、ダウンロード→ストリーム抽出→削除を逐次行う。
環境用途の飛行計画は全体の約0.2%であり、抽出後は静的配信可能な規模になる。
"""
import json
import numbers
import os
import subprocess
import sys
import tempfile

import ijson

CKAN = "https://www.geospatial.jp/ckan/dataset/9db8f0a7-5f94-424b-a978-740cfd58a5fa/resource/{rid}/download/{fn}"

# (対象月キー, RESOURCE_ID, FILENAME)
RESOURCES = [
    ("2024-07", "00e65a95-af82-4cdd-99be-adb524ddb449", "01_1_hikoukeikaku_202407.geojson"),
    ("2024-08", "4fb4c6b0-33a1-41fa-81ac-c9cfe28930f6", "01_2_hikoukeikaku_202408.geojson"),
    ("2024-09", "047e23f6-6c9b-48d5-b3fd-fdcefed4ee0c", "01_3_hikoukeikaku_202409.geojson"),
    ("2024-10", "045d69c2-c2a2-45b7-b368-ce867bf10c92", "01_4_hikoukeikaku_202410.geojson"),
    ("2024-11", "c231353d-3224-42e8-be21-de6431fd2c99", "01_5_hikoukeikaku_202411.geojson"),
    ("2024-12", "2c4f569f-b487-4f92-a1cf-2332ef4e9b7e", "01_6_hikoukeikaku_202412.geojson"),
    ("2025-01", "1d413e6b-61d5-4e50-8381-97421876a66a", "01_7_hikoukeikaku_202501.geojson"),
    ("2025-02", "ebb60fbe-ae89-429c-8fe0-9bae7e85569b", "01_8_hikoukeikaku_202502.geojson"),
    ("2025-03", "c6920c04-78a7-46a9-ab8a-adcc917ff313", "01_9_hikoukeikaku_202503_1.geojson"),
    ("2025-03", "a94bba7d-a87e-4969-8752-6360846e5bba", "01_9_hikoukeikaku_202503_2.geojson"),
    ("2025-04", "a3c04e15-f2ec-49bc-9518-25d4dd9d1e18", "01_10_hikoukeikaku_202504_1.geojson"),
    ("2025-04", "2c658546-b151-4713-9f0a-4f9aca5cbd22", "01_10_hikoukeikaku_202504_2.geojson"),
    ("2025-05", "cdc8a653-62df-42d5-9b5d-a418a903bebd", "01_11_hikoukeikaku_202505_1.geojson"),
    ("2025-05", "32f05c87-0cfb-48a1-bbc8-0baeef980533", "01_11_hikoukeikaku_202505_2.geojson"),
    ("2025-06", "37948aef-8c6d-4770-8346-8a6ba7fe8180", "01_12_hikoukeikaku_202506_1.geojson"),
    ("2025-06", "7be63f9a-4628-4d2f-8aec-12b278317421", "01_12_hikoukeikaku_202506_2.geojson"),
]

# 業務目的フラグ（表記ゆれ対策で正規化キーを使う）
PURPOSE_LABELS = {
    "空撮": "空撮",
    "報道取材": "報道取材",
    "警備": "警備",
    "農林水産業": "農林水産業",
    "測量": "測量",
    "環境調査": "環境調査",
    "設備メンテナンス": "設備メンテナンス",
    "インフラ点検・保守": "インフラ点検・保守",
    "資材管理": "資材管理",
    "輸送・宅配": "輸送・宅配",
    "自然観測": "自然観測",
    "事故・災害対応等": "事故・災害対応等",
    "その他": "その他",
}
PURPOSE_PREFIX = "飛行目的（業務）_"
COMPREHENSIVE_THRESHOLD = 10  # 業務目的フラグがこの数以上立つ行は包括申請ノイズとみなす


def norm_key(k):
    """キー名の末尾スペース等を除去して正規化する。"""
    return k.strip()


def normalize_props(props):
    return {norm_key(k): v for k, v in props.items()}


def to_int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def to_float(v):
    try:
        f = float(v)
        return f
    except (TypeError, ValueError):
        return None


def round_coords(geom, ndigits=6):
    """座標を丸めて出力サイズを抑える。"""
    def r(c):
        if isinstance(c, numbers.Number):
            return round(float(c), ndigits)
        return [r(x) for x in c]
    return {"type": geom["type"], "coordinates": r(geom["coordinates"])}


def polygon_centroid(geom):
    """ポリゴン外周の代表点（頂点平均）。表示用の概略重心。"""
    try:
        if geom["type"] == "Polygon":
            ring = geom["coordinates"][0]
        elif geom["type"] == "MultiPolygon":
            ring = geom["coordinates"][0][0]
        else:
            return None, None
        xs = [float(p[0]) for p in ring]
        ys = [float(p[1]) for p in ring]
        return round(sum(xs) / len(xs), 6), round(sum(ys) / len(ys), 6)
    except (KeyError, IndexError, ZeroDivisionError, TypeError):
        return None, None


def download(rid, fn, dest):
    url = CKAN.format(rid=rid, fn=fn)
    for attempt in range(4):
        rc = subprocess.call(
            ["curl", "-sSL", "-m", "1200", "--retry", "2", "-o", dest, url]
        )
        if rc == 0 and os.path.getsize(dest) > 1000:
            return True
        wait = 2 ** (attempt + 1)
        print(f"  download retry {attempt+1} (rc={rc}) wait {wait}s", flush=True)
        subprocess.call(["sleep", str(wait)])
    return False


def extract_features(path, month):
    """1ファイルをストリーム解析し、環境用途の Feature を抽出して返す。"""
    out = []
    total = 0
    with open(path, "rb") as f:
        for feat in ijson.items(f, "features.item"):
            total += 1
            raw = feat.get("properties") or {}
            p = normalize_props(raw)

            purposes = []
            for jp in PURPOSE_LABELS:
                if to_int(p.get(PURPOSE_PREFIX + jp)) == 1:
                    purposes.append(PURPOSE_LABELS[jp])
            is_env = "環境調査" in purposes
            is_nat = "自然観測" in purposes
            if not (is_env or is_nat):
                continue

            geom = feat.get("geometry")
            if not geom or geom.get("type") not in ("Polygon", "MultiPolygon"):
                geom = None

            clng, clat = polygon_centroid(geom) if geom else (None, None)
            deplng = to_float(p.get("出発地経度"))
            deplat = to_float(p.get("出発地緯度"))

            rec = {
                "no": to_int(p.get("No")) or None,
                "month": month,
                "env": 1 if is_env else 0,
                "nat": 1 if is_nat else 0,
                "purposes": purposes,
                "npurp": len(purposes),
                "comprehensive": 1 if len(purposes) >= COMPREHENSIVE_THRESHOLD else 0,
                "dep": (p.get("出発地") or "").strip() or None,
                "deplng": deplng,
                "deplat": deplat,
                "dest": (p.get("目的地") or "").strip() or None,
                "destlng": to_float(p.get("目的地経度")),
                "destlat": to_float(p.get("目的地緯度")),
                "start": p.get("飛行予定日時_開始") or None,
                "end": p.get("飛行予定日時_終了") or None,
                "alt": to_int(p.get("飛行高度")) or None,
                "speed": to_int(p.get("飛行速度")) or None,
                "dur": to_int(p.get("所要時間")) or None,
                "atype": (p.get("機体の種類") or "").strip() or None,
                "assistants": to_int(p.get("補助者数")),
                "clng": clng,
                "clat": clat,
                # 空域・方法の補足フラグ
                "did": to_int(p.get("飛行空域_DID")),
                "over150m": to_int(p.get("飛行空域_150m")),
                "night": to_int(p.get("飛行方法_夜間")),
                "bvlos": to_int(p.get("飛行方法_目視外")),
            }
            rec["geometry"] = round_coords(geom) if geom else None
            out.append(rec)
    return out, total


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else "data"
    os.makedirs(outdir, exist_ok=True)
    records = []
    grand_total = 0
    seen_months = {}
    for month, rid, fn in RESOURCES:
        print(f"[{month}] {fn} downloading ...", flush=True)
        with tempfile.NamedTemporaryFile(suffix=".geojson", delete=False) as tmp:
            path = tmp.name
        try:
            if not download(rid, fn, path):
                print(f"  !! download failed: {fn}", flush=True)
                continue
            size_mb = os.path.getsize(path) / 1e6
            print(f"  {size_mb:.1f} MB downloaded, parsing ...", flush=True)
            feats, total = extract_features(path, month)
            grand_total += total
            seen_months[month] = seen_months.get(month, 0) + total
            records.extend(feats)
            print(f"  parsed {total} features, kept {len(feats)} env/nature", flush=True)
        finally:
            if os.path.exists(path):
                os.remove(path)

    # 全期間の抽出結果を保存
    with open(os.path.join(outdir, "env_flights.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "generated_total_features": grand_total,
                "months": seen_months,
                "count": len(records),
                "records": records,
            },
            f,
            ensure_ascii=False,
        )
    print(f"\nTOTAL scanned={grand_total} env/nature kept={len(records)}", flush=True)
    print(f"by month scanned: {seen_months}", flush=True)


if __name__ == "__main__":
    main()
