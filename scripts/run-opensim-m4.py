#!/usr/bin/env python3
"""Run a reproducible OpenSim Arm26 position analysis for Issue #2 M4."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path

import opensim as osim


MODEL_SHA256 = "e2224d0044eb393b05d64926c3fa1682c451a9adc7f510e5517ef9958d3d41b9"
MODEL_COMMIT = "84b487c4e3245359a64381e01f01b9cf4772d457"
MODEL_URL = (
    "https://raw.githubusercontent.com/opensim-org/opensim-models/"
    f"{MODEL_COMMIT}/Models/Arm26/arm26.osim"
)
ANGLES_DEG = (0, 30, 60, 90, 120)


def rounded(value: float) -> float:
    return round(float(value), 9)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--output-csv", required=True)
    args = parser.parse_args()

    model_path = Path(args.model)
    digest = hashlib.sha256(model_path.read_bytes()).hexdigest()
    if digest != MODEL_SHA256:
        raise RuntimeError(f"Arm26 SHA-256 mismatch: {digest}")

    xml_root = ET.parse(model_path).getroot()
    model_xml = xml_root.find("Model")
    if model_xml is None:
        raise RuntimeError("OpenSim Model element is missing")

    model = osim.Model(str(model_path))
    state = model.initSystem()
    shoulder = model.updCoordinateSet().get("r_shoulder_elev")
    elbow = model.updCoordinateSet().get("r_elbow_flex")
    shoulder.setValue(state, 0.0, False)

    muscle_names = [model.getMuscles().get(i).getName() for i in range(model.getMuscles().getSize())]
    states = []
    csv_rows = []
    for angle_deg in ANGLES_DEG:
        angle_rad = math.radians(angle_deg)
        elbow.setValue(state, angle_rad, False)
        model.realizePosition(state)
        muscles = []
        for name in muscle_names:
            muscle = model.getMuscles().get(name)
            length_m = rounded(muscle.getLength(state))
            moment_arm_m = rounded(muscle.computeMomentArm(state, elbow))
            row = {
                "name": name,
                "muscleTendonLengthM": length_m,
                "elbowMomentArmM": moment_arm_m,
            }
            muscles.append(row)
            csv_rows.append(
                {
                    "coordinate": "r_elbow_flex",
                    "angle_deg": angle_deg,
                    "angle_rad": rounded(angle_rad),
                    "muscle": name,
                    "muscle_tendon_length_m": length_m,
                    "elbow_moment_arm_m": moment_arm_m,
                }
            )
        states.append(
            {
                "angleDeg": angle_deg,
                "coordinateValueRad": rounded(angle_rad),
                "muscles": muscles,
            }
        )

    biceps_lengths = [
        next(m for m in sample["muscles"] if m["name"] == "BIClong")["muscleTendonLengthM"]
        for sample in states
    ]
    if len(states) != 5 or len(csv_rows) != 30:
        raise RuntimeError("OpenSim state grid is incomplete")
    if not all(math.isfinite(row["muscle_tendon_length_m"]) for row in csv_rows):
        raise RuntimeError("OpenSim returned a non-finite muscle-tendon length")
    if not all(math.isfinite(row["elbow_moment_arm_m"]) for row in csv_rows):
        raise RuntimeError("OpenSim returned a non-finite moment arm")
    if not biceps_lengths[0] > biceps_lengths[-1]:
        raise RuntimeError("BIClong length did not change with elbow state")

    result = {
        "schema": "zero-one.m4.opensim-arm26.v0.1",
        "calculationId": "OPENSIM46_ARM26_ELBOW_POSITION_GRID_V0.1",
        "engine": {
            "name": "OpenSim Core",
            "versionAndDate": osim.GetVersionAndDate(),
            "pythonPackage": "opensim==4.6",
            "license": "Apache-2.0",
        },
        "model": {
            "name": model.getName(),
            "sourceRepository": "opensim-org/opensim-models",
            "sourceCommit": MODEL_COMMIT,
            "sourceUrl": MODEL_URL,
            "sha256": digest,
            "license": "CC BY 3.0",
            "credits": (model_xml.findtext("credits") or "").strip(),
            "publication": (model_xml.findtext("publications") or "").strip(),
            "bodyCount": model.getBodySet().getSize(),
            "coordinateCount": model.getCoordinateSet().getSize(),
            "muscleCount": model.getMuscles().getSize(),
        },
        "analysis": {
            "coordinate": "r_elbow_flex",
            "fixedCoordinate": {"name": "r_shoulder_elev", "valueRad": 0.0},
            "stateCount": len(states),
            "anglesDeg": list(ANGLES_DEG),
            "outputs": ["muscle-tendon length", "elbow flexion moment arm"],
            "units": {"angle": "degree/radian", "length": "m", "momentArm": "m"},
            "states": states,
        },
        "checks": {
            "modelLoadedByOpenSimCore": True,
            "coordinateStateApplied": True,
            "allSixMusclesComputedAtFiveStates": True,
            "finiteOutputs": True,
            "bicepsLengthChangesWithElbowState": True,
        },
        "passed": True,
    }

    json_path = Path(args.output_json)
    csv_path = Path(args.output_csv)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(csv_rows[0]))
        writer.writeheader()
        writer.writerows(csv_rows)

    print(json.dumps({"passed": True, "states": len(states), "rows": len(csv_rows), "sha256": digest}))


if __name__ == "__main__":
    main()
