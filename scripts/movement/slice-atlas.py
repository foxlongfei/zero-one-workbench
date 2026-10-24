#!/usr/bin/env python3
"""Build the Movement rigged-body mesh pack from the vendored Human Atlas.

The Human Atlas (portal/anatomy) is a 2,234-mesh BodyParts3D 4.0 release stored as
chunked binaries. It is an excellent anatomy viewer but far too heavy to skin for
animation as-is. This script reads only the chunk parts it needs, keeps a curated
skeletal + muscular subset, adds two-bone blend weights where a muscle bridges two
bones, and emits:

  portal/data/movement-body-pack-v1.json   meshes (positions/normals/indices, base64)
  portal/data/movement-rig-v1.json         skeleton, rest joints, chain lengths

Decoding follows the atlas viewer exactly
(portal/anatomy/assets/index-CFqO6ZOB.js): positions are Float32 LE metres,
normals are Int16 LE scaled by 1/32767, indices Uint32 LE.
Atlas frame: Y up, metres, +Z anterior, +X = anatomical LEFT side (part names say it).

License: BodyParts3D 4.0, CC BY 4.0 (see portal/anatomy/ATTRIBUTION.md).
"""
import base64
import json
import math
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ATLAS = ROOT / "portal/anatomy/models"
MESH_OUT = ROOT / "portal/data/movement-body-pack-v1.json"
RIG_OUT = ROOT / "portal/data/movement-rig-v1.json"

S = "skeletal"
M = "muscular"

