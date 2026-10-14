#!/usr/bin/env python3
"""Build and run an auditable Radiance model for the HABS DC-97 first floor."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

CASE_ID = "residence:habs-dc-97:frederick-douglass-house"
HEIGHT = 3.0
SILL = 0.9
HEAD = 2.1
WORKPLANE = 0.8
RGB_TO_LUX = (0.265, 0.670, 0.065)


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=True, text=True, capture_output=True, **kwargs)


def polygon(name: str, material: str, points: list[tuple[float, float, float]]) -> str:
    values = "\n".join("  %.4f %.4f %.4f" % p for p in points)
    return f"{material} polygon {name}\n0\n0\n{len(points) * 3}\n{values}\n"


def point_inside(x: float, y: float, poly: list[tuple[float, float]]) -> bool:
    inside = False
    j = len(poly) - 1
    for i, (xi, yi) in enumerate(poly):
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def convert(pixel: list[float], calibration: dict) -> tuple[float, float]:
    ox, oy = calibration["originPixel"]
    return ((pixel[0] - ox) * calibration["x"]["metresPerPixel"],
            (oy - pixel[1]) * calibration["y"]["metresPerPixel"])


def build_model(trace: dict) -> tuple[str, list[dict], list[dict]]:
    cal = trace["calibration"]
    footprint = [convert(p, cal) for p in trace["exteriorPolylinePixels"][:-1]]
    windows = [
        {"id": f"S{i+1}", "startM": start, "endM": start + 2.0, "orientation": "south"}
        for i, start in enumerate((0.8, 3.8, 6.8, 9.8, 12.8, 15.8))
    ]
    chunks = ["""void plastic wall_mat
0
0
5 0.55 0.52 0.47 0 0

void plastic floor_mat
0
0
5 0.28 0.25 0.22 0 0

void plastic ceiling_mat
0
0
5 0.78 0.75 0.70 0 0

void glass window_glass
0
0
3 0.60 0.60 0.60
"""]
    chunks.append(polygon("floor", "floor_mat", [(x, y, 0) for x, y in reversed(footprint)]))
    chunks.append(polygon("ceiling", "ceiling_mat", [(x, y, HEIGHT) for x, y in footprint]))

    for idx, (a, b) in enumerate(zip(footprint, footprint[1:] + footprint[:1])):
        if idx == 0:  # south facade; split around six explicit assumed openings
            chunks.append(polygon("south_lower", "wall_mat", [(a[0],0,0),(b[0],0,0),(b[0],0,SILL),(a[0],0,SILL)]))
            chunks.append(polygon("south_upper", "wall_mat", [(a[0],0,HEAD),(b[0],0,HEAD),(b[0],0,HEIGHT),(a[0],0,HEIGHT)]))
            cursor = a[0]
            for win in windows:
                if win["startM"] > cursor:
                    chunks.append(polygon(f"south_pier_{win['id']}", "wall_mat", [(cursor,0,SILL),(win['startM'],0,SILL),(win['startM'],0,HEAD),(cursor,0,HEAD)]))
                chunks.append(polygon(f"window_{win['id']}", "window_glass", [(win['startM'],0.002,SILL),(win['endM'],0.002,SILL),(win['endM'],0.002,HEAD),(win['startM'],0.002,HEAD)]))
                cursor = win["endM"]
            if cursor < b[0]:
                chunks.append(polygon("south_pier_end", "wall_mat", [(cursor,0,SILL),(b[0],0,SILL),(b[0],0,HEAD),(cursor,0,HEAD)]))
        else:
            chunks.append(polygon(f"exterior_{idx:02d}", "wall_mat", [(a[0],a[1],0),(b[0],b[1],0),(b[0],b[1],HEIGHT),(a[0],a[1],HEIGHT)]))

    for segment in trace["wallSegmentsPixels"]:
        a, b = convert(segment["a"], cal), convert(segment["b"], cal)
        chunks.append(polygon(f"interior_{segment['id']}", "wall_mat", [(a[0],a[1],0),(b[0],b[1],0),(b[0],b[1],HEIGHT),(a[0],a[1],HEIGHT)]))

    sensors = []
    xmin, xmax = min(x for x, _ in footprint), max(x for x, _ in footprint)
    ymin, ymax = min(y for _, y in footprint), max(y for _, y in footprint)
    sid = 1
    y = ymin + 0.75
    while y < ymax - 0.5:
        x = xmin + 0.75
        while x < xmax - 0.5:
            if point_inside(x, y, footprint):
                sensors.append({"id": f"P{sid:03d}", "xM": round(x,3), "yM": round(y,3), "zM": WORKPLANE})
                sid += 1
            x += 1.5
        y += 1.5
    return "\n".join(chunks), sensors, windows


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--trace", required=True); p.add_argument("--model", required=True)
    p.add_argument("--output-json", required=True); p.add_argument("--output-csv", required=True)
    p.add_argument("--evidence-json", required=True)
    args = p.parse_args()
    for binary in ("gensky", "oconv", "rtrace"):
        if not shutil.which(binary): raise RuntimeError(f"Radiance binary is missing: {binary}")
    trace_path, model_path = Path(args.trace), Path(args.model)
    trace = json.loads(trace_path.read_text())
    if trace["caseId"] != CASE_ID: raise RuntimeError("caseId mismatch")
    model, sensors, windows = build_model(trace)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    model_path.write_text(model, encoding="utf-8")
    model_sha = hashlib.sha256(model_path.read_bytes()).hexdigest()
    trace_sha = hashlib.sha256(trace_path.read_bytes()).hexdigest()
    version = run(["rtrace", "-version"]).stderr.strip() or run(["rtrace", "-version"]).stdout.strip()
    sky = run(["gensky","6","21","12","+s","-a","38.9072","-o","77.0369","-m","75"]).stdout + """
