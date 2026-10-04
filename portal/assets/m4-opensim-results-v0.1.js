const RELEASE = "M4_OPENSIM_CORE_V0.1";
const DATA_URL = "data/m4-opensim-arm26-results.json";

document.body.dataset.m4Release = RELEASE;

const statusNode = document.getElementById("m4Status");
const resultNode = document.getElementById("m4Result");
const sourceNode = document.getElementById("m4Source");
const angleButtons = [...document.querySelectorAll("[data-m4-angle]")];

const metric = (value) => Number(value).toFixed(6);

function renderState(data, angle) {
  const sample = data.analysis.states.find((item) => item.angleDeg === angle);
  if (!sample) throw new Error(`missing OpenSim state ${angle}°`);
  resultNode.dataset.angleDeg = String(sample.angleDeg);
  resultNode.dataset.coordinateRad = String(sample.coordinateValueRad);
  resultNode.innerHTML = `
    <p><b>r_elbow_flex = ${sample.angleDeg}°</b>（${sample.coordinateValueRad.toFixed(6)} rad）</p>
    <div class="jointgrid">${sample.muscles
      .map(
        (muscle) => `<div class="joint" data-m4-muscle="${muscle.name}">
          <b>${muscle.name}</b><br>
          肌腱总长 ${metric(muscle.muscleTendonLengthM)} m<br>
          肘屈力臂 ${metric(muscle.elbowMomentArmM)} m
        </div>`,
      )
      .join("")}</div>`;
  angleButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.m4Angle) === angle));
  });
}

fetch(`${DATA_URL}?v=${RELEASE}`, { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    if (data.schema !== "zero-one.m4.opensim-arm26.v0.1" || data.passed !== true) {
      throw new Error("unverified OpenSim result artifact");
    }
    if (data.analysis.stateCount !== 5 || data.model.muscleCount !== 6) {
      throw new Error("incomplete OpenSim result grid");
    }
    statusNode.textContent = `真实引擎产物已读入｜${data.engine.name}｜${data.model.name}｜5 个状态 × 6 条肌肉`;
    statusNode.dataset.status = "READY";
    sourceNode.innerHTML = `<b>来源与单位：</b>${data.engine.name} ${data.engine.versionAndDate}；Arm26 @ ${data.model.sourceCommit.slice(0, 8)}；模型 SHA-256 ${data.model.sha256}；长度/力臂单位 m，角度单位 degree/radian。`;
    angleButtons.forEach((button) => {
      button.disabled = false;
      button.onclick = () => renderState(data, Number(button.dataset.m4Angle));
    });
    renderState(data, 90);
    document.body.dataset.m4State = "ready";
    document.body.dataset.m4Calculation = data.calculationId;
  })
  .catch((error) => {
    statusNode.textContent = `OpenSim 结果读取失败：${error.message}`;
    statusNode.dataset.status = "ERROR";
    document.body.dataset.m4State = "error";
  });