# (atlas id, slug, system, bone slug, region) - ids verified against atlas.json names
PARTS = [
    # --- trunk skeleton ---
    ("FJ3384", "scapula_r", S, "shoulder_r", "chest"),
    ("FJ3279", "scapula_l", S, "shoulder_l", "chest"),
    ("FJ3362", "clavicle_r", S, "shoulder_r", "chest"),
    ("FJ3237", "clavicle_l", S, "shoulder_l", "chest"),
    ("FJ3290", "manubrium", S, "spine_up", "chest"),
    ("FJ3178", "sternum_body", S, "spine_mid", "chest"),
    ("FJ3336", "rib2_r", S, "spine_up", "chest"),
    ("FJ3338", "rib3_r", S, "spine_up", "chest"),
    ("FJ3342", "rib5_r", S, "spine_mid", "chest"),
    ("FJ3229", "rib2_l", S, "spine_up", "chest"),
    ("FJ3230", "rib3_l", S, "spine_up", "chest"),
    ("FJ3232", "rib5_l", S, "spine_mid", "chest"),
    ("FJ3172", "vertebra_c7", S, "spine_up", "chest"),
    ("FJ3173", "vertebra_t7", S, "spine_up", "chest"),
    ("FJ3154", "vertebra_t10", S, "spine_mid", "chest"),
    ("FJ3156", "vertebra_t12", S, "spine_low", "trunk"),
    ("FJ3157", "vertebra_l1", S, "spine_low", "trunk"),
    ("FJ3159", "vertebra_l2", S, "spine_low", "trunk"),
    ("FJ3162", "vertebra_l3", S, "spine_low", "trunk"),
    ("FJ3165", "vertebra_l4", S, "spine_low", "trunk"),
    ("FJ3168", "vertebra_l5", S, "sacrum", "trunk"),
    ("FJ3393", "sacrum", S, "sacrum", "trunk"),
    ("FJ3152", "hip_bone_r", S, "sacrum", "trunk"),
    ("FJ3288", "hip_bone_l", S, "sacrum", "trunk"),
    # --- arms ---
    ("FJ3368", "humerus_r", S, "upperarm_r", "arm"),
    ("FJ3262", "humerus_l", S, "upperarm_l", "arm"),
    ("FJ3391", "ulna_r", S, "forearm_r", "arm"),
    ("FJ3286", "ulna_l", S, "forearm_l", "arm"),
    ("FJ3349", "radius_r", S, "forearm_r", "arm"),
    ("FJ3277", "radius_l", S, "forearm_l", "arm"),
    # --- legs ---
    ("FJ3365", "femur_r", S, "thigh_r", "leg"),
    ("FJ3259", "femur_l", S, "thigh_l", "leg"),
    ("FJ3381", "patella_r", S, "shin_r", "leg"),
    ("FJ3275", "patella_l", S, "shin_l", "leg"),
    ("FJ3387", "tibia_r", S, "shin_r", "leg"),
    ("FJ3282", "tibia_l", S, "shin_l", "leg"),
    ("FJ3360", "calcaneus_r", S, "foot_r", "foot"),
    ("FJ3256", "calcaneus_l", S, "foot_l", "foot"),
    ("FJ3353", "metatarsal2_r", S, "foot_r", "foot"),
    ("FJ3244", "metatarsal2_l", S, "foot_l", "foot"),
    # --- chest / shoulder girdle ---
    ("FJ1464", "pec_major_stern_r", M, "chest_r", "chest"),
    ("FJ1447", "pec_major_clav_r", M, "chest_r", "chest"),
    ("FJ1464M", "pec_major_stern_l", M, "chest_l", "chest"),
    ("FJ1447M", "pec_major_clav_l", M, "chest_l", "chest"),
    ("FJ1468", "deltoid_front_r", M, "shoulder_r", "shoulder"),
    ("FJ1467", "deltoid_side_r", M, "shoulder_r", "shoulder"),
    ("FJ1513", "deltoid_back_r", M, "shoulder_r", "shoulder"),
    ("FJ1468M", "deltoid_front_l", M, "shoulder_l", "shoulder"),
    ("FJ1467M", "deltoid_side_l", M, "shoulder_l", "shoulder"),
    ("FJ1513M", "deltoid_back_l", M, "shoulder_l", "shoulder"),
    ("FJ1459", "serratus_r", M, "chest_r", "torso"),
    ("FJ1459M", "serratus_l", M, "chest_l", "torso"),
    ("FJ1536", "rhomboid_r", M, "chest_r", "torso"),
    ("FJ1536M", "rhomboid_l", M, "chest_l", "torso"),
    ("FJ1521", "trapezius_upper_r", M, "chest_r", "torso"),
    ("FJ1554", "trapezius_mid_r", M, "chest_r", "torso"),
    ("FJ1520", "trapezius_lower_r", M, "chest_r", "torso"),
    ("FJ1521M", "trapezius_upper_l", M, "chest_l", "torso"),
    ("FJ1554M", "trapezius_mid_l", M, "chest_l", "torso"),
    ("FJ1520M", "trapezius_lower_l", M, "chest_l", "torso"),
    ("FJ1507", "teres_major_r", M, "shoulder_r", "shoulder"),
    ("FJ1507M", "teres_major_l", M, "shoulder_l", "shoulder"),
    ("FJ1508", "teres_minor_r", M, "shoulder_r", "shoulder"),
    ("FJ1508M", "teres_minor_l", M, "shoulder_l", "shoulder"),
    ("FJ1500", "infraspinatus_r", M, "shoulder_r", "shoulder"),
    ("FJ1500M", "infraspinatus_l", M, "shoulder_l", "shoulder"),
    ("FJ1506", "supraspinatus_r", M, "shoulder_r", "shoulder"),
    ("FJ1506M", "supraspinatus_l", M, "shoulder_l", "shoulder"),
    ("FJ1504", "subscapularis_r", M, "shoulder_r", "shoulder"),
    ("FJ1504M", "subscapularis_l", M, "shoulder_l", "shoulder"),
    ("FJ1535", "longissimus_r", M, "spine_mid", "torso"),
    ("FJ1535M", "longissimus_l", M, "spine_mid", "torso"),
    ("FJ1528", "iliocostalis_r", M, "spine_mid", "torso"),
    ("FJ1528M", "iliocostalis_l", M, "spine_mid", "torso"),
    ("FJ1540", "semispinalis_r", M, "spine_up", "torso"),
    ("FJ1540M", "semispinalis_l", M, "spine_up", "torso"),
    ("FJ1544", "spinalis_r", M, "spine_mid", "torso"),
    ("FJ1544M", "spinalis_l", M, "spine_mid", "torso"),
    ("FJ1452", "ext_oblique_r", M, "spine_low", "torso"),
    ("FJ1452M", "ext_oblique_l", M, "spine_low", "torso"),
    ("FJ1431", "psoas_r", M, "spine_low", "torso"),
    ("FJ1431M", "psoas_l", M, "spine_low", "torso"),
    # --- glutes ---
    ("FJ1418", "gluteus_max_r", M, "thigh_r", "glute"),
    ("FJ1418M", "gluteus_max_l", M, "thigh_l", "glute"),
    ("FJ1419", "gluteus_med_r", M, "sacrum", "glute"),
    ("FJ1419M", "gluteus_med_l", M, "sacrum", "glute"),
    ("FJ1420", "gluteus_min_r", M, "sacrum", "glute"),
    ("FJ1420M", "gluteus_min_l", M, "sacrum", "glute"),
    # --- upper arm ---
    ("FJ1479", "triceps_long_r", M, "upperarm_r", "upperarm"),
    ("FJ1477", "triceps_lat_r", M, "upperarm_r", "upperarm"),
    ("FJ1480", "triceps_med_r", M, "upperarm_r", "upperarm"),
    ("FJ1479M", "triceps_long_l", M, "upperarm_l", "upperarm"),
    ("FJ1477M", "triceps_lat_l", M, "upperarm_l", "upperarm"),
    ("FJ1480M", "triceps_med_l", M, "upperarm_l", "upperarm"),
    ("FJ1478", "biceps_long_r", M, "upperarm_r", "upperarm"),
    ("FJ1512", "biceps_short_r", M, "upperarm_r", "upperarm"),
    ("FJ1478M", "biceps_long_l", M, "upperarm_l", "upperarm"),
    ("FJ1512M", "biceps_short_l", M, "upperarm_l", "upperarm"),
    # --- thigh ---
    ("FJ1433", "rectus_femoris_r", M, "thigh_r", "thigh"),
    ("FJ1442", "vastus_lateralis_r", M, "thigh_r", "thigh"),
    ("FJ1443", "vastus_medialis_r", M, "thigh_r", "thigh"),
    ("FJ1441", "vastus_intermedius_r", M, "thigh_r", "thigh"),
    ("FJ1434", "sartorius_r", M, "thigh_r", "thigh"),
    ("FJ1402", "adductor_longus_r", M, "thigh_r", "thigh"),
    ("FJ1403", "adductor_magnus_r", M, "thigh_r", "thigh"),
    ("FJ1395", "biceps_femoris_r", M, "thigh_r", "thigh"),
    ("FJ1444", "biceps_femoris_short_r", M, "thigh_r", "thigh"),
    ("FJ1436", "semitendinosus_r", M, "thigh_r", "thigh"),
    ("FJ1433M", "rectus_femoris_l", M, "thigh_l", "thigh"),
    ("FJ1442M", "vastus_lateralis_l", M, "thigh_l", "thigh"),
    ("FJ1443M", "vastus_medialis_l", M, "thigh_l", "thigh"),
    ("FJ1441M", "vastus_intermedius_l", M, "thigh_l", "thigh"),
    ("FJ1434M", "sartorius_l", M, "thigh_l", "thigh"),
    ("FJ1402M", "adductor_longus_l", M, "thigh_l", "thigh"),
    ("FJ1403M", "adductor_magnus_l", M, "thigh_l", "thigh"),
    ("FJ1395M", "biceps_femoris_l", M, "thigh_l", "thigh"),
    ("FJ1444M", "biceps_femoris_short_l", M, "thigh_l", "thigh"),
    ("FJ1436M", "semitendinosus_l", M, "thigh_l", "thigh"),
    # --- lower leg ---
    ("FJ1397", "gastrocnemius_med_r", M, "shin_r", "calf"),
    ("FJ1394", "gastrocnemius_lat_r", M, "shin_r", "calf"),
    ("FJ1437", "soleus_r", M, "shin_r", "calf"),
    ("FJ1439", "tibialis_anterior_r", M, "shin_r", "calf"),
    ("FJ1397M", "gastrocnemius_med_l", M, "shin_l", "calf"),
    ("FJ1394M", "gastrocnemius_lat_l", M, "shin_l", "calf"),
    ("FJ1437M", "soleus_l", M, "shin_l", "calf"),
    ("FJ1439M", "tibialis_anterior_l", M, "shin_l", "calf"),
]

