"""运动达人 V0.2: 可验证的单人视频姿态提取实验模块。

安装: pip install mediapipe opencv-python numpy
运行: python movement_v02_pose.py input.mp4 --output-dir out
输出: landmarks.jsonl、annotated.mp4、summary.json
此模块只生成观察证据；不输出医学判断、专业动作评分或击球时刻。
"""
import argparse
import json
import math
from pathlib import Path


def joint_angle(a, b, c):
    """2D angle at b in degrees; None if points degenerate."""
    ux, uy = a[0] - b[0], a[1] - b[1]
    vx, vy = c[0] - b[0], c[1] - b[1]
    den = math.hypot(ux, uy) * math.hypot(vx, vy)
    if den < 1e-9:
        return None
    cosine = max(-1.0, min(1.0, (ux * vx + uy * vy) / den))
    return round(math.degrees(math.acos(cosine)), 2)


def analyze(video_path, output_dir, min_visibility=0.6):
    import cv2
    import mediapipe as mp

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError("Cannot open video: " + str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or not math.isfinite(fps) or fps <= 0:
        cap.release()
        raise ValueError("Video FPS missing; timestamps cannot be trusted")
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if width <= 0 or height <= 0:
        cap.release()
        raise ValueError("Invalid video dimensions")
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(output_dir / "annotated.mp4"), fourcc, fps, (width, height))
    if not writer.isOpened():
        cap.release()
        raise RuntimeError("Cannot create annotated video")
    mp_pose = mp.solutions.pose
    draw = mp.solutions.drawing_utils
    frames = 0
    detected = 0
    reliable_elbow = 0
    try:
        with (output_dir / "landmarks.jsonl").open("w", encoding="utf-8") as out:
            with mp_pose.Pose(static_image_mode=False, model_complexity=1,
                              enable_segmentation=False, min_detection_confidence=0.5,
                              min_tracking_confidence=0.5) as pose:
                while True:
                    ok, frame = cap.read()
                    if not ok:
                        break
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    result = pose.process(rgb)
                    row = {"frame": frames, "time_s": round(frames / fps, 5),
                           "detected": bool(result.pose_landmarks), "landmarks": None,
                           "right_elbow_angle_2d_deg": None,
                           "right_elbow_reliable": False}
                    if result.pose_landmarks:
                        detected += 1
                        points = result.pose_landmarks.landmark
                        row["landmarks"] = [
                            {"x": round(p.x, 6), "y": round(p.y, 6),
                             "z": round(p.z, 6), "visibility": round(p.visibility, 4)}
                            for p in points
                        ]
                        ids = [mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
                               mp_pose.PoseLandmark.RIGHT_ELBOW.value,
                               mp_pose.PoseLandmark.RIGHT_WRIST.value]
                        if all(points[i].visibility >= min_visibility for i in ids):
                            row["right_elbow_reliable"] = True
                            reliable_elbow += 1
                            row["right_elbow_angle_2d_deg"] = joint_angle(
                                (points[ids[0]].x, points[ids[0]].y),
                                (points[ids[1]].x, points[ids[1]].y),
                                (points[ids[2]].x, points[ids[2]].y))
                        draw.draw_landmarks(frame, result.pose_landmarks,
                                            mp_pose.POSE_CONNECTIONS)
                    out.write(json.dumps(row, ensure_ascii=False) + "\n")
                    writer.write(frame)
                    frames += 1
    finally:
        cap.release()
        writer.release()
    summary = {
        "status": "OBSERVATION_ONLY_NOT_COACHING",
        "source_video": str(video_path),
        "fps": fps,
        "total_frames": frames,
        "pose_detected_frames": detected,
        "pose_detection_ratio": round(detected / frames, 4) if frames else None,
        "right_elbow_reliable_frames": reliable_elbow,
        "visibility_threshold": min_visibility,
        "limits": [
            "2D elbow angle depends on camera viewpoint",
            "Pose landmarks do not measure force or injury risk",
            "No stroke classification, scoring, repetition count or correction validated"
        ],
    }
    (output_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("video")
    parser.add_argument("--output-dir", default="movement_v02_output")
    parser.add_argument("--min-visibility", type=float, default=0.6)
    args = parser.parse_args()
    if not 0 <= args.min_visibility <= 1:
        parser.error("--min-visibility must be between 0 and 1")
    print(json.dumps(analyze(args.video, args.output_dir, args.min_visibility),
                     ensure_ascii=False, indent=2))
