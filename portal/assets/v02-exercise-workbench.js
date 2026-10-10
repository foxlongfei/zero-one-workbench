(() => {
  const root = document.createElement('section');
  root.className = 'card';
  root.id = 'v02-exercise';
  root.innerHTML = `
    <h2>V0.2｜完整动作工作台（A01开发中）</h2>
    <p class="muted">输入动作→查看同一个 Exercise 对象。当前动态仍是项目原创二维教学示意，不是开放动作库、三维人体或医学级分析。</p>
    <div class="intent"><input id="v02-ex-input" aria-label="动作名称" value="我要练俯卧撑"><button class="btn" id="v02-ex-find">查看动作</button></div>
    <div id="v02-ex-content" class="result" aria-live="polite"></div>`;
  const main = document.querySelector('main');
  main.insertBefore(root, main.children[1] || null);

  const data = {
    schema: 'zero-one.exercise.v0.2',
    id: 'exercise:push-up:prototype',
    name: '标准俯卧撑',
    aliases: ['俯卧撑', 'push-up', 'pushup'],
    category: '水平推',
    equipment: '自身体重',
    difficulty: '基础—中等（取决于体重与动作质量）',
    phases: [
      {name: '支撑', range: [0, 19]},
      {name: '离心下降', range: [20, 49]},
      {name: '底部转换', range: [50, 59]},
      {name: '向心推起', range: [60, 89]},
      {name: '回到支撑', range: [90, 100]},
    ],
    steps: [
      '双手撑地，手位约在肩部附近，头、肩、髋、踝保持稳定排列',
      '屈肘控制身体整体下降，避免腰部明显塌陷或臀部先抬起',
      '胸部接近地面后推回起始位置，呼吸自然，不憋气',
    ],
    muscles: {
      primary: ['胸大肌', '肱三头肌'],
      secondary: ['三角肌前束', '前锯肌'],
      stabilizers: ['腹横肌/腹斜肌群', '臀大肌', '肩袖肌群'],
    },
    joints: [
      {joint: '肘关节', down: '屈曲', up: '伸展'},
      {joint: '肩关节', down: '水平外展', up: '水平内收'},
      {joint: '肩胛胸廓', down: '受控回缩', up: '前伸/稳定贴附'},
      {joint: '脊柱与骨盆', down: '抗伸展稳定', up: '抗伸展稳定'},
    ],
    variants: [
      {name: '跪姿俯卧撑', relation: '降低负荷的项目教学调整'},
      {name: '上斜俯卧撑', relation: '降低负荷的项目教学调整'},
    ],
    formErrors: [
      {error: '头部过度上抬或下压，颈椎代偿', correction: '保持耳—肩—髋—踝接近直线，视线自然向下'},
      {error: '腰部明显塌陷或臀部过高', correction: '收紧腹部和臀部，让躯干保持平板；必要时改为跪姿或上斜'},
      {error: '手位过宽或耸肩', correction: '手位约在肩部附近，肩胛稳定下沉，避免耸肩'},
    ],
    provenance: {
      source: '本项目原创教学说明与几何示意；未经动作专家审核',
      license: '仓库内项目内容；未声明可复用的第三方动作库许可证',
      evidenceStatus: 'PROJECT_GUIDANCE_NOT_UPSTREAM_STANDARD',
    },
  };

  let timer = null;
  let phase = 0;
  let speed = 1;
  const out = root.querySelector('#v02-ex-content');
  const phaseName = value => data.phases.find(item => value >= item.range[0] && value <= item.range[1])?.name || '动作周期';

  function draw() {
    const s = Math.sin(phase * Math.PI / 100);
    const dy = 40 * s;
    const svg = `<svg viewBox="0 0 460 190" role="img" aria-label="俯卧撑二维侧面运动示意" style="width:100%;max-width:620px;background:#f2f5f0;border-radius:12px">
      <path d="M20 160H440" stroke="#a8b5a9" stroke-width="2"/>
      <path d="M70 142 L170 ${68 + dy} L305 ${68 + dy} L390 143" fill="none" stroke="#1b5137" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="145" cy="${55 + dy}" r="17" fill="#9bbca4"/>
      <path d="M170 ${68 + dy} L205 ${110 + dy * .5} L220 158 M305 ${68 + dy} L355 ${104 + dy * .5} L390 143" fill="none" stroke="#46785b" stroke-width="7" stroke-linecap="round"/>
      <text x="18" y="25" fill="#24442d" font-size="14">教学示意｜${phaseName(phase)}｜阶段 ${Math.round(phase)}%</text>
    </svg>`;
    out.querySelector('#v02-svg').innerHTML = svg;
    out.querySelector('#v02-phase').value = phase;
    out.querySelector('#v02-phase-name').textContent = phaseName(phase);
    root.dataset.phase = String(Math.round(phase));
    root.dataset.phaseName = phaseName(phase);
  }

  function render() {
    clearInterval(timer);
    out.innerHTML = `
      <h3>${data.name} <small>(${data.id})</small></h3>
      <p><b>分类：</b>${data.category}｜<b>器械：</b>${data.equipment}｜<b>难度：</b>${data.difficulty}</p>
      <div id="v02-svg"></div>
      <div><button class="btn" id="v02-play">播放</button> <button class="btn ghost" id="v02-stop">暂停</button>
        <label>速度 <select id="v02-speed"><option value="0.5">0.5×慢放</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select></label>
        <label>动作阶段 <input type="range" id="v02-phase" min="0" max="100" value="0"></label> <strong id="v02-phase-name"></strong></div>
      <h4>标准步骤</h4><ol>${data.steps.map(x => `<li>${x}</li>`).join('')}</ol>
      <h4>肌群角色</h4><p><b>主要：</b>${data.muscles.primary.join('、')}<br><b>辅助：</b>${data.muscles.secondary.join('、')}<br><b>稳定：</b>${data.muscles.stabilizers.join('、')}</p>
      <h4>关节 / 骨骼运动</h4><ul id="v02-joints">${data.joints.map(item => `<li><b>${item.joint}</b>：下降 ${item.down}；推起 ${item.up}</li>`).join('')}</ul>
      <p><b>常见调整：</b>${data.variants.map(x => `${x.name}（${x.relation}）`).join('、')}</p>
      <fieldset id="v02-form-checklist"><legend>常见错误自查（项目原创教学提示，非医学诊断）</legend><ul>${data.formErrors.map((item, i) => `<li><input type="checkbox" id="v02-form-${i}"><label for="v02-form-${i}"><b>错误：</b>${item.error}；<b>纠正：</b>${item.correction}</label></li>`).join('')}</ul></fieldset>
      <p><b>来源：</b>${data.provenance.source}<br><b>许可：</b>${data.provenance.license}<br><b>证据状态：</b>${data.provenance.evidenceStatus}</p>
      <p class="status">状态：A01部分交互样机；开放动作库接入、正式来源审计和公开验收均未完成。完整动态人体属于A02，不在本项冒充完成。</p>`;
    out.querySelector('#v02-play').onclick = () => {
      clearInterval(timer);
      timer = setInterval(() => { phase = (phase + 2 * speed) % 101; draw(); }, 55);
    };
    out.querySelector('#v02-stop').onclick = () => clearInterval(timer);
    out.querySelector('#v02-speed').onchange = event => { speed = Number(event.target.value); root.dataset.speed = String(speed); };
    out.querySelector('#v02-phase').oninput = event => { phase = Number(event.target.value); draw(); };
    root.dataset.exerciseId = data.id;
    root.dataset.provenance = data.provenance.evidenceStatus;
    draw();
  }

  root.querySelector('#v02-ex-find').onclick = () => {
    const query = root.querySelector('#v02-ex-input').value.toLowerCase();
    if (data.aliases.some(alias => query.includes(alias))) render();
    else {
      clearInterval(timer);
      out.textContent = '当前仅有俯卧撑教学样机；未找到可核验的动作库条目。';
    }
  };
  render();
})();