# Muscles that bridge two bones get a linear vertex blend across their own Y extent:
# weight ramps from 0 at the start of the blend window to 1 at the end. Everything else
# is rigid on one bone - the right trade-off for a teaching figure without a skin solver.
BLEND = {
    "gluteus_max_r": ("thigh_r", "sacrum", 0.0, 0.55),
    "gluteus_max_l": ("thigh_l", "sacrum", 0.0, 0.55),
    "semispinalis_r": ("spine_up", "spine_mid", 0.45, 1.0),
    "semispinalis_l": ("spine_up", "spine_mid", 0.45, 1.0),
    "trapezius_lower_r": ("chest_r", "spine_mid", 0.0, 0.7),
    "trapezius_lower_l": ("chest_l", "spine_mid", 0.0, 0.7),
    "trapezius_mid_r": ("chest_r", "spine_up", 0.0, 1.0),
    "trapezius_mid_l": ("chest_l", "spine_up", 0.0, 1.0),
    "serratus_r": ("chest_r", "spine_low", 0.0, 0.6),
    "serratus_l": ("chest_l", "spine_low", 0.0, 0.6),
    "psoas_r": ("spine_low", "thigh_r", 0.45, 1.0),
    "psoas_l": ("spine_low", "thigh_l", 0.45, 1.0),
    "tibialis_anterior_r": ("shin_r", "foot_r", 0.7, 1.0),
    "tibialis_anterior_l": ("shin_l", "foot_l", 0.7, 1.0),
}

