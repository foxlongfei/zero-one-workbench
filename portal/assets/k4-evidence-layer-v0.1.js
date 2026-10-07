(() => {
  const section = document.getElementById("k4-evidence-layer");
  const state = document.getElementById("k4EvidenceState");
  const list = document.getElementById("k4EvidenceList");
  const labels = {
    COMPUTED_FACT: "现代计算事实",
    TRADITIONAL_TEXT: "传统文本证据",
    MODERN_HYPOTHESIS: "现代解释假设",
    UNVERIFIED_CLAIM: "未验证主张"
  };
  async function loadK4() {
    try {
      const response = await fetch("data/k4-evidence-layers.json", { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (data.schema !== "zero-one.k4.evidence-layers.v0.1") throw new Error("schema 不匹配");
      if (!Array.isArray(data.layers) || data.layers.length < 6) throw new Error("证据层不完整");
      const required = ["COMPUTED_FACT", "TRADITIONAL_TEXT", "MODERN_HYPOTHESIS", "UNVERIFIED_CLAIM"];
      if (!required.every(layer => data.layers.some(item => item.layer === layer))) throw new Error("缺少必需分层");
      if (!Object.values(data.checks || {}).every(Boolean)) throw new Error("分层门禁未通过");
      section.dataset.evidenceReady = "true";
      section.dataset.caseId = data.caseId;
      section.dataset.geometryContinuity = data.caseBoundary.geometryContinuity;
      section.dataset.recordCount = String(data.layers.length);
      state.innerHTML = "<b>证据分层产物已读入。</b> " + data.layers.length +
        " 条记录｜K2/K3 geometry continuity=" + data.caseBoundary.geometryContinuity +
        "｜跨层等同默认 BLOCK。";
      list.innerHTML = data.layers.map(item => {
        const src = item.source?.work ? "<br><span class='muted'>来源：" + item.source.work +
          (item.source.locator ? "｜" + item.source.locator : "") +
          "｜归属/传承：" + item.source.attributionStatus + "</span>" : "";
        const quote = item.source?.excerpt ? "<blockquote>" + item.source.excerpt + "</blockquote>" : "";
        return "<article class='evidence-item' data-layer='" + item.layer + "' data-evidence-id='" + item.id + "'>" +
          "<b>" + labels[item.layer] + "｜" + item.id + "｜" + item.label + "</b>" +
          "<p>" + item.claim + "</p>" + quote + src +
          "<p><b>允许：</b>" + item.allowedUse + "<br><b>禁止：</b>" + item.prohibitedUse + "</p></article>";
      }).join("");
    } catch (error) {
      section.dataset.evidenceReady = "false";
      state.textContent = "K4 证据分层产物读取失败：" + error.message;
    }
  }
  loadK4();
})();
