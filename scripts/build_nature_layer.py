#!/usr/bin/env python3
"""
自然環境レイヤ（自然公園地域）の軽量 GeoJSON を生成する。

データ出典：国土数値情報「自然公園地域データ（A10）」（国土交通省）
  https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A10-v3_1.html

A10 は都道府県別の Shapefile（自然公園地域＝国立・国定・都道府県立自然公園の区域）。
本スクリプトは47都道府県を逐次ダウンロードし、都道府県ごとにポリゴンを結合（dissolve）・
簡略化（Douglas-Peucker）して、Webオーバーレイ用の小さな GeoJSON にまとめる。
"""
import json
import os
import subprocess
import sys
import tempfile

import shapefile  # pyshp
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

REFERER = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A10-v3_1.html"
URL = "https://nlftp.mlit.go.jp/ksj/gml/data/A10/A10-06/A10-06_{pp}_GML.zip"

SIMPLIFY_TOL = 0.0012   # 度（約120m）
NDIGITS = 5


def download(pp, dest):
    url = URL.format(pp=pp)
    for attempt in range(4):
        rc = subprocess.call(["curl", "-sS", "-m", "300", "-e", REFERER, "-o", dest, url])
        if rc == 0 and os.path.getsize(dest) > 1000:
            return True
        subprocess.call(["sleep", str(2 ** (attempt + 1))])
    return False


def round_geo(obj):
    if isinstance(obj, float):
        return round(obj, NDIGITS)
    if isinstance(obj, list):
        return [round_geo(x) for x in obj]
    if isinstance(obj, tuple):
        return tuple(round_geo(x) for x in obj)
    if isinstance(obj, dict):
        return {k: round_geo(v) for k, v in obj.items()}
    return obj


def find_shp(d):
    for f in os.listdir(d):
        if f.lower().endswith(".shp"):
            return os.path.join(d, f)
    return None


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else "docs/data"
    os.makedirs(outdir, exist_ok=True)
    features = []
    total_parks = 0
    for i in range(1, 48):
        pp = f"{i:02d}"
        with tempfile.TemporaryDirectory() as tmp:
            zp = os.path.join(tmp, f"{pp}.zip")
            print(f"[{pp}] downloading ...", flush=True)
            if not download(pp, zp):
                print(f"  !! download failed {pp}", flush=True)
                continue
            subprocess.call(["unzip", "-o", "-q", zp, "-d", tmp])
            shp = find_shp(tmp)
            if not shp:
                print(f"  !! no shp in {pp}", flush=True)
                continue
            r = shapefile.Reader(shp, encoding="cp932")
            polys = []
            for sr in r.shapeRecords():
                try:
                    g = shape(sr.shape.__geo_interface__)
                except Exception:
                    continue
                if g.is_empty:
                    continue
                if not g.is_valid:
                    g = g.buffer(0)
                if not g.is_empty:
                    polys.append(g)
            total_parks += len(polys)
            if not polys:
                continue
            merged = unary_union(polys).simplify(SIMPLIFY_TOL, preserve_topology=True)
            if merged.is_empty:
                continue
            geom = round_geo(mapping(merged))
            features.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {"pref": pp},
            })
            print(f"  {pp}: {len(polys)} polygons -> dissolved", flush=True)

    fc = {"type": "FeatureCollection", "name": "自然公園地域", "features": features}
    out = os.path.join(outdir, "shizen_koen.geojson")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False)
    print(f"\nwrote {out}: {os.path.getsize(out)/1e6:.2f} MB, {len(features)} prefectures, {total_parks} source polygons")


if __name__ == "__main__":
    main()