SYSTEM_COLORS = {
    "skeletal": [0.88, 0.85, 0.76],
    "muscular": [0.72, 0.28, 0.26],
}
GROUPS = {"skeletal": "skeleton", "muscular": "muscle"}


def flip(p):
    """Atlas (X = anatomical left) -> character frame (X = character's own left)."""
    return [-p[0], p[1], p[2]]


def read_parts(manifest, wanted):
    """Decode only the chunk parts we need. Layout matches the atlas viewer."""
    by_chunk = {}
    for part in manifest["parts"]:
        if part["id"] in wanted:
            by_chunk.setdefault(part["chunk"], []).append(part)
    geometry = {}
    for chunk, parts in by_chunk.items():
        data = (ATLAS / f"body-{chunk}.bin").read_bytes()
        for part in parts:
            n = part["vertexCount"]
            pos = struct.unpack("<%df" % (n * 3), data[part["positions"]: part["positions"] + n * 12])
            nrm = struct.unpack("<%dh" % (n * 3), data[part["normals"]: part["normals"] + n * 6])
            idx = struct.unpack("<%dI" % part["indexCount"], data[part["indices"]: part["indices"] + part["indexCount"] * 4])
            geometry[part["id"]] = {
                "name": part["name"],
                "conceptId": part.get("conceptId"),
                "pos": pos,
                "nrm": [max(-1.0, v / 32767.0) for v in nrm],
                "idx": idx,
            }
    return geometry


def b64(fmt, values):
    return base64.b64encode(struct.pack("<" + fmt * len(values), *values)).decode("ascii")


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return 0.5 * (1 - math.cos(t * math.pi))


def emit(pid, slug, system, bone, region, source):
    pos, nrm, idx = source["pos"], source["nrm"], source["idx"]
    used = sorted(set(idx))
    remap = {old: new for new, old in enumerate(used)}
    p, n = [], []
    for old in used:
        p.extend((-pos[old * 3], pos[old * 3 + 1], pos[old * 3 + 2]))
        n.extend((-nrm[old * 3], nrm[old * 3 + 1], nrm[old * 3 + 2]))
    i = [remap[v] for v in idx]

    bone_a, bone_b, t0, t1 = BLEND.get(slug, (bone, bone, 0.0, 1.0))
    ys = p[1::3]
    lo, hi = min(ys), max(ys)
    span = max(hi - lo, 1e-6)
    weights = []
    if bone_a != bone_b:
        for k in range(len(used)):
            weights.append(round(smoothstep((ys[k] - lo) / span * (1 / (t1 - t0)) - t0 / max(t1 - t0, 1e-6)), 3))

    xs, zs = p[0::3], p[2::3]
    out = {
        "id": pid,
        "slug": slug,
        "name": source["name"],
        "conceptId": source["conceptId"],
        "system": system,
        "group": GROUPS[system],
        "region": region,
        "bone": bone_a,
        "boneB": bone_b if bone_b != bone_a else None,
        "color": SYSTEM_COLORS[system],
        "bounds": [[min(xs), min(ys), min(zs)], [max(xs), max(ys), max(zs)]],
        "vertexCount": len(used),
        "triangleCount": len(i) // 3,
        "positions": b64("f", p),
        "normals": b64("f", n),
        "indices": b64("I", i),
    }
    if weights:
        out["weights"] = weights
    return out


