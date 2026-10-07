(() => {
  const section = document.getElementById("k3-environment-engine");
  const state = document.getElementById("radianceState");
  const metrics = document.getElementById("radianceMetrics");
  const heatmap = document.getElementById("radianceHeatmap");
  const source = document.getElementById("radianceSource");
  const fmt = value => Number(value).toFixed(1);

  async function loadRadiance() {
    try {
      const response = await fetch("data/k3-radiance-daylight.json", { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (!data.passed || data.engine?.name !== "Radiance") throw new Error("产物未通过引擎门");
      if (data.analysis?.unit !== "lux" || data.analysis?.sensorCount !== 20) throw new Error("单位或传感点不完整");
      if (data.analysis.sensors.length !== 20) throw new Error("传感点数组不完整");
      const s = data.analysis.summary;
      section.dataset.engineReady = "true";
      section.dataset.calculationId = data.calculationId;
      section.dataset.engineVersion = data.engine.version;
      section.dataset.sensorCount = String(data.analysis.sensorCount);
      section.dataset.unit = data.analysis.unit;
      section.dataset.meanLux = String(s.meanLux);
      section.dataset.minimumLux = String(s.minimumLux);
      section.dataset.maximumLux = String(s.maximumLux);
      section.dataset.nearWindowMeanLux = String(s.nearWindowMeanLux);
      section.dataset.deepZoneMeanLux = String(s.deepZoneMeanLux);
      state.innerHTML = "<b>真实引擎产物已读入。</b> " + data.engine.version +
        "｜gensky → oconv → rtrace｜20 个工作面点｜单位 lux";
      metrics.innerHTML =
        `<div class="metric"><b>${fmt(s.meanLux)}</b>平均 lux</div>` +
        `<div class="metric"><b>${fmt(s.minimumLux)}</b>最低 lux</div>` +
        `<div class="metric"><b>${fmt(s.maximumLux)}</b>最高 lux</div>` +
        `<div class="metric"><b>${fmt(s.uniformityMinOverMean)}</b>最低/平均</div>`;
      const min = s.minimumLux, max = s.maximumLux;
      heatmap.innerHTML = data.analysis.sensors.map(point => {
        const t = (point.illuminanceLux - min) / (max - min || 1);
        const light = 90 - t * 34;
        return `<div class="daylight-cell" data-sensor="${point.id}" data-lux="${point.illuminanceLux}" style="background:hsl(44 78% ${light}%)"><span><b>${fmt(point.illuminanceLux)}</b><br>lux</span></div>`;
      }).join("");
      source.textContent =
        data.model.name + "｜模型 SHA-256 " + data.model.sha256 +
        "｜广州 6月21日 12:00 CIE clear + sun｜工作面 0.8 m｜窗边均值 " +
        fmt(s.nearWindowMeanLux) + " lux / 深区 " + fmt(s.deepZoneMeanLux) + " lux。";
    } catch (error) {
      section.dataset.engineReady = "false";
      state.textContent = "Radiance 真实运行产物读取失败：" + error.message;
    }
  }
  loadRadiance();
})();
