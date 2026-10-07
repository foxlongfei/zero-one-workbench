#!/usr/bin/env python3
"""Run a reproducible Radiance daylight calculation for Issue #2 K3."""

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

RGB_TO_LUX = (0.265, 0.670, 0.065)
LUMINOUS_EFFICACY = 179.0
X_VALUES = (0.5, 1.5, 2.5, 3.5, 4.5)
Y_VALUES = (0.5, 1.5, 2.5, 3.5)
WORKPLANE_Z_M = 0.8


def run(command: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, text=True, capture_output=True, **kwargs)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--output-csv", required=True)
    parser.add_argument("--evidence-json", required=True)
    args = parser.parse_args()

    for binary in ("gensky", "oconv", "rtrace"):
        if not shutil.which(binary):
            raise RuntimeError(f"Radiance binary is missing: {binary}")

    model_path = Path(args.model)
    model_sha256 = hashlib.sha256(model_path.read_bytes()).hexdigest()
    version_line = run(["rtrace", "-version"]).stderr.strip() or run(["rtrace", "-version"]).stdout.strip()

    with tempfile.TemporaryDirectory() as temp_name:
        temp = Path(temp_name)
        sky_path = temp / "guangzhou-summer-solstice-clear.sky"
        scene_path = temp / "scene.rad"
        octree_path = temp / "scene.oct"

        sky = run([
            "gensky", "6", "21", "12", "+s",
            "-a", "23.1291", "-o", "-113.2644", "-m", "-120",
        ]).stdout
        sky += """
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
4 0.2 0.2 0.2 0

ground_glow source ground
0
0
4 0 0 -1 180
"""
        sky_path.write_text(sky, encoding="utf-8")
        scene_path.write_text(model_path.read_text(encoding="utf-8") + "\n" + sky, encoding="utf-8")
        with octree_path.open("wb") as octree:
            subprocess.run(["oconv", str(scene_path)], check=True, stdout=octree)

        sensors = [
            {"id": f"P{row:02d}", "xM": x, "yM": y, "zM": WORKPLANE_Z_M}
            for row, (y, x) in enumerate(
                ((y, x) for y in Y_VALUES for x in X_VALUES), start=1
            )
        ]
        sensor_text = "".join(
            f"{p['xM']} {p['yM']} {p['zM']} 0 0 1\n" for p in sensors
        )
        trace = subprocess.run(
            [
                "rtrace", "-I+", "-h", "-ov",
                "-ab", "5", "-ad", "4096", "-as", "1024",
                "-ar", "256", "-aa", "0.10", "-lw", "0.0001",
                str(octree_path),
            ],
            check=True,
            text=True,
            input=sensor_text,
            capture_output=True,
        )
        rgb_rows = [
            tuple(float(value) for value in line.split())
            for line in trace.stdout.splitlines()
            if line.strip()
        ]

    if len(rgb_rows) != len(sensors):
        raise RuntimeError(f"Expected {len(sensors)} rtrace rows, got {len(rgb_rows)}")

    rows = []
    for point, rgb in zip(sensors, rgb_rows):
        lux = LUMINOUS_EFFICACY * sum(weight * value for weight, value in zip(RGB_TO_LUX, rgb))
        if not math.isfinite(lux) or lux <= 0:
            raise RuntimeError(f"Invalid illuminance at {point['id']}: {lux}")
        rows.append({**point, "radianceR": round(rgb[0], 6), "radianceG": round(rgb[1], 6), "radianceB": round(rgb[2], 6), "illuminanceLux": round(lux, 1)})

    values = [row["illuminanceLux"] for row in rows]
    near = [row["illuminanceLux"] for row in rows if row["yM"] <= 1.5]
    deep = [row["illuminanceLux"] for row in rows if row["yM"] >= 2.5]
    mean = sum(values) / len(values)
    near_mean = sum(near) / len(near)
    deep_mean = sum(deep) / len(deep)
    minimum = min(values)
    maximum = max(values)
    checks = {
        "radianceBinariesExecuted": True,
        "sceneCompiledByOconv": True,
        "rtraceSensorCount": len(rows),
        "allIlluminanceFiniteAndPositive": True,
        "nearWindowMeanExceedsDeepZoneMean": near_mean > deep_mean,
    }
    if not all(checks.values()):
        raise RuntimeError(f"Radiance validation failed: {checks}")

    result = {
        "schema": "zero-one.k3.radiance-daylight.v0.1",
        "calculationId": "RADIANCE_GZ_ROOM_SUMMER_CLEAR_WORKPLANE_V0.1",
        "engine": {
            "name": "Radiance",
            "version": version_line,
            "packageSource": "Ubuntu radiance package",
            "license": "Radiance License",
            "commands": ["gensky", "oconv", "rtrace"],
        },
        "model": {
            "name": "5x4x3 m reference residential room with south window",
            "path": str(model_path),
            "sha256": model_sha256,
            "units": "m",
            "room": {"widthM": 5.0, "depthM": 4.0, "heightM": 3.0},
            "window": {"orientation": "south", "widthM": 3.0, "heightM": 1.4, "sillHeightM": 1.0, "visibleTransmittanceInput": 0.60},
        },
        "sky": {
            "generator": "gensky",
            "month": 6,
            "day": 21,
            "solarTimeHour": 12,
            "type": "CIE clear with sun (+s)",
            "latitudeDeg": 23.1291,
            "longitudeDegWest": -113.2644,
            "standardMeridianDegWest": -120.0,
            "locationLabel": "Guangzhou",
        },
        "analysis": {
            "method": "rtrace irradiance mode (-I+) on horizontal workplane",
            "radianceParameters": "-ab 5 -ad 4096 -as 1024 -ar 256 -aa 0.10 -lw 0.0001",
            "workplaneHeightM": WORKPLANE_Z_M,
            "sensorCount": len(rows),
            "unit": "lux",
            "rgbToIlluminance": "179 * (0.265 R + 0.670 G + 0.065 B)",
            "summary": {
                "meanLux": round(mean, 1),
                "minimumLux": round(minimum, 1),
                "maximumLux": round(maximum, 1),
                "uniformityMinOverMean": round(minimum / mean, 3),
                "nearWindowMeanLux": round(near_mean, 1),
                "deepZoneMeanLux": round(deep_mean, 1),
            },
            "sensors": rows,
        },
        "checks": checks,
        "passed": True,
        "limitations": [
            "Reference-room simulation, not a measurement of a user's home.",
            "Clear-sky point-in-time calculation; not annual climate-based daylight autonomy.",
            "Window transmittance and surface reflectances are fixed model inputs.",
        ],
    }

    json_path = Path(args.output_json)
    csv_path = Path(args.output_csv)
    evidence_path = Path(args.evidence_json)
    for path in (json_path, csv_path, evidence_path):
        path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    evidence = {
        "schema": "zero-one.k3.radiance-engine-run.v0.1",
        "calculationId": result["calculationId"],
        "engine": result["engine"],
        "modelSha256": model_sha256,
        "sensorCount": len(rows),
        "summary": result["analysis"]["summary"],
        "checks": checks,
        "resultPath": "portal/data/k3-radiance-daylight.json",
        "passed": True,
    }
    evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    print(json.dumps({"passed": True, "engine": version_line, "sensors": len(rows), "summary": result["analysis"]["summary"]}))


if __name__ == "__main__":
    main()