# Rest-pose joints read off the bone meshes (atlas metres): shoulder = humeral head
# centroid, elbow = midpoint of trochlea and radial head, wrist = distal carpal row,
# hip = femoral head centroid, knee = tibial plateau, ankle = tibial plafond.
ATLAS_JOINTS_L = {
    "shoulder": [0.172, 1.300, -0.024],
    "elbow": [0.218, 1.090, -0.082],
    "wrist": [0.250, 0.890, 0.015],
    "hip": [0.090, 0.895, -0.024],
    "knee": [0.072, 0.442, -0.021],
    "ankle": [0.072, 0.080, -0.026],
    "ball": [0.106, 0.030, 0.055],
}


def dist(a, b):
    return sum((a[i] - b[i]) ** 2 for i in range(3)) ** 0.5


def build_rig():
    """Skeleton in character frame; bone order has every parent before its children."""
    joints = {
        "root": [0.0, 0.995, -0.033],
        "sacrum": [0.0, 0.995, -0.033],
        "spine_low": [0.0, 1.090, -0.036],
        "spine_mid": [0.0, 1.215, -0.045],
        "spine_up": [0.0, 1.330, -0.032],
        "neck": [0.0, 1.455, -0.033],
        "head": [0.0, 1.535, -0.015],
        "head_end": [0.0, 1.665, -0.005],
    }
    bones = [
        ("sacrum", "root", "pelvis"),
        ("spine_low", "sacrum", "lumbar"),
        ("spine_mid", "spine_low", "thoracic_lower"),
        ("spine_up", "spine_mid", "thoracic_upper"),
        ("neck", "spine_up", "cervical"),
        ("head", "neck", "cranium"),
    ]
    # ATLAS_JOINTS_L is the anatomical-left (atlas +X) articulation. Flipped into the
    # character frame it lands on -X, i.e. the character's own left; the right side is the
    # same points mirrored back onto +X. Meshes carry the same flip, so this must match.
    for tag, sign in (("l", 1.0), ("r", -1.0)):
        for name, point in ATLAS_JOINTS_L.items():
            flipped = flip(point)
            joints[f"{name}_{tag}"] = [sign * flipped[0], flipped[1], flipped[2]]
        bones += [
            (f"shoulder_{tag}", "spine_up", f"clavicle.{tag}"),
            (f"upperarm_{tag}", f"shoulder_{tag}", f"humerus.{tag}"),
            (f"forearm_{tag}", f"elbow_{tag}", f"radius-ulna.{tag}"),
            (f"hand_{tag}", f"wrist_{tag}", f"hand.{tag}"),
            (f"thigh_{tag}", f"hip_{tag}", f"femur.{tag}"),
            (f"shin_{tag}", f"knee_{tag}", f"tibia-fibula.{tag}"),
            (f"foot_{tag}", f"ankle_{tag}", f"foot.{tag}"),
        ]

    def j(name):
        return joints[name]

    chains = []
    lengths = {}
    for tag in ("l", "r"):
        lengths[f"upperarm_{tag}"] = round(dist(j(f"shoulder_{tag}"), j(f"elbow_{tag}")), 4)
        lengths[f"forearm_{tag}"] = round(dist(j(f"elbow_{tag}"), j(f"wrist_{tag}")), 4)
        lengths[f"thigh_{tag}"] = round(dist(j(f"hip_{tag}"), j(f"knee_{tag}")), 4)
        lengths[f"shin_{tag}"] = round(dist(j(f"knee_{tag}"), j(f"ankle_{tag}")), 4)
        lengths[f"foot_{tag}"] = round(dist(j(f"ankle_{tag}"), j(f"ball_{tag}")), 4)
        lengths[f"clavicle_{tag}"] = round(dist(j(f"shoulder_{tag}"), j("spine_up")), 4)
        chains.append({"name": f"arm_{tag}", "upper": f"upperarm_{tag}", "lower": f"forearm_{tag}",
                       "tip": f"hand_{tag}", "root": f"shoulder_{tag}", "effector": f"wrist_{tag}"})
        chains.append({"name": f"leg_{tag}", "upper": f"thigh_{tag}", "lower": f"shin_{tag}",
                       "tip": f"foot_{tag}", "root": f"hip_{tag}", "effector": f"ankle_{tag}"})

    return {
        "schema": "zero-one.movement.rig.v1",
        "frame": "character: +X = character's left, +Y up, +Z forward, metres, origin on floor between the feet",
        "source": {
            "dataset": "BodyParts3D 4.0 via portal/anatomy (CC BY 4.0)",
            "jointDerivation": "bone surface centroids/plateaus at each articulation, X flipped once into character frame",
            "note": "A reference adult. Per-person proportion scaling is applied at runtime from the user's measured segment lengths.",
        },
        "height": 1.665,
        "joints": {k: [round(v, 4) for v in p] for k, p in joints.items()},
        "bones": [{"name": n, "parent": p, "label": label} for n, p, label in bones],
        "root": "root",
        "chains": chains,
        "lengths": lengths,
        "limits": {
            "upperarm_*": {"flexion": 180, "abduction": 180, "extension": 60},
            "forearm_*": {"flexion": 150, "extension": 0},
            "thigh_*": {"flexion": 130, "extension": 20, "abduction": 45},
            "shin_*": {"flexion": 140, "extension": 0},
            "foot_*": {"dorsiflexion": 20, "plantarflexion": 50},
            "spine_low": {"flexion": 45, "extension": 25, "sideBend": 25, "rotation": 20},
            "spine_mid": {"flexion": 35, "extension": 20, "sideBend": 20, "rotation": 25},
            "spine_up": {"flexion": 25, "extension": 15, "sideBend": 15, "rotation": 20},
            "neck": {"flexion": 45, "extension": 45, "sideBend": 35, "rotation": 60},
        },
    }