skyfunc glow sky_glow
0
0
4 1 1 1 0
sky_glow source sky
0
0
4 0 0 1 180
skyfunc glow ground_glow
0
0
4 .2 .2 .2 0
ground_glow source ground
0
0
4 0 0 -1 180
"""
    with tempfile.TemporaryDirectory() as td:
        scene, octree = Path(td)/"scene.rad", Path(td)/"scene.oct"
        scene.write_text(model + "\n" + sky)
        with octree.open("wb") as out: subprocess.run(["oconv", str(scene)], check=True, stdout=out)
        sensor_text = "".join(f"{s['xM']} {s['yM']} {s['zM']} 0 0 1\n" for s in sensors)
        result = subprocess.run(["rtrace","-I+","-h","-ov","-ab","3","-ad","512","-as","128","-ar","128","-aa","0.15","-lw","0.001",str(octree)], input=sensor_text, text=True, capture_output=True, check=True)
    rgbs = [tuple(map(float, line.split())) for line in result.stdout.splitlines() if line.strip()]
    if len(rgbs) != len(sensors): raise RuntimeError(f"Expected {len(sensors)} results, got {len(rgbs)}")
    rows = []
    for s, rgb in zip(sensors, rgbs):
        lux = 179 * sum(w*v for w,v in zip(RGB_TO_LUX, rgb))
        if not math.isfinite(lux) or lux <= 0: raise RuntimeError(f"invalid illuminance {s['id']}: {lux}")
        rows.append({**s,"radianceR":round(rgb[0],6),"radianceG":round(rgb[1],6),"radianceB":round(rgb[2],6),"illuminanceLux":round(lux,1)})
    vals = [r["illuminanceLux"] for r in rows]
    summary = {"meanLux":round(sum(vals)/len(vals),1),"minimumLux":min(vals),"maximumLux":max(vals),"uniformityMinOverMean":round(min(vals)/(sum(vals)/len(vals)),3)}
    payload = {
      "schema":"zero-one.habs-radiance-daylight.v0.1","caseId":CASE_ID,"calculationId":"HABS_DC_97_FIRST_FLOOR_SUMMER_CLEAR_V0_1","passed":True,
      "engine":{"name":"Radiance","version":version,"release":"rad6R0P2","commands":["gensky","oconv","rtrace"],"binariesExecuted":True},
      "source":{"tracePath":args.trace,"traceSha256":trace_sha,"archiveSheet":trace["source"]["sheet"],"geometryBoundary":trace["qualityBoundary"]},
      "model":{"path":args.model,"sha256":model_sha,"units":"m","heightM":HEIGHT,"orientation":"local x east; local y north","windows":windows,
        "assumptions":["PLAN_NORTH_FROM_TRACE_AXIS_REQUIRES_FIELD_CONFIRMATION","STOREY_HEIGHT_3_0M_REQUIRES_FIELD_CONFIRMATION","SOUTH_WINDOWS_MANUAL_ESTIMATE_REQUIRES_SECOND_PERSON_CAD_REVIEW","SILL_0_9M_AND_HEAD_2_1M_REQUIRE_FIELD_CONFIRMATION"]},
      "sky":{"generator":"gensky","date":"2026-06-21","solarTimeHour":12,"type":"CIE clear with sun","latitudeDeg":38.9072,"longitudeDegWest":77.0369,"standardMeridianDegWest":75,"locationLabel":"Washington, DC"},
      "analysis":{"method":"rtrace irradiance mode (-I+) on 0.8 m workplane","sensorCount":len(rows),"unit":"lux","summary":summary,"sensors":rows},
      "checks":{"sameCaseId":True,"sceneCompiledByOconv":True,"allIlluminanceFiniteAndPositive":True,"sensorCount":len(rows)},
      "limitations":["Point-in-time clear-sky study, not annual climate-based daylight autonomy.","Window positions and vertical dimensions are explicit analysis assumptions, not HABS measurements.","Manual plan trace requires independent CAD review before design use."]}
    for path in map(Path,(args.output_json,args.output_csv,args.evidence_json)): path.parent.mkdir(parents=True,exist_ok=True)
    Path(args.output_json).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n")
    with Path(args.output_csv).open("w",newline="") as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    evidence={k:payload[k] for k in ("schema","caseId","calculationId","passed","engine","source","model","sky","checks","limitations")}
    evidence["resultPath"]="portal/data/v02-habs-dc-97-radiance-daylight.json"; evidence["summary"]=summary
    Path(args.evidence_json).write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"passed":True,"caseId":CASE_ID,"engine":version,"sensorCount":len(rows),"summary":summary}))


if __name__ == "__main__": main()
