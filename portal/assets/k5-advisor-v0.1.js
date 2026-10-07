(() => {
  const section = document.getElementById("k5-advisor");
  const state = document.getElementById("k5State");
  const runButton = document.getElementById("k5RunCase");
  const known = document.getElementById("k5Known");
  const unknown = document.getElementById("k5Unknown");
  const models = document.getElementById("k5Models");
  const feedback = document.getElementById("k5Feedback");
  const followups = document.getElementById("k5Followups");
  const answer = document.getElementById("k5Answer");
  let artifact = null;

  const esc = value => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function list(items) {
    return "<ul>" + items.map(item => "<li>" + esc(item) + "</li>").join("") + "</ul>";
  }

  function renderCase() {
    if (!artifact) return;
    section.dataset.executed = "true";
    section.dataset.caseId = artifact.caseId;
    section.dataset.geometryContinuity = artifact.evidenceSummary.geometryContinuity;
    section.dataset.crossLayerEquivalence = artifact.evidenceSummary.crossLayerEquivalence;
    known.innerHTML = "<b>已知</b>" + list(artifact.conversation.recognizedKnown);
    unknown.innerHTML = "<b>未知 / 必须补充</b>" + list(artifact.conversation.necessaryUnknowns) +
      "<p><b>先生追问：</b>" + esc(artifact.conversation.clarification) + "</p>";
    const s = artifact.modelResults.spatial;
    const d = artifact.modelResults.daylight;
    const t = artifact.modelResults.traditional;
    models.innerHTML =
      "<div class='metric'><span>depthmapX 点数</span><b>" + s.pointCount + "</b><small>Connectivity " +
      s.minimumConnectivity + "–" + s.maximumConnectivity + "｜均值 " + s.meanConnectivity + "</small></div>" +
      "<div class='metric'><span>Radiance 传感点</span><b>" + d.sensorCount + "</b><small>" +
      d.minimumLux + "–" + d.maximumLux + " lx｜均值 " + d.meanLux + " lx</small></div>" +
      "<div class='metric'><span>近窗 / 深区</span><b>" + d.nearWindowMeanLux + " / " + d.deepZoneMeanLux +
      "</b><small>lux｜固定参考模型</small></div>" +
      "<div class='metric'><span>坐向归一化</span><b>" + esc(t.normalizedDirection) +
      "</b><small>" + t.azimuthDegrees + "°｜只作名称归一化</small></div>";
    feedback.innerHTML = artifact.advisorFeedback.map(item =>
      "<article class='advisor-item' data-feedback-id='" + esc(item.id) + "'>" +
      "<b>" + item.priority + "｜" + esc(item.title) + "</b>" +
      "<p><b>原因：</b>" + esc(item.reason) + "</p>" +
      "<p><b>建议：</b>" + esc(item.action) + "</p>" +
      "<small>证据：" + item.evidence.map(esc).join("、") + "</small></article>"
    ).join("");
    followups.innerHTML = artifact.followUps.map(item =>
      "<button class='chip k5-followup' type='button' data-followup-id='" + esc(item.id) + "'>" +
      esc(item.question) + "</button>"
    ).join("");
    followups.querySelectorAll(".k5-followup").forEach(button => {
      button.onclick = () => {
        const item = artifact.followUps.find(row => row.id === button.dataset.followupId);
        section.dataset.lastFollowup = item.id;
        answer.innerHTML = "<b>" + esc(item.question) + "</b><p>" + esc(item.answer) +
          "</p><small>证据：" + item.evidence.map(esc).join("、") + "</small>";
      };
    });
    state.innerHTML = "<b>住宅A反馈链已运行。</b> 已读取 K2/K3/K4 三份真实产物；" +
      artifact.advisorFeedback.length + " 条证据化反馈、" + artifact.followUps.length +
      " 个可继续追问项。geometry continuity=" + esc(artifact.evidenceSummary.geometryContinuity) +
      "；cross-layer equivalence=" + esc(artifact.evidenceSummary.crossLayerEquivalence) + "。";
    answer.textContent = "请选择一个追问，先生将按证据 ID 回答。";
  }

  async function loadArtifact() {
    try {
      const response = await fetch("data/k5-advisor-case.json", { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      artifact = await response.json();
      if (artifact.schema !== "zero-one.k5.advisor-case.v0.1") throw new Error("schema 不匹配");
      if (artifact.runtime?.actualRun !== true) throw new Error("缺少实际运行标记");
      if (!Object.values(artifact.checks || {}).every(Boolean)) throw new Error("K5 门禁未通过");
      if (artifact.modelResults?.spatial?.pointCount !== 263 ||
          artifact.modelResults?.daylight?.sensorCount !== 20 ||
          artifact.evidenceSummary?.geometryContinuity !== "NOT_PROVEN" ||
          artifact.evidenceSummary?.crossLayerEquivalence !== "BLOCK") {
        throw new Error("K2–K4 证据链不完整");
      }
      section.dataset.artifactReady = "true";
      section.dataset.runtimeSha = artifact.runtime.githubSha;
      state.textContent = "K5 实际运行产物已就绪。点击“运行住宅A完整反馈”进入材料→缺口→模型→解释→追问闭环。";
      runButton.disabled = false;
    } catch (error) {
      section.dataset.artifactReady = "false";
      state.textContent = "K5 反馈产物读取失败：" + error.message;
      runButton.disabled = true;
    }
  }

  runButton.onclick = renderCase;
  loadArtifact();
})();