def main():
    manifest = json.loads((ATLAS / "atlas.json").read_text())
    byid = {p["id"]: p for p in manifest["parts"]}
    missing = [pid for pid, *_ in PARTS if pid not in byid]
    if missing:
        raise SystemExit(f"atlas is missing curated parts: {missing}")
    geometry = read_parts(manifest, {pid for pid, *_ in PARTS})
    parts = [emit(pid, slug, system, bone, region, geometry[pid]) for pid, slug, system, bone, region in PARTS]

    total = sum(
        len(base64.b64decode(p["positions"])) + len(base64.b64decode(p["normals"])) + len(base64.b64decode(p["indices"]))
        for p in parts
    )
    pack = {
        "schema": "zero-one.movement.body-pack.v1",
        "source": {
            "dataset": "BodyParts3D 4.0 (Human Atlas vendored release)",
            "license": "CC BY 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
            "attribution": "portal/anatomy/ATTRIBUTION.md",
            "generator": "scripts/movement/slice-atlas.py",
            "note": "Curated subset of the atlas meshes (skeleton + superficial musculature) used as the animated teaching body: same meshes and measurements, X flipped into the character frame, bridging muscles carry two-bone weights.",
        },
        "encoding": {
            "positions": "base64 float32 LE xyz metres, character frame (+X character left, +Y up, +Z forward)",
            "normals": "base64 float32 LE xyz",
            "indices": "base64 uint32 LE",
            "weights": "optional float32 per vertex: weight on `bone`, (1 - weight) on `boneB`",
        },
        "counts": {
            "meshes": len(parts),
            "vertices": sum(p["vertexCount"] for p in parts),
            "triangles": sum(p["triangleCount"] for p in parts),
            "skeleton": sum(1 for p in parts if p["system"] == "skeletal"),
            "muscle": sum(1 for p in parts if p["system"] == "muscular"),
        },
        "byteLength": total,
        "parts": parts,
    }
    MESH_OUT.parent.mkdir(parents=True, exist_ok=True)
    MESH_OUT.write_text(json.dumps(pack, ensure_ascii=False, separators=(",", ":")))
    rig = build_rig()
    RIG_OUT.write_text(json.dumps(rig, ensure_ascii=False, indent=1) + "\n")
    print(json.dumps({
        "meshes": pack["counts"]["meshes"],
        "vertices": pack["counts"]["vertices"],
        "triangles": pack["counts"]["triangles"],
        "kilobytes": round(total / 1024, 1),
        "lengths": rig["lengths"],
    }, ensure_ascii=False))


if __name__ == "__main__":
    sys.exit(main())
