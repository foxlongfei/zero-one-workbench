import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm";

document.body.dataset.m3Release = "M3_POSE_FLOW_V0.2";

const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const SAMPLE = "assets/case2_12.jpg";
const defs = [
  ["左肘", "JOINT_LEFT_ELBOW", 11, 13, 15],
  ["右肘", "JOINT_RIGHT_ELBOW", 12, 14, 16],
  ["左髋", "JOINT_LEFT_HIP", 11, 23, 25],
  ["右髋", "JOINT_RIGHT_HIP", 12, 24, 26],
  ["左膝", "JOINT_LEFT_KNEE", 23, 25, 27],
  ["右膝", "JOINT_RIGHT_KNEE", 24, 26, 28],
];

const button = document.querySelector("#poseSample");
const image = document.querySelector("#poseImg");
const canvas = document.querySelector("#poseCanvas");
const stage = document.querySelector("#poseStage");
const status = document.querySelector("#poseStatus");
const result = document.querySelector("#poseResult");
const jointMap = document.querySelector("#jointMap");
const coordinates = document.querySelector("#coordResult");
const feedback = document.querySelector("#motionFeedback");
let landmarker;
let activeDelegate = "GPU";

function angle(a, b, c) {
  const ux = a.x - b.x;
  const uy = a.y - b.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const magnitude = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (!magnitude) return null;
  const cosine = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / magnitude));
  return Math.round((Math.acos(cosine) * 180) / Math.PI);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = `${url}?m3=${Date.now()}`;
  });
}

async function createLandmarker(delegate) {
  const vision = await FilesetResolver.forVisionTasks(WASM);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL, ...(delegate ? { delegate } : {}) },
    runningMode: "IMAGE",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    outputSegmentationMasks: true,
  });
}

async function runSample() {
  button.disabled = true;
  document.body.dataset.m3PoseState = "running";
  status.textContent = "正在把真实俯卧撑照片送入 MediaPipe Pose Landmarker Full…";
  try {
    await loadImage(SAMPLE);
    stage.style.display = "block";
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    let output;
    try {
      output = landmarker.detect(image);
    } catch (detectError) {
      if (activeDelegate !== "GPU") throw detectError;
      status.textContent = "GPU 推理不可用，正在切换 MediaPipe CPU 路径重试真实样本…";
      landmarker?.close?.();
      landmarker = await createLandmarker("CPU");
      activeDelegate = "CPU";
      output = landmarker.detect(image);
    }
    const landmarks = output.landmarks?.[0];
    const world = output.worldLandmarks?.[0];
    if (!landmarks || landmarks.length !== 33 || !world || world.length !== 33) {
      throw new Error("未获得完整的 33 点二维/三维人体结果");
    }

    const drawing = new DrawingUtils(context);
    drawing.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: "#20d766", lineWidth: 4 });
    drawing.drawLandmarks(landmarks, { color: "#ffe04f", radius: 3 });

    const values = defs.map(([name, id, a, b, c]) => ({
      name,
      id,
      angle: angle(landmarks[a], landmarks[b], landmarks[c]),
      image: landmarks[b],
      world: world[b],
    }));
    const maskCount = output.segmentationMasks?.length || 0;
    const confidence = landmarks.reduce((sum, point) => sum + (point.visibility || 0), 0) / landmarks.length;

    result.dataset.poseCount = String(output.landmarks.length);
    result.dataset.landmarkCount = String(landmarks.length);
    result.dataset.worldLandmarkCount = String(world.length);
    result.dataset.segmentationMaskCount = String(maskCount);
    result.dataset.meanVisibility = confidence.toFixed(4);
    result.innerHTML = `<b>真实样本识别成功：1 人，33 个二维关键点，33 个三维世界关键点。</b><br>${values.map((item) => `<span class="pill">${item.name} ${item.angle}°</span>`).join("")}<br><span class="status">分割掩码 ${maskCount} 个｜平均可见度 ${confidence.toFixed(3)}</span>`;
    jointMap.innerHTML = values.map((item) => `<div class="joint" data-joint-id="${item.id}" data-angle="${item.angle}"><b>${item.name} ${item.angle}°</b><br><span class="status">${item.id}</span></div>`).join("");
    coordinates.innerHTML = `<b>已进入统一人体坐标：</b><br>${values.map((item) => `${item.id} = ${item.angle}°｜world (${item.world.x.toFixed(3)}, ${item.world.y.toFixed(3)}, ${item.world.z.toFixed(3)}) m`).join("<br>")}`;
    const knee = Math.min(...values.filter((item) => item.id.includes("KNEE")).map((item) => item.angle));
    const hip = Math.min(...values.filter((item) => item.id.includes("HIP")).map((item) => item.angle));
    feedback.innerHTML = `真实俯卧撑帧已映射到统一关节 ID。最小膝角约 ${knee}°、最小髋角约 ${hip}°；这是单帧姿态描述，不自动判断动作好坏或伤病。`;
    status.textContent = "真实样本运行完成：骨架、二维/三维关键点、关节角和标准关节 ID 已回到主页面。";
    document.body.dataset.m3PoseState = "passed";
    document.body.dataset.m3Upstream = "MEDIAPIPE_POSE_LANDMARKER_FULL";
  } catch (error) {
    document.body.dataset.m3PoseState = "failed";
    status.textContent = `真实样本识别失败：${error.message || error}`;
    throw error;
  } finally {
    button.disabled = false;
  }
}

async function initialize() {
  try {
    landmarker = await createLandmarker("GPU");
    activeDelegate = "GPU";
    status.textContent = "姿态模型已就绪：可上传照片，或运行公开可复验的真实样本。";
  } catch (gpuError) {
    landmarker = await createLandmarker("CPU");
      activeDelegate = "CPU";
    status.textContent = "姿态模型已就绪（CPU 路径）：可上传照片，或运行公开可复验的真实样本。";
  }
  button.disabled = false;
  button.dataset.modelReady = "true";
}

button?.addEventListener("click", () => runSample().catch(() => {}));
initialize().catch((error) => {
  document.body.dataset.m3PoseState = "model-error";
  status.textContent = `姿态模型加载失败：${error.message || error}`;
});
