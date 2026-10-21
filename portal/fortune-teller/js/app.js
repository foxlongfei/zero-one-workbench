/**
 * app.js -- Main application controller for Tianji web app.
 *
 * Wires together UI tabs, theme/language toggles, BaZi, Liu Yao, and Zi Wei
 * Dou Shu panels.  All heavy computation is delegated to the engine scripts
 * (bazi.js, liuyao.js, ziwei.js) that must be loaded before this file.
 * The I18n module (i18n.js) must also be loaded first.
 *
 * Pattern: IIFE, no framework dependencies -- pure DOM + Canvas + SVG.
 */
const TianjiApp = (function () {
  'use strict';

  // -----------------------------------------------------------------------
  //  Constants
  // -----------------------------------------------------------------------

  /** Heavenly stems in order (甲 = index 0). */
  const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  /** Earthly branches in order (子 = index 0). */
  const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  /** Zodiac animals aligned with branches. */
  const ZODIAC = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
  /** Element of each stem (index aligned). */
  const STEM_ELEMENT = ['木','木','火','火','土','土','金','金','水','水'];
  /** Primary element of each branch (index aligned). */
  const BRANCH_ELEMENT = ['水','土','木','木','土','火','火','土','金','金','土','水'];
  /** Element colors for theming. */
  const ELEMENT_COLORS = { '木':'#4caf50', '火':'#f44336', '土':'#ff9800', '金':'#ffd600', '水':'#2196f3' };

  /** 60 Jia-Zi cycle. */
  const JIAZI = (function () {
    const arr = [];
    for (let i = 0; i < 60; i++) arr.push(STEMS[i % 10] + BRANCHES[i % 12]);
    return arr;
  })();

  // (BaZi engine constants removed — now using bazi.js + calendar.js)

  // Liu Yao: trigram codes and hexagram tables
  const TRIGRAM_ORDER = [7,6,5,4,3,2,1,0]; // 先天 order for modular mapping
  const TRIGRAM_NAMES = { 7:'乾', 6:'兑', 5:'离', 4:'震', 3:'巽', 2:'坎', 1:'艮', 0:'坤' };

  // 64 hexagrams: [number, name, symbol, upperCode, lowerCode, description]
  const HEX_DATA = [
    [1,'乾','䷀',7,7,'天行健，君子以自强不息'],[2,'坤','䷁',0,0,'地势坤，君子以厚德载物'],
    [3,'屯','䷂',2,4,'刚柔始交而难生'],[4,'蒙','䷃',1,2,'山下有险，蒙'],
    [5,'需','䷄',2,7,'需，有孚，光亨'],[6,'讼','䷅',7,2,'天与水违行，讼'],
    [7,'师','䷆',0,2,'地中有水，师'],[8,'比','䷇',2,0,'地上有水，比'],
    [9,'小畜','䷈',3,7,'风行天上，小畜'],[10,'履','䷉',7,6,'上天下泽，履'],
    [11,'泰','䷊',0,7,'天地交，泰'],[12,'否','䷋',7,0,'天地不交，否'],
    [13,'同人','䷌',7,5,'天与火，同人'],[14,'大有','䷍',5,7,'火在天上，大有'],
    [15,'谦','䷎',0,1,'地中有山，谦'],[16,'豫','䷏',4,0,'雷出地奋，豫'],
    [17,'随','䷐',6,4,'泽中有雷，随'],[18,'蛊','䷑',1,3,'山下有风，蛊'],
    [19,'临','䷒',0,6,'泽上有地，临'],[20,'观','䷓',3,0,'风行地上，观'],
    [21,'噬嗑','䷔',5,4,'雷电，噬嗑'],[22,'贲','䷕',1,5,'山下有火，贲'],
    [23,'剥','䷖',1,0,'山附于地，剥'],[24,'复','䷗',0,4,'雷在地中，复'],
    [25,'无妄','䷘',7,4,'天下雷行，无妄'],[26,'大畜','䷙',1,7,'天在山中，大畜'],
    [27,'颐','䷚',1,4,'山下有雷，颐'],[28,'大过','䷛',6,3,'泽灭木，大过'],
    [29,'坎','䷜',2,2,'水洊至，习坎'],[30,'离','䷝',5,5,'明两作，离'],
    [31,'咸','䷞',6,1,'山上有泽，咸'],[32,'恒','䷟',4,3,'雷风，恒'],
    [33,'遁','䷠',7,1,'天下有山，遁'],[34,'大壮','䷡',4,7,'雷在天上，大壮'],
    [35,'晋','䷢',5,0,'明出地上，晋'],[36,'明夷','䷣',0,5,'明入地中，明夷'],
    [37,'家人','䷤',3,5,'风自火出，家人'],[38,'睽','䷥',5,6,'上火下泽，睽'],
    [39,'蹇','䷦',2,1,'山上有水，蹇'],[40,'解','䷧',4,2,'雷雨作，解'],
    [41,'损','䷨',1,6,'山下有泽，损'],[42,'益','䷩',3,4,'风雷，益'],
    [43,'夬','䷪',6,7,'泽上于天，夬'],[44,'姤','䷫',7,3,'天下有风，姤'],
    [45,'萃','䷬',6,0,'泽上于地，萃'],[46,'升','䷭',0,3,'地中生木，升'],
    [47,'困','䷮',6,2,'泽无水，困'],[48,'井','䷯',2,3,'木上有水，井'],
    [49,'革','䷰',6,5,'泽中有火，革'],[50,'鼎','䷱',5,3,'木上有火，鼎'],
    [51,'震','䷲',4,4,'洊雷，震'],[52,'艮','䷳',1,1,'兼山，艮'],
    [53,'渐','䷴',3,1,'山上有木，渐'],[54,'归妹','䷵',4,6,'泽上有雷，归妹'],
    [55,'丰','䷶',4,5,'雷电皆至，丰'],[56,'旅','䷷',5,1,'山上有火，旅'],
    [57,'巽','䷸',3,3,'随风，巽'],[58,'兑','䷹',6,6,'丽泽，兑'],
    [59,'涣','䷺',3,2,'风行水上，涣'],[60,'节','䷻',2,6,'泽上有水，节'],
    [61,'中孚','䷼',3,6,'泽上有风，中孚'],[62,'小过','䷽',4,1,'山上有雷，小过'],
    [63,'既济','䷾',2,5,'水在火上，既济'],[64,'未济','䷿',5,2,'火在水上，未济'],
  ];
  /** Conventional English titles in King Wen sequence order. */
  const HEXAGRAM_EN_NAMES = [
    null,
    'The Creative', 'The Receptive', 'Difficulty at the Beginning', 'Youthful Folly',
    'Waiting', 'Conflict', 'The Army', 'Holding Together',
    'The Taming Power of the Small', 'Treading', 'Peace', 'Standstill',
    'Fellowship with Others', 'Possession in Great Measure', 'Modesty', 'Enthusiasm',
    'Following', 'Work on What Has Been Spoiled', 'Approach', 'Contemplation',
    'Biting Through', 'Grace', 'Splitting Apart', 'Return',
    'Innocence', 'The Taming Power of the Great', 'The Corners of the Mouth',
    'Preponderance of the Great', 'The Abysmal', 'The Clinging', 'Influence', 'Duration',
    'Retreat', 'The Power of the Great', 'Progress', 'Darkening of the Light',
    'The Family', 'Opposition', 'Obstruction', 'Deliverance',
    'Decrease', 'Increase', 'Breakthrough', 'Coming to Meet',
    'Gathering Together', 'Pushing Upward', 'Oppression', 'The Well',
    'Revolution', 'The Cauldron', 'The Arousing', 'Keeping Still',
    'Development', 'The Marrying Maiden', 'Abundance', 'The Wanderer',
    'The Gentle', 'The Joyous', 'Dispersion', 'Limitation',
    'Inner Truth', 'Preponderance of the Small', 'After Completion', 'Before Completion'
  ];
  const TRIGRAM_EN_NATURE = {
    7: 'Heaven', 6: 'Lake', 5: 'Fire', 4: 'Thunder',
    3: 'Wind', 2: 'Water', 1: 'Mountain', 0: 'Earth'
  };

  /** Lookup hex by (upper, lower) codes. */
  const HEX_BY_TRIGRAMS = {};
  HEX_DATA.forEach(function (h) { HEX_BY_TRIGRAMS[h[3] + ',' + h[4]] = h; });

  // Zi Wei palace names (order matches Python PALACE_NAMES)
  const ZW_PALACES = [
    '命宫','兄弟宫','夫妻宫','子女宫','财帛宫','疾厄宫',
    '迁移宫','奴仆宫','官禄宫','田宅宫','福德宫','父母宫'
  ];
  const ZW_WU_XING_JU = [2,6,5,3,4,2,6,5,3,4,2,6]; // by ming position index

  // Zi Wei star group offsets
  const ZIWEI_GROUP = { '紫微':0,'天机':-1,'太阳':-2,'武曲':-3,'天同':-4,'廉贞':-6 };
  const TIANFU_GROUP = { '天府':0,'太阴':1,'贪狼':2,'巨门':3,'天相':4,'天梁':5,'七杀':6,'破军':10 };

  // -----------------------------------------------------------------------
  //  State
  // -----------------------------------------------------------------------
  let activeTab = 'bazi';
  let darkTheme = false;
  let lastLiuYaoResult = null;
  let pendingSharedLiuYaoLines = null;
  let liuYaoStatusMessageKey = null;
  let liuYaoStatusIsAlert = false;

  // -----------------------------------------------------------------------
  //  Helpers
  // -----------------------------------------------------------------------

  /** Short alias for getElementById. */
  function $(id) { return document.getElementById(id); }

  /** Create element with optional class and text. */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /** Mod that always returns non-negative. */
  function mod(n, m) { return ((n % m) + m) % m; }

  /** Convert clock hour (0-23) to branch index. */
  function hourToBranch(h) { return h === 23 ? 0 : Math.floor((h + 1) / 2); }

  /** Localized Liu Yao line position, with an optional compact SVG label. */
  function linePositionLabel(index, compact) {
    return I18n.t((compact ? 'linePositionShort' : 'linePosition') + (index + 1));
  }

  /** Localized hexagram title without changing the bundled casting engine data. */
  function localizedHexagramName(hexagram) {
    if (I18n.getLang() !== 'en') return hexagram[1];
    return HEXAGRAM_EN_NAMES[hexagram[0]] || ('Hexagram ' + hexagram[0]);
  }

  /** Plain structural description derived from the existing upper/lower trigrams. */
  function localizedHexagramDescription(hexagram) {
    if (I18n.getLang() !== 'en') return hexagram[5];
    return TRIGRAM_EN_NATURE[hexagram[3]] + ' over ' +
      TRIGRAM_EN_NATURE[hexagram[4]] + '.';
  }

  /** Localized lunar date value from the calendar engine's structured result. */
  function localizedLunarDate(lunar) {
    if (I18n.getLang() !== 'en') return lunar.traditional.replace(/^农历/, '');
    var month = I18n.t('lunarMonthName' + lunar.month);
    var leap = lunar.isLeap ? I18n.t('leapMonth') + ' · ' : '';
    return lunar.year + ' · ' + leap + month + ' · ' +
      I18n.t('lunarDay') + ' ' + lunar.day;
  }

  /** Localized traditional Nayin name without changing the bundled BaZi engine. */
  function localizedNayin(name) {
    if (I18n.getLang() !== 'en') return name;
    var names = {
      '海中金': 'Metal in the Sea', '炉中火': 'Fire in the Furnace',
      '大林木': 'Wood of the Great Forest', '路旁土': 'Earth by the Road',
      '剑锋金': 'Metal of the Sword Edge', '山头火': 'Fire on the Mountain',
      '涧下水': 'Water in the Ravine', '城头土': 'Earth on the City Wall',
      '白蜡金': 'White Wax Metal', '杨柳木': 'Willow Wood',
      '泉中水': 'Water in the Spring', '屋上土': 'Earth on the Roof',
      '霹雳火': 'Thunderbolt Fire', '松柏木': 'Pine and Cypress Wood',
      '长流水': 'Long-Flowing Water', '沙中金': 'Metal in the Sand',
      '山下火': 'Fire below the Mountain', '平地木': 'Wood on the Plain',
      '壁上土': 'Earth on the Wall', '金箔金': 'Gold Foil Metal',
      '佛灯火': 'Lamp Fire', '天河水': 'Water of the Milky Way',
      '大驿土': 'Earth of the Great Post Road', '钗钏金': 'Hairpin and Bracelet Metal',
      '桑柘木': 'Mulberry Wood', '大溪水': 'Water of the Great Stream',
      '沙中土': 'Earth in the Sand', '天上火': 'Fire in the Sky',
      '石榴木': 'Pomegranate Wood', '大海水': 'Water of the Great Sea'
    };
    return names[name] || name;
  }

  // (BaZi engine functions removed — now delegated to bazi.js)

  // -----------------------------------------------------------------------
  //  Liu Yao Engine
  // -----------------------------------------------------------------------

  function liuYaoCastByTime(dt) {
    dt = dt || new Date();
    var y = dt.getFullYear(), m = dt.getMonth() + 1, d = dt.getDate(), h = dt.getHours();
    var total = y + m + d + h;
    // Traditional Xiantian numbering is one-based: remainder 0 maps to
    // Kun (8) and line 6, rather than wrapping to Qian / line 1.
    var upperIdx = mod(y + m + d - 1, 8);
    var lowerIdx = mod(total - 1, 8);
    var movingPos = mod(total - 1, 6) + 1; // 1-6, remainder 0 => line 6
    var upperCode = TRIGRAM_ORDER[upperIdx];
    var lowerCode = TRIGRAM_ORDER[lowerIdx];
    return _buildCastResult('time', upperCode, lowerCode, movingPos);
  }

  function liuYaoCastByNumber(n1, n2, n3) {
    var upperCode = TRIGRAM_ORDER[mod(n1 - 1, 8)];
    var lowerCode = TRIGRAM_ORDER[mod(n2 - 1, 8)];
    var movingNumber = n3 != null ? n3 : n1 + n2;
    var movingPos = mod(movingNumber - 1, 6) + 1;
    return _buildCastResult('number', upperCode, lowerCode, movingPos);
  }

  function liuYaoCastByCoin() {
    var rawLines = [];
    for (var i = 0; i < 6; i++) {
      var sum = 0;
      for (var c = 0; c < 3; c++) sum += Math.random() < 0.5 ? 2 : 3;
      rawLines.push(sum); // 6,7,8,9
    }
    return _buildCoinResult(rawLines, 'coin');
  }

  function _buildCastResult(method, upperCode, lowerCode, movingPos) {
    // Build raw lines from trigram codes
    var rawLines = [];
    for (var i = 0; i < 3; i++) rawLines.push(((lowerCode >> i) & 1) ? 7 : 8);
    for (var j = 0; j < 3; j++) rawLines.push(((upperCode >> j) & 1) ? 7 : 8);
    // Apply moving line
    var ml = movingPos - 1;
    rawLines[ml] = rawLines[ml] === 7 ? 9 : 6;
    return _buildCoinResult(rawLines, method);
  }

  function _buildCoinResult(rawLines, method) {
    var primary = [], changed = [], moving = [];
    for (var i = 0; i < 6; i++) {
      var v = rawLines[i];
      var isYang = (v === 7 || v === 9 || v === 1);
      primary.push(isYang ? 1 : 0);
      if (v === 6) { changed.push(1); moving.push(i + 1); }
      else if (v === 7) { changed.push(1); }
      else if (v === 8) { changed.push(0); }
      else { changed.push(0); moving.push(i + 1); }
    }
    // Lookup hexagrams
    var pLower = primary[0] | (primary[1] << 1) | (primary[2] << 2);
    var pUpper = primary[3] | (primary[4] << 1) | (primary[5] << 2);
    var cLower = changed[0] | (changed[1] << 1) | (changed[2] << 2);
    var cUpper = changed[3] | (changed[4] << 1) | (changed[5] << 2);
    var primaryHex = HEX_BY_TRIGRAMS[pUpper + ',' + pLower] || HEX_DATA[0];
    var changedHex = moving.length > 0 ? (HEX_BY_TRIGRAMS[cUpper + ',' + cLower] || null) : null;
    return {
      rawLines: rawLines,
      primaryLines: primary,
      changedLines: changed,
      movingPositions: moving,
      primaryHex: primaryHex,
      changedHex: changedHex,
      method: method || 'coin',
    };
  }

  // -----------------------------------------------------------------------
  //  Zi Wei Engine (simplified)
  // -----------------------------------------------------------------------

  function ziWeiCalc(lunarYear, lunarMonth, lunarDay, hour, gender) {
    var hourBranch = hourToBranch(hour);
    var mingPos = mod(2 + lunarMonth - 1 - hourBranch, 12);
    var wuXingJu = ZW_WU_XING_JU[mingPos];

    // Place 12 palaces (counterclockwise from ming)
    var palaces = [];
    for (var i = 0; i < 12; i++) {
      var pos = mod(mingPos + i, 12);
      palaces.push({ name: ZW_PALACES[i], position: pos, branch: BRANCHES[pos], stars: [] });
    }

    // Zi Wei position from lunar day and wu-xing-ju
    var q = Math.floor(lunarDay / wuXingJu);
    var r = lunarDay % wuXingJu;
    var zwPos;
    if (r === 0) zwPos = q - 1;
    else if (r % 2 === 1) zwPos = q + 1;
    else zwPos = q;
    zwPos = mod(zwPos + 1, 12);

    // Place Zi Wei group
    var starMap = {};
    for (var star in ZIWEI_GROUP) {
      var p = mod(zwPos + ZIWEI_GROUP[star], 12);
      starMap[star] = p;
      var pal = palaces.find(function (x) { return x.position === p; });
      if (pal) pal.stars.push(star);
    }
    // Tian Fu position (symmetric to Zi Wei about Yin-Shen axis)
    var tfPos = mod(12 - zwPos + 4, 12);
    for (var star2 in TIANFU_GROUP) {
      var p2 = mod(tfPos + TIANFU_GROUP[star2], 12);
      starMap[star2] = p2;
      var pal2 = palaces.find(function (x) { return x.position === p2; });
      if (pal2) pal2.stars.push(star2);
    }

    return { palaces: palaces, starMap: starMap, mingPos: mingPos, wuXingJu: wuXingJu };
  }

  // -----------------------------------------------------------------------
  //  Five Elements Radar Chart (Canvas 2D) — Enhanced with gradients
  // -----------------------------------------------------------------------

  /** Five-element traditional colors for radar chart. */
  var RADAR_COLORS = {
    '木': '#4caf50',
    '火': '#f44336',
    '土': '#ff9800',
    '金': '#ffd600',
    '水': '#2196f3'
  };

  /**
   * Draw a premium radar (pentagon) chart with gradient fill and expand animation.
   * @param {HTMLCanvasElement} canvas
   * @param {Object} scores  e.g. { '木':3, '火':1.5, ... }
   * @param {boolean} [animate=true]
   */
  function drawRadarChart(canvas, scores, animate) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var W = rect.width || 300;
    var H = rect.height || 300;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var cx = W / 2, cy = H / 2;
    var R = Math.min(W, H) * 0.36;
    var labels = ['木','火','土','金','水'];
    var vals = labels.map(function (l) { return scores[l] || 0; });
    var maxVal = Math.max.apply(null, vals.concat([1]));
    var angleStep = (2 * Math.PI) / 5;
    var startAngle = -Math.PI / 2;
    var isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    function vtx(i, frac) {
      var a = startAngle + i * angleStep;
      return { x: cx + R * frac * Math.cos(a), y: cy + R * frac * Math.sin(a) };
    }

    function drawFrame(progress) {
      ctx.clearRect(0, 0, W, H);

      // Grid rings (4 levels)
      ctx.strokeStyle = isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 0.5;
      [0.25, 0.5, 0.75, 1].forEach(function (frac) {
        ctx.beginPath();
        for (var i = 0; i <= 5; i++) {
          var v = vtx(i % 5, frac);
          if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y);
        }
        ctx.closePath();
        ctx.stroke();
      });

      // Axis lines
      ctx.strokeStyle = isDark ? 'rgba(212, 175, 55, 0.08)' : 'rgba(0, 0, 0, 0.06)';
      for (var a = 0; a < 5; a++) {
        var v1 = vtx(a, 1);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(v1.x, v1.y);
        ctx.stroke();
      }

      // Data polygon with gradient fill
      ctx.beginPath();
      for (var d = 0; d < 5; d++) {
        var frac = (vals[d] / maxVal) * progress;
        var vd = vtx(d, frac);
        if (d === 0) ctx.moveTo(vd.x, vd.y); else ctx.lineTo(vd.x, vd.y);
      }
      ctx.closePath();

      // Radial gradient fill
      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      if (isDark) {
        grad.addColorStop(0, 'rgba(212, 175, 55, 0.3)');
        grad.addColorStop(1, 'rgba(192, 57, 43, 0.15)');
      } else {
        grad.addColorStop(0, 'rgba(212, 175, 55, 0.25)');
        grad.addColorStop(1, 'rgba(192, 57, 43, 0.1)');
      }
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke
      ctx.strokeStyle = isDark ? 'rgba(212, 175, 55, 0.6)' : 'rgba(180, 140, 40, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Data points with glow
      for (var p = 0; p < 5; p++) {
        var fp = (vals[p] / maxVal) * progress;
        var vp = vtx(p, fp);
        // Glow
        ctx.beginPath();
        ctx.arc(vp.x, vp.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = RADAR_COLORS[labels[p]].replace(')', ', 0.3)').replace('rgb', 'rgba');
        ctx.fill();
        // Dot
        ctx.beginPath();
        ctx.arc(vp.x, vp.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = RADAR_COLORS[labels[p]];
        ctx.fill();
        ctx.strokeStyle = isDark ? '#0a0a0f' : '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var lb = 0; lb < 5; lb++) {
        var vl = vtx(lb, 1.22);
        var elKey = { '木':'wood','火':'fire','土':'earth','金':'metal','水':'water' }[labels[lb]];
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillStyle = RADAR_COLORS[labels[lb]];
        ctx.fillText(I18n.t(elKey), vl.x, vl.y - 8);
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillStyle = isDark ? 'rgba(232, 224, 208, 0.7)' : 'rgba(28, 24, 16, 0.6)';
        ctx.fillText(vals[lb].toFixed(1), vl.x, vl.y + 8);
      }
    }

    // Animation: expand from center
    if (animate !== false && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var start = null;
      var duration = 600;
      function step(ts) {
        if (!start) start = ts;
        var elapsed = ts - start;
        var t = Math.min(elapsed / duration, 1);
        // Ease out cubic
        var p = 1 - Math.pow(1 - t, 3);
        drawFrame(p);
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    } else {
      drawFrame(1);
    }
  }

  // -----------------------------------------------------------------------
  //  SVG Hexagram Visualization
  // -----------------------------------------------------------------------

  /**
   * Build an SVG string for a hexagram (6 lines, bottom to top).
   * @param {Array<number>} lines  [0|1, ...] bottom to top, 1=yang
   * @param {Array<number>} movingPositions  1-based positions of moving lines
   * @returns {string} SVG markup
   */
  function buildHexagramSVG(lines, movingPositions) {
    var w = 200, lineH = 24, gap = 8, padY = 16;
    var h = 6 * lineH + 5 * gap + 2 * padY;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">';

    var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    var strokeColor = isDark ? '#e8e0d0' : '#1c1810';
    var movingColor = '#f44336';
    var lineW = 160, lx = (w - lineW) / 2;

    for (var i = 5; i >= 0; i--) {
      var row = 5 - i; // visual row 0=top
      var y = padY + row * (lineH + gap) + lineH / 2;
      var isMoving = movingPositions.indexOf(i + 1) !== -1;
      var color = isMoving ? movingColor : strokeColor;
      var sw = 4;

      if (lines[i] === 1) {
        // Yang: solid line
        svg += '<line x1="' + lx + '" y1="' + y + '" x2="' + (lx + lineW) + '" y2="' + y + '" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="round"';
        if (isMoving) svg += ' class="moving-line"';
        svg += '/>';
      } else {
        // Yin: broken line with gap
        var half = (lineW - 20) / 2;
        svg += '<line x1="' + lx + '" y1="' + y + '" x2="' + (lx + half) + '" y2="' + y + '" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="round"';
        if (isMoving) svg += ' class="moving-line"';
        svg += '/>';
        svg += '<line x1="' + (lx + half + 20) + '" y1="' + y + '" x2="' + (lx + lineW) + '" y2="' + y + '" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="round"';
        if (isMoving) svg += ' class="moving-line"';
        svg += '/>';
      }

      // Position label (left)
      svg += '<text x="' + (lx - 14) + '" y="' + (y + 1) + '" text-anchor="end" font-size="12" fill="' + color + '">' + linePositionLabel(i, true) + '</text>';

      // Moving marker (right)
      if (isMoving) {
        svg += '<circle cx="' + (lx + lineW + 14) + '" cy="' + y + '" r="5" fill="' + movingColor + '" opacity="0.8"/>';
      }
    }
    svg += '</svg>';
    return svg;
  }

  // -----------------------------------------------------------------------
  //  UI Rendering
  // -----------------------------------------------------------------------

  /** Apply all [data-i18n] attributes in the DOM. */
  function applyI18n() {
    document.documentElement.lang = I18n.getLang() === 'zh' ? 'zh-CN' : 'en';
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-i18n');
      els[i].textContent = I18n.t(key);
    }
    // Also update placeholders
    var phs = document.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < phs.length; j++) {
      phs[j].placeholder = I18n.t(phs[j].getAttribute('data-i18n-placeholder'));
    }
    // Keep accessible names and hover hints in sync with visible language.
    var ariaLabels = document.querySelectorAll('[data-i18n-aria]');
    for (var k = 0; k < ariaLabels.length; k++) {
      ariaLabels[k].setAttribute('aria-label', I18n.t(ariaLabels[k].getAttribute('data-i18n-aria')));
    }
    var titles = document.querySelectorAll('[data-i18n-title]');
    for (var m = 0; m < titles.length; m++) {
      titles[m].setAttribute('title', I18n.t(titles[m].getAttribute('data-i18n-title')));
    }
    // Update page title
    document.title = I18n.t('appTitle') + ' - ' + I18n.t('appSubtitle');
  }

  /** Toggle theme using data-theme attribute. */
  function toggleTheme() {
    darkTheme = !darkTheme;
    document.documentElement.setAttribute('data-theme', darkTheme ? 'dark' : 'light');
    var btn = $('theme-toggle');
    if (btn) btn.textContent = darkTheme ? '🌙' : '☀️';
    // Redraw canvas if visible
    refreshActiveTab();
  }

  /** Toggle language. */
  function toggleLang() {
    var lang = I18n.toggle();
    var btn = $('lang-toggle');
    if (btn) btn.textContent = lang === 'zh' ? 'EN' : '中';
    applyI18n();
    rebuildHourSelector();
    rebuildZiweiSelectors();
    // Language is global, so refresh every existing result, including hidden tabs.
    calculateBazi();
    if (lastLiuYaoResult) renderLiuyaoResult(lastLiuYaoResult);
    else if (liuYaoStatusMessageKey) {
      clearLiuyaoResult(liuYaoStatusMessageKey, liuYaoStatusIsAlert);
    }
    calculateZiwei();
  }

  /** Switch active tab — syncs desktop tabs, mobile bottom nav, and panels. */
  function switchTab(tab) {
    activeTab = tab;
    ['bazi','liuyao','ziwei'].forEach(function (t) {
      var panel = $('panel-' + t);
      var tabBtn = $('tab-' + t);
      var isActive = t === tab;
      if (panel) {
        panel.style.display = isActive ? 'block' : 'none';
        if (isActive) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      }
      // Desktop tabs
      if (tabBtn) {
        tabBtn.classList.toggle('active', isActive);
        tabBtn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
    });
    // Mobile bottom nav
    var bottomItems = document.querySelectorAll('.bottom-nav-item');
    for (var i = 0; i < bottomItems.length; i++) {
      var itemTab = bottomItems[i].getAttribute('data-tab');
      var active = itemTab === tab;
      bottomItems[i].classList.toggle('active', active);
      bottomItems[i].setAttribute('aria-selected', active ? 'true' : 'false');
    }
    refreshActiveTab();
  }

  /** Refresh the currently active tab's content. */
  function refreshActiveTab() {
    if (activeTab === 'bazi') calculateBazi();
    else if (activeTab === 'liuyao' && lastLiuYaoResult) renderLiuyaoResult(lastLiuYaoResult);
    else if (activeTab === 'ziwei') calculateZiwei();
  }

  // -----------------------------------------------------------------------
  //  Hour Selector Builder
  // -----------------------------------------------------------------------

  /**
   * Rebuild hour selector with branch indices 0-11 as values.
   * Values correspond to: 子(0), 丑(1), 寅(2), ..., 亥(11).
   */
  function rebuildHourSelector() {
    var sel = $('bazi-hour');
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = '';
    for (var i = 0; i < 12; i++) {
      var opt = document.createElement('option');
      opt.value = i; // branch index
      opt.textContent = I18n.t('shiChen' + i);
      sel.appendChild(opt);
    }
    // Restore selection
    if (current !== undefined && current !== '') {
      sel.value = current;
    }
  }

  /** Rebuild Zi Wei lunar-month and hour selectors in the active language. */
  function rebuildZiweiSelectors() {
    var monthSel = $('ziwei-month');
    if (monthSel) {
      var currentMonth = monthSel.value;
      monthSel.innerHTML = '';
      for (var month = 1; month <= 12; month++) {
        var monthOpt = document.createElement('option');
        monthOpt.value = month;
        monthOpt.textContent = I18n.t('lunarMonthName' + month);
        monthOpt.defaultSelected = month === 4;
        monthSel.appendChild(monthOpt);
      }
      monthSel.value = currentMonth || '4';
    }

    var hourSel = $('ziwei-hour');
    if (hourSel) {
      var currentHour = hourSel.value;
      hourSel.innerHTML = '';
      for (var hour = 0; hour < 12; hour++) {
        var hourOpt = document.createElement('option');
        hourOpt.value = hour;
        hourOpt.textContent = I18n.t('shiChen' + hour);
        hourOpt.defaultSelected = hour === 7;
        hourSel.appendChild(hourOpt);
      }
      hourSel.value = currentHour || '7';
    }
  }

  /** Convert hour branch index (0-11) to representative clock hour (0-23). */
  function branchIdxToClockHour(branchIdx) {
    return branchIdx === 0 ? 23 : branchIdx * 2 - 1;
  }

  // -----------------------------------------------------------------------
  //  BaZi Tab Rendering
  // -----------------------------------------------------------------------

  /**
   * calculateBazi — 综合八字排盘
   *
   * Uses BaZi.createChart() engine for all computation.
   * Renders: 农历日期, 四柱+纳音, 十神, 藏干, 胎元/命宫, 神煞,
   *          五行分析, 日主强弱, 用神忌神, 格局, 地支关系, 大运, 流年
   */
  function calculateBazi() {
    var dateStr = $('bazi-date') ? $('bazi-date').value : '';
    var hourBranchIdx = $('bazi-hour') ? parseInt($('bazi-hour').value, 10) : 7;
    var genderVal = document.querySelector('input[name="bazi-gender"]:checked');
    var gender = genderVal ? genderVal.value : 'male';

    var resultArea = $('bazi-result');
    if (!resultArea) return;

    if (!dateStr) {
      resultArea.innerHTML = '<p class="empty-state">' + I18n.t('noData') + '</p>';
      return;
    }

    var parts = dateStr.split('-');
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);
    var parsedDate = new Date(Date.UTC(year, month - 1, day));
    var validDate = parts.length === 3 && year >= 1900 && year <= 2100 &&
      month >= 1 && month <= 12 && day >= 1 && day <= 31 &&
      parsedDate.getUTCFullYear() === year &&
      parsedDate.getUTCMonth() === month - 1 &&
      parsedDate.getUTCDate() === day &&
      hourBranchIdx >= 0 && hourBranchIdx <= 11;
    if (!validDate) {
      resultArea.innerHTML = '<p class="empty-state" role="alert">' + I18n.t('invalidDate') + '</p>';
      return;
    }
    var clockHour = branchIdxToClockHour(hourBranchIdx);

    // ── Core computation via BaZi engine ──
    var chart = BaZi.createChart(year, month, day, clockHour, gender);
    var tenGods = BaZi.tenGodsFromChart(chart);
    var elements = BaZi.analyzeFiveElements(chart.allStems, chart.allBranches);
    var strength = BaZi.analyzeDayMasterStrength(chart);
    var nayinArr = BaZi.getNayinForChart(chart);
    var taiyuan = BaZi.computeTaiyuan(chart);
    var minggong = BaZi.computeMinggong(chart);
    var shensha = BaZi.computeShensha(chart);
    var pattern = BaZi.analyzePattern(chart, strength);
    var favorable = BaZi.suggestFavorable(chart, strength, elements);
    var relResult = BaZi.analyzeRelationships(chart.allBranches);
    var luck = BaZi.computeLuckPillars(chart);
    var lunar = BaZi.getLunarDate(year, month, day);

    var dmChar = chart.dayMasterChar;
    var dmElement = chart.dayMasterElement;
    var pillars = chart.pillars;

    // Shorthand lookups
    function stemColor(sIdx) { return ELEMENT_COLORS[STEM_ELEMENT[sIdx]]; }
    function branchColor(bIdx) { return ELEMENT_COLORS[BRANCH_ELEMENT[bIdx]]; }
    var stemI18nKeys = ['stemJia','stemYi','stemBing','stemDing','stemWu','stemJi','stemGeng','stemXin','stemRen','stemGui'];
    var branchI18nKeys = ['branchZi','branchChou','branchYin','branchMao','branchChen','branchSi','branchWu2','branchWei','branchShen','branchYou','branchXu','branchHai'];
    var zodiacI18nKeys = ['rat','ox','tiger','rabbit','dragon','snake','horse','goat','monkey','rooster','dog','pig'];
    var tenGodI18nKeys = {
      '比肩':'bijian', '劫财':'jiecai', '食神':'shishen', '伤官':'shangguan',
      '偏财':'piancai', '正财':'zhengcai', '七杀':'qisha', '正官':'zhengguan',
      '偏印':'pianyin', '正印':'zhengyin'
    };
    function localizedStem(index) { return I18n.t(stemI18nKeys[index]); }
    function localizedBranch(index) { return I18n.t(branchI18nKeys[index]); }
    function localizedZodiac(index) { return I18n.t(zodiacI18nKeys[index]); }
    function localizedTenGod(name) {
      var key = tenGodI18nKeys[name];
      return key ? I18n.t(key) : name;
    }
    function localizedGanzhi(value) {
      if (I18n.getLang() !== 'en') return value;
      return value.split('').map(function (char) {
        var stemIndex = STEMS.indexOf(char);
        if (stemIndex !== -1) return localizedStem(stemIndex);
        var branchIndex = BRANCHES.indexOf(char);
        return branchIndex !== -1 ? localizedBranch(branchIndex) : char;
      }).join('');
    }
    function localizedShenshaName(name) {
      if (I18n.getLang() !== 'en') return name;
      var names = {
        '天乙贵人': 'Heavenly Noble', '文昌贵人': 'Literary Star',
        '驿马': 'Traveling Horse', '桃花': 'Peach Blossom',
        '华盖': 'Canopy Star', '将星': 'General Star',
        '天德': 'Heavenly Virtue', '月德': 'Monthly Virtue',
        '禄神': 'Prosperity Star', '羊刃': 'Yang Blade'
      };
      return names[name] || name;
    }
    function localizedPillarName(name) {
      if (I18n.getLang() !== 'en') return name;
      return { '年': 'Year', '月': 'Month', '日': 'Day', '时': 'Hour' }[name] || name;
    }

    function localizedElementWithRole(value) {
      if (I18n.getLang() !== 'en') return value;
      var match = /^([木火土金水])(?:\((官杀|食伤|财|印|比劫)\))?$/.exec(value);
      if (!match) return value;
      var elementKey = { '木': 'wood', '火': 'fire', '土': 'earth', '金': 'metal', '水': 'water' }[match[1]];
      var role = {
        '官杀': 'Officer / Power', '食伤': 'Output', '财': 'Wealth',
        '印': 'Resource', '比劫': 'Peers'
      }[match[2]];
      return I18n.t(elementKey) + (role ? ' (' + role + ')' : '');
    }

    function localizedStrengthFactor(factor) {
      if (I18n.getLang() !== 'en') return factor;
      var match = /^(得令|失令): ([子丑寅卯辰巳午未申酉戌亥])月(生|克)([木火土金水]) \(([+-]?\d+(?:\.\d+)?)\)$/.exec(factor);
      if (match) {
        var month = localizedBranch(BRANCHES.indexOf(match[2]));
        var element = localizedElementWithRole(match[4]);
        return (match[1] === '得令' ? 'Seasonal support: ' : 'Seasonal restraint: ') +
          month + ' month ' + (match[3] === '生' ? 'supports ' : 'controls ') + element +
          ' (' + match[5] + ')';
      }
      match = /^得地: (年支|日支|时支)([子丑寅卯辰巳午未申酉戌亥])藏([甲乙丙丁戊己庚辛壬癸])\(([木火土金水])\) \(([+-]?\d+(?:\.\d+)?)\)$/.exec(factor);
      if (match) {
        var branchPlace = { '年支': 'Year branch', '日支': 'Day branch', '时支': 'Hour branch' }[match[1]];
        return 'Root support: ' + branchPlace + ' ' + localizedBranch(BRANCHES.indexOf(match[2])) +
          ' contains ' + localizedStem(STEMS.indexOf(match[3])) + ' (' + localizedElementWithRole(match[4]) +
          ') (' + match[5] + ')';
      }
      match = /^得地: (年支|日支|时支)藏干生日主 \(([+-]?\d+(?:\.\d+)?)\)$/.exec(factor);
      if (match) {
        return 'Root support: ' + { '年支': 'Year branch', '日支': 'Day branch', '时支': 'Hour branch' }[match[1]] +
          ' contains a stem that supports the Day Master (' + match[2] + ')';
      }
      match = /^得势: (年干|月干|时干)([甲乙丙丁戊己庚辛壬癸])(比劫|生日主) \(([+-]?\d+(?:\.\d+)?)\)$/.exec(factor);
      if (match) {
        var stemPlace = { '年干': 'Year stem', '月干': 'Month stem', '时干': 'Hour stem' }[match[1]];
        return 'Peer support: ' + stemPlace + ' ' + localizedStem(STEMS.indexOf(match[2])) +
          (match[3] === '比劫' ? ' is a peer of the Day Master' : ' supports the Day Master') +
          ' (' + match[4] + ')';
      }
      return 'Strength factor';
    }

    function localizedPatternName(name) {
      if (I18n.getLang() !== 'en') return name;
      var special = { '建禄格': 'Prosperity Pattern', '羊刃格': 'Yang Blade Pattern', '杂气格': 'Mixed Qi Pattern' };
      if (special[name]) return special[name];
      if (/格$/.test(name)) return localizedTenGod(name.slice(0, -1)) + ' Pattern';
      return 'Chart Pattern';
    }

    function localizedPatternDescription(name) {
      if (I18n.getLang() !== 'en') return pattern.description;
      var descriptions = {
        '建禄格': 'The month branch is the Day Master’s prosperity position. The chart is strong and benefits from Wealth and Officer influences.',
        '羊刃格': 'The month branch is the Day Master’s Yang Blade. Strong drive benefits from disciplined Officer or Power influence.',
        '杂气格': 'The pattern is mixed and should be evaluated with the full chart.',
        '比肩格': 'Companion energy leads the month. Independence is strong; Officer, Power, and Wealth influences can provide balance.',
        '劫财格': 'Rob Wealth energy is prominent. Competition is strong and benefits from Officer or Power restraint.',
        '食神格': 'Eating God channels Power and supports fluent expression, refinement, and talent.',
        '伤官格': 'Hurting Officer can conflict with Officer energy, while its link to Wealth can support achievement.',
        '偏财格': 'Indirect Wealth favors generosity, initiative, and flexible resource management.',
        '正财格': 'Direct Wealth favors diligence, stability, and careful stewardship.',
        '七杀格': 'Seven Killings favors decisiveness and authority, with Eating God providing useful restraint.',
        '正官格': 'Direct Officer favors discipline, propriety, and structured responsibility.',
        '偏印格': 'Indirect Resource favors insight and reflection, though it can also increase hesitation.',
        '正印格': 'Direct Resource favors learning, generosity, and sustained support.'
      };
      return descriptions[name] || 'This pattern should be evaluated in the context of the full chart.';
    }

    function localizedFavorableSuggestion(suggestion) {
      if (I18n.getLang() !== 'en') return suggestion;
      var match = /^日主偏(强|弱)，宜用(.+)(克泄耗之|生扶助之)。$/.exec(suggestion);
      if (!match) return 'Review favorable elements together with the full chart.';
      var terms = match[2].split('、').map(localizedElementWithRole).join(', ');
      return match[1] === '强'
        ? 'The Day Master is relatively strong; favor ' + terms + ' to regulate it through control, expression, and expenditure.'
        : 'The Day Master is relatively weak; favor ' + terms + ' to strengthen it through support and nourishment.';
    }

    function localizedRelationshipKind(kind) {
      if (I18n.getLang() !== 'en') return kind;
      return {
        '六合': 'Six Harmony', '三合': 'Three Harmony', '半三合': 'Half Three Harmony',
        '六冲': 'Six Clash', '三刑': 'Triple Punishment', '自刑': 'Self-Punishment',
        '相刑': 'Punishment', '六害': 'Six Harm'
      }[kind] || 'Branch Relationship';
    }

    function localizedRelationshipDescription(relationship) {
      if (I18n.getLang() !== 'en') return relationship.description;
      var branches = (relationship.branches || []).map(function (branch) {
        return localizedBranch(BRANCHES.indexOf(branch));
      });
      var resultElement = relationship.resultElement ? localizedElementWithRole(relationship.resultElement) : '';
      if (relationship.kind === '六合') return branches.join(' and ') + ' form a Six Harmony combination toward ' + resultElement + '.';
      if (relationship.kind === '三合') return branches.join(', ') + ' form a Three Harmony combination of ' + resultElement + '.';
      if (relationship.kind === '半三合') return branches.join(' and ') + ' form a partial Three Harmony combination of ' + resultElement + '.';
      if (relationship.kind === '六冲') return branches.join(' and ') + ' clash.';
      if (relationship.kind === '三刑') return branches.join(', ') + ' form a Triple Punishment.';
      if (relationship.kind === '自刑') return branches[0] + ' forms a Self-Punishment.';
      if (relationship.kind === '相刑') return branches.join(' and ') + ' form a Punishment.';
      if (relationship.kind === '六害') return branches.join(' and ') + ' form a Six Harm relationship.';
      return 'A branch relationship is present.';
    }

    // ── Build HTML ──
    var html = '';

    // 1. 日期信息 (Solar + Lunar)
    html += '<div class="bazi-date-info">';
    var gregorianValue = I18n.getLang() === 'zh'
      ? year + '年' + month + '月' + day + '日'
      : year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    html += '<span>' + I18n.t('gregorianDate') + ' ' + gregorianValue + '</span>';
    html += ' <span class="date-sep">/</span> ';
    html += '<span>' + I18n.t('lunarDate') + ' ' + localizedLunarDate(lunar) + '</span>';
    html += '</div>';

    // 2. 四柱表格 (含纳音)
    var pillarLabels = [I18n.t('yearPillar'), I18n.t('monthPillar'), I18n.t('dayPillar'), I18n.t('hourPillar')];
    html += '<div class="pillars-table"><table><thead><tr>';
    pillarLabels.forEach(function (l) { html += '<th>' + l + '</th>'; });
    html += '</tr></thead><tbody>';

    // 十神 row
    html += '<tr class="tengod-row">';
    for (var ti = 0; ti < 4; ti++) {
      var tgName = '';
      if (ti === 2) { tgName = I18n.t('dayMaster'); }
      else {
        var key = ['年干', '月干', '', '时干'][ti];
        tgName = tenGods[key] ? localizedTenGod(tenGods[key].god) : '';
      }
      html += '<td><small class="ten-god-label">' + tgName + '</small></td>';
    }
    html += '</tr>';

    // 天干 row
    html += '<tr class="stems-row">';
    pillars.forEach(function (p) {
      html += '<td><span class="stem" style="color:' + stemColor(p.stemIndex) + '">' +
        localizedStem(p.stemIndex) + '</span></td>';
    });
    html += '</tr>';

    // 地支 row
    html += '<tr class="branches-row">';
    pillars.forEach(function (p) {
      html += '<td><span class="branch" style="color:' + branchColor(p.branchIndex) + '">' +
        localizedBranch(p.branchIndex) + '</span>' +
        '<br><small>' + localizedZodiac(p.branchIndex) + '</small></td>';
    });
    html += '</tr>';

    // 藏干 row
    html += '<tr class="hidden-row">';
    var branchLabels = ['年支藏干', '月支藏干', '日支藏干', '时支藏干'];
    for (var hi = 0; hi < 4; hi++) {
      var hiddenArr = tenGods[branchLabels[hi]] || [];
      var hiddenParts = hiddenArr.map(function (h) {
        var c = ELEMENT_COLORS[STEM_ELEMENT[h.stemIndex]];
        var hiddenStemIndex = STEMS.indexOf(h.stem);
        return '<span style="color:' + c + '">' + localizedStem(hiddenStemIndex) + '</span><sub>' + localizedTenGod(h.god) + '</sub>';
      });
      html += '<td>' + (hiddenParts.length > 0 ? hiddenParts.join(' ') : '-') + '</td>';
    }
    html += '</tr>';

    // 纳音 row
    html += '<tr class="nayin-row">';
    nayinArr.forEach(function (n) {
      html += '<td><small class="nayin-label">' + localizedNayin(n.nayin) + '</small></td>';
    });
    html += '</tr>';

    html += '</tbody></table></div>';

    // 3. 日主信息 + 强弱
    html += '<div class="day-master-info">';
    html += '<strong>' + I18n.t('dayMaster') + ':</strong> ';
    html += '<span style="color:' + ELEMENT_COLORS[dmElement] + ';font-size:1.3em">' + localizedStem(chart.dayPillar.stemIndex) + '</span> ';
    var elKey = { '木': 'wood', '火': 'fire', '土': 'earth', '金': 'metal', '水': 'water' }[dmElement];
    html += '(' + I18n.t(elKey) + ')';
    var strengthLevelKey = { '极旺': 'veryStrong', '身强': 'strong', '中和': 'neutral', '身弱': 'weak', '极弱': 'veryWeak' }[strength.level];
    html += ' &mdash; ' + I18n.t('dayMasterStrength') + ': <strong>' + I18n.t(strengthLevelKey || strength.level) + '</strong>';
    html += ' (' + I18n.t('score') + ': ' + strength.score.toFixed(1) + ')';
    html += '</div>';

    // 强弱因素
    if (strength.factors.length > 0) {
      html += '<div class="strength-factors"><details><summary>' + I18n.t('strengthDetails') + '</summary><ul>';
      strength.factors.forEach(function (f) {
        html += '<li>' + localizedStrengthFactor(f) + '</li>';
      });
      html += '</ul></details></div>';
    }

    // 4. 胎元 + 命宫
    html += '<div class="taiyuan-minggong">';
    html += '<div class="tm-item"><span class="tm-label">' + I18n.t('fetalOrigin') + '</span>';
    html += '<span class="tm-value">' + localizedGanzhi(taiyuan.char) + '</span>';
    html += '<span class="tm-nayin">' + localizedNayin(taiyuan.nayin) + '</span></div>';
    html += '<div class="tm-item"><span class="tm-label">' + I18n.t('destinyPalace') + '</span>';
    html += '<span class="tm-value">' + localizedGanzhi(minggong.char) + '</span>';
    html += '<span class="tm-nayin">' + localizedNayin(minggong.nayin) + '</span></div>';
    html += '</div>';

    // 5. 神煞
    if (shensha.length > 0) {
      html += '<div class="shensha-section"><h3>' + I18n.t('auxiliaryStars') + '</h3><div class="shensha-tags">';
      shensha.forEach(function (ss) {
        var cls = 'shensha-tag';
        // 吉神用金色, 凶神用红色
        var auspicious = ['天乙贵人', '文昌贵人', '天德', '月德', '禄神', '将星'].indexOf(ss.name) !== -1;
        cls += auspicious ? ' shensha-good' : ' shensha-neutral';
        html += '<span class="' + cls + '">' + localizedShenshaName(ss.name) + '<sub>' + localizedPillarName(ss.pillar) + '</sub></span>';
      });
      html += '</div></div>';
    }

    // 6. 格局分析
    html += '<div class="pattern-section"><h3>' + I18n.t('patternAnalysis') + '</h3>';
    html += '<div class="pattern-name">' + localizedPatternName(pattern.pattern) + '</div>';
    html += '<p class="pattern-desc">' + localizedPatternDescription(pattern.pattern) + '</p>';
    html += '</div>';

    // 7. 用神忌神
    html += '<div class="favorable-section"><h3>' + I18n.t('favorableAnalysis') + '</h3>';
    html += '<div class="fav-row"><span class="fav-label">' + I18n.t('favorableLabel') + ':</span> ';
    html += '<span class="fav-good">' + favorable.favorable.map(localizedElementWithRole).join(I18n.getLang() === 'en' ? ', ' : '、') + '</span></div>';
    html += '<div class="fav-row"><span class="fav-label">' + I18n.t('unfavorableLabel') + ':</span> ';
    html += '<span class="fav-bad">' + favorable.unfavorable.map(localizedElementWithRole).join(I18n.getLang() === 'en' ? ', ' : '、') + '</span></div>';
    html += '<p class="fav-suggestion">' + localizedFavorableSuggestion(favorable.suggestion) + '</p>';
    html += '</div>';

    // 8. 五行雷达图 + 详情
    // Build element counts in {木:n, 火:n, ...} format for radar chart
    var elCounts = {};
    for (var ei = 0; ei < 5; ei++) {
      var elName = ['木', '火', '土', '金', '水'][ei];
      elCounts[elName] = elements.scores[ei];
    }
    html += '<div class="radar-section"><h3>' + I18n.t('fiveElements') + '</h3>';
    html += '<canvas id="radar-canvas" width="300" height="300" data-i18n-aria="fiveElementsChart" aria-label="' + I18n.t('fiveElementsChart') + '"></canvas>';
    // 五行详情
    html += '<div class="elements-detail">';
    elements.details.forEach(function (d) {
      var barW = elements.total > 0 ? (d.score / elements.total * 100) : 0;
      html += '<div class="el-row">';
      var detailElementKey = { '木': 'wood', '火': 'fire', '土': 'earth', '金': 'metal', '水': 'water' }[d.element];
      html += '<span class="el-name" style="color:' + ELEMENT_COLORS[d.element] + '">' + I18n.t(detailElementKey || d.element) + '</span>';
      html += '<div class="el-bar-bg"><div class="el-bar" style="width:' + barW + '%;background:' + ELEMENT_COLORS[d.element] + '"></div></div>';
      html += '<span class="el-score">' + d.score.toFixed(1) + '</span>';
      var detailStatusKey = { '旺': 'elementAbundant', '中': 'elementBalanced', '弱': 'elementWeak', '缺': 'elementMissing' }[d.status];
      html += '<span class="el-status el-status-' + d.status + '">' + I18n.t(detailStatusKey || d.status) + '</span>';
      html += '</div>';
    });
    if (elements.missing.length > 0) {
      var missingNames = elements.missing.map(function (i) { return ['木', '火', '土', '金', '水'][i]; });
      var localizedMissing = missingNames.map(function (name) {
        var key = { '木': 'wood', '火': 'fire', '土': 'earth', '金': 'metal', '水': 'water' }[name];
        return I18n.t(key || name);
      });
      html += '<div class="el-missing">' + I18n.t('missingLabel') + ': ' + localizedMissing.join(', ') + '</div>';
    }
    html += '</div></div>';

    // 9. 地支关系
    var rels = relResult.relationships;
    if (rels.length > 0) {
      html += '<div class="relationships-section"><h3>' + I18n.t('relationships') + '</h3><ul>';
      rels.forEach(function (r) {
        html += '<li><strong>' + localizedRelationshipKind(r.kind) + ':</strong> ' + localizedRelationshipDescription(r) + '</li>';
      });
      html += '</ul></div>';
    }

    // 10. 大运
    var lps = luck.pillars;
    html += '<div class="luck-pillars-section"><h3>' + I18n.t('luckPillars') + '</h3>';
    var luckDirectionKey = { '顺行': 'forward', '逆行': 'backward' }[luck.direction];
    html += '<div class="luck-direction">' + I18n.t('startAge') + ': ' + luck.startAge + I18n.t('age') + ' (' + I18n.t(luckDirectionKey || luck.direction) + ')</div>';
    html += '<div class="luck-pillars-scroll"><div class="luck-pillars-track">';
    lps.forEach(function (lp) {
      html += '<div class="luck-pillar-card">';
      html += '<div class="lp-age">' + lp.startAge + '-' + lp.endAge + I18n.t('age') + '</div>';
      html += '<div class="lp-year">' + lp.startYear + '-' + lp.endYear + '</div>';
      html += '<div class="lp-stem" style="color:' + stemColor(lp.stemIndex) + '">' + localizedStem(lp.stemIndex) + '</div>';
      html += '<div class="lp-branch" style="color:' + branchColor(lp.branchIndex) + '">' + localizedBranch(lp.branchIndex) + '</div>';
      html += '<div class="lp-nayin">' + localizedNayin(lp.nayin) + '</div>';
      html += '</div>';
    });
    html += '</div></div></div>';

    // 11. 流年
    var thisYear = new Date().getFullYear();
    var flowYears = BaZi.computeFlowYears(chart, thisYear, 10);
    html += '<div class="flow-years-section"><h3>' + I18n.t('flowYears') + '</h3>';
    html += '<div class="flow-years-grid">';
    flowYears.forEach(function (fy) {
      html += '<div class="flow-year-cell">';
      html += '<div class="fy-year">' + fy.year + '</div>';
      html += '<div class="fy-gz" style="color:' + stemColor(fy.stemIndex) + '">' + localizedStem(fy.stemIndex) + localizedBranch(fy.branchIndex) + '</div>';
      html += '<div class="fy-tg">' + localizedTenGod(fy.tenGod) + '</div>';
      html += '<div class="fy-nayin">' + localizedNayin(fy.nayin) + '</div>';
      html += '</div>';
    });
    html += '</div></div>';

    resultArea.innerHTML = html;

    // Draw radar chart + enable drag scroll
    requestAnimationFrame(function () {
      var canvas = $('radar-canvas');
      if (canvas) drawRadarChart(canvas, elCounts);
      var luckScroll = document.querySelector('.luck-pillars-scroll');
      if (luckScroll) enableDragScroll(luckScroll);
    });
  }

  // -----------------------------------------------------------------------
  //  Liu Yao Tab Rendering
  // -----------------------------------------------------------------------

  function updateLiuyaoInputs() {
    var method = $('liuyao-method') ? $('liuyao-method').value : 'time';
    var timeInputs = $('liuyao-time-inputs');
    var numInputs = $('liuyao-number-inputs');
    if (timeInputs) timeInputs.style.display = method === 'time' ? 'block' : 'none';
    if (numInputs) numInputs.style.display = method === 'number' ? 'block' : 'none';
  }

  function resetSelectToDefault(id) {
    var select = $(id);
    if (!select) return;
    var defaultIndex = 0;
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].defaultSelected) {
        defaultIndex = i;
        break;
      }
    }
    select.selectedIndex = defaultIndex;
  }

  function resetInputToDefault(id) {
    var input = $(id);
    if (input) input.value = input.defaultValue;
  }

  function clearLiuyaoResult(messageKey, isAlert) {
    lastLiuYaoResult = null;
    pendingSharedLiuYaoLines = null;
    liuYaoStatusMessageKey = messageKey || 'noData';
    liuYaoStatusIsAlert = Boolean(isAlert);
    var area = $('liuyao-result');
    if (!area) return;
    area.innerHTML = '<p class="empty-state"' + (isAlert ? ' role="alert"' : '') + '>' +
      I18n.t(messageKey || 'noData') + '</p>';
  }

  function handleLiuyaoMethodChange() {
    updateLiuyaoInputs();
    clearLiuyaoResult();
  }

  function clearSharedChartHash() {
    if (!window.location.hash) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function resetActiveTab(dateStr) {
    clearSharedChartHash();
    if (activeTab === 'liuyao') {
      resetSelectToDefault('liuyao-method');
      ['liuyao-num1', 'liuyao-num2', 'liuyao-num3'].forEach(resetInputToDefault);
      updateLiuyaoInputs();
      clearLiuyaoResult();
      return;
    }

    if (activeTab === 'ziwei') {
      ['ziwei-year', 'ziwei-day'].forEach(resetInputToDefault);
      resetSelectToDefault('ziwei-month');
      resetSelectToDefault('ziwei-hour');
      var ziweiMale = document.querySelector('input[name="ziwei-gender"][value="male"]');
      if (ziweiMale) ziweiMale.checked = true;
      calculateZiwei();
      return;
    }

    if ($('bazi-date')) $('bazi-date').value = dateStr;
    if ($('bazi-hour')) $('bazi-hour').value = '0';
    var baziMale = document.querySelector('input[name="bazi-gender"][value="male"]');
    if (baziMale) baziMale.checked = true;
    calculateBazi();
  }

  function castLiuyao() {
    var method = $('liuyao-method') ? $('liuyao-method').value : 'time';
    var result;

    if (method === 'time') {
      result = liuYaoCastByTime(new Date());
    } else if (method === 'number') {
      var n1Raw = $('liuyao-num1').value.trim();
      var n2Raw = $('liuyao-num2').value.trim();
      var n3Val = $('liuyao-num3').value;
      var n1 = Number(n1Raw);
      var n2 = Number(n2Raw);
      var n3 = n3Val !== '' ? Number(n3Val) : null;
      var validNumbers = n1Raw !== '' && n2Raw !== '' &&
        Number.isInteger(n1) && n1 >= 1 && n1 <= 999 &&
        Number.isInteger(n2) && n2 >= 1 && n2 <= 999 &&
        (n3 === null || (Number.isInteger(n3) && n3 >= 1 && n3 <= 999));
      if (!validNumbers) {
        clearLiuyaoResult('invalidNumbers', true);
        return;
      }
      result = liuYaoCastByNumber(n1, n2, n3);
    } else {
      result = liuYaoCastByCoin();
    }

    renderLiuyaoResult(result);
  }

  function renderLiuyaoResult(result) {
    var area = $('liuyao-result');
    if (!area) return;

    lastLiuYaoResult = result;
    liuYaoStatusMessageKey = null;
    liuYaoStatusIsAlert = false;

    var html = '';

    // Hexagram info header
    var ph = result.primaryHex;
    html += '<div class="hex-header">';
    html += '<div class="hex-primary"><h3>' + I18n.t('primaryHex') + '</h3>';
    html += '<div class="hex-symbol">' + ph[2] + '</div>';
    html += '<div class="hex-name">' + localizedHexagramName(ph) + ' (' + I18n.t('hexagram') + ' ' + ph[0] + ')</div>';
    html += '<div class="hex-desc">' + localizedHexagramDescription(ph) + '</div></div>';

    if (result.changedHex) {
      var ch = result.changedHex;
      html += '<div class="hex-arrow">&rarr;</div>';
      html += '<div class="hex-changed"><h3>' + I18n.t('changedHex') + '</h3>';
      html += '<div class="hex-symbol">' + ch[2] + '</div>';
      html += '<div class="hex-name">' + localizedHexagramName(ch) + ' (' + I18n.t('hexagram') + ' ' + ch[0] + ')</div>';
      html += '<div class="hex-desc">' + localizedHexagramDescription(ch) + '</div></div>';
    }
    html += '</div>';

    // SVG hexagram visualization
    html += '<div class="hex-visual">';
    html += '<div class="hex-svg-wrap">';
    html += '<h4>' + I18n.t('primaryHex') + '</h4>';
    html += buildHexagramSVG(result.primaryLines, result.movingPositions);
    html += '</div>';
    if (result.changedHex) {
      html += '<div class="hex-svg-wrap">';
      html += '<h4>' + I18n.t('changedHex') + '</h4>';
      html += buildHexagramSVG(result.changedLines, []);
      html += '</div>';
    }
    html += '</div>';

    // Moving lines summary
    html += '<div class="hex-moving">';
    html += '<strong>' + I18n.t('movingLines') + ':</strong> ';
    if (result.movingPositions.length > 0) {
      html += result.movingPositions.map(function (p) { return linePositionLabel(p - 1, false); }).join(', ');
    } else {
      html += I18n.t('noMovingLines');
    }
    html += '</div>';

    // Lines detail table
    html += '<div class="hex-lines-table"><table><thead><tr>';
    html += '<th>' + I18n.t('linePosition') + '</th>';
    html += '<th>' + I18n.t('lineYang') + '/' + I18n.t('lineYin') + '</th>';
    html += '<th>' + I18n.t('movingMark') + '</th>';
    html += '</tr></thead><tbody>';
    for (var i = 5; i >= 0; i--) {
      var isYang = result.primaryLines[i] === 1;
      var isMoving = result.movingPositions.indexOf(i + 1) !== -1;
      html += '<tr' + (isMoving ? ' class="moving-row"' : '') + '>';
      html += '<td>' + linePositionLabel(i, false) + '</td>';
      html += '<td>' + (isYang ? I18n.t('lineYang') : I18n.t('lineYin')) + '</td>';
      html += '<td>' + (isMoving ? I18n.t('movingMark') : '') + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';

    area.innerHTML = html;
  }

  // -----------------------------------------------------------------------
  //  Zi Wei Tab Rendering
  // -----------------------------------------------------------------------

  function calculateZiwei() {
    var yVal = $('ziwei-year') ? parseInt($('ziwei-year').value, 10) : 0;
    var mVal = $('ziwei-month') ? parseInt($('ziwei-month').value, 10) : 0;
    var dVal = $('ziwei-day') ? parseInt($('ziwei-day').value, 10) : 0;
    var hVal = $('ziwei-hour') ? parseInt($('ziwei-hour').value, 10) : 12;
    var genderEl = document.querySelector('input[name="ziwei-gender"]:checked');
    var gender = genderEl ? genderEl.value : 'male';

    var area = $('ziwei-result');
    if (!area) return;

    if (!yVal || !mVal || !dVal) {
      area.innerHTML = '<p class="empty-state">' + I18n.t('noData') + '</p>';
      return;
    }

    var validLunarDate = false;
    if (yVal >= 1900 && yVal <= 2100 && mVal >= 1 && mVal <= 12 &&
        dVal >= 1 && dVal <= 30 && hVal >= 0 && hVal <= 11) {
      try {
        // The input is a regular (non-leap) lunar month. Round-trip through
        // the bundled calendar so a 30th day in a 29-day month cannot roll
        // silently into the following month and produce a plausible chart.
        var solarDate = Calendar.lunarToSolar(yVal, mVal, dVal, false);
        var lunarRoundTrip = Calendar.solarToLunar(
          solarDate.year, solarDate.month, solarDate.day
        );
        validLunarDate = lunarRoundTrip.year === yVal &&
          lunarRoundTrip.month === mVal &&
          lunarRoundTrip.day === dVal &&
          lunarRoundTrip.isLeap === false;
      } catch (e) {
        validLunarDate = false;
      }
    }

    if (!validLunarDate) {
      area.innerHTML = '<p class="empty-state" role="alert">' + I18n.t('invalidDate') + '</p>';
      return;
    }

    var chart = ziWeiCalc(yVal, mVal, dVal, hVal, gender);

    // Build the 4x4 grid (traditional layout)
    // Layout: rows and cols mapped to branch positions
    //   [巳4] [午5] [未6] [申7]
    //   [辰3]               [酉8]
    //   [卯2]               [戌9]
    //   [寅1] [丑0] [子11] [亥10]
    // Wait -- branches: 子0 丑1 寅2 卯3 辰4 巳5 午6 未7 申8 酉9 戌10 亥11
    // Traditional grid positions (branch index -> row, col):
    var gridMap = {
      5:  [0,0], 6:  [0,1], 7:  [0,2], 8:  [0,3],
      4:  [1,0],                         9:  [1,3],
      3:  [2,0],                         10: [2,3],
      2:  [3,0], 1:  [3,1], 0:  [3,2], 11: [3,3],
    };

    // Build a lookup: position -> palace
    var posToPalace = {};
    chart.palaces.forEach(function (p) { posToPalace[p.position] = p; });

    // Palace name i18n keys
    var palaceI18nKeys = [
      'palaceLife','palaceSiblings','palaceSpouse','palaceChildren',
      'palaceWealth','palaceHealth','palaceTravel','palaceServants',
      'palaceCareer','palaceProperty','palaceFortune','palaceParents'
    ];
    var palaceDescKeys = [
      'palaceLifeDesc','palaceSiblingsDesc','palaceSpouseDesc','palaceChildrenDesc',
      'palaceWealthDesc','palaceHealthDesc','palaceTravelDesc','palaceServantsDesc',
      'palaceCareerDesc','palacePropertyDesc','palaceFortuneDesc','palaceParentsDesc'
    ];
    var branchI18nKeys = [
      'branchZi','branchChou','branchYin','branchMao','branchChen','branchSi',
      'branchWu2','branchWei','branchShen','branchYou','branchXu','branchHai'
    ];
    var starI18nKeys = {
      '紫微':'starZiwei', '天机':'starTianji', '太阳':'starTaiyang',
      '武曲':'starWuqu', '天同':'starTiantong', '廉贞':'starLianzhen',
      '天府':'starTianfu', '太阴':'starTaiyin', '贪狼':'starTanlang',
      '巨门':'starJumen', '天相':'starTianxiang', '天梁':'starTianliang',
      '七杀':'starQisha2', '破军':'starPojun'
    };

    var html = '<div class="ziwei-grid">';

    for (var row = 0; row < 4; row++) {
      for (var col = 0; col < 4; col++) {
        // Find which branch maps here
        var branchIdx = -1;
        for (var bi in gridMap) {
          if (gridMap[bi][0] === row && gridMap[bi][1] === col) {
            branchIdx = parseInt(bi, 10);
            break;
          }
        }

        if (branchIdx === -1) {
          // Center cells (row 1-2, col 1-2) -- empty or chart info
          if (row === 1 && col === 1) {
            html += '<div class="ziwei-cell ziwei-center" style="grid-row:2/4;grid-column:2/4">';
            html += '<h2>' + I18n.t('tabZiwei') + '</h2>';
            html += '<p>' + I18n.t('lunarDate') + ': ' + yVal + '/' + mVal + '/' + dVal + '</p>';
            html += '</div>';
          }
          // Skip other center cells (already spanned)
          continue;
        }

        var palace = posToPalace[branchIdx];
        var palaceName = '';
        var palaceDesc = '';
        var starsHtml = '';

        if (palace) {
          var pIdx = ZW_PALACES.indexOf(palace.name);
          palaceName = pIdx >= 0 ? I18n.t(palaceI18nKeys[pIdx]) : palace.name;
          palaceDesc = pIdx >= 0 ? I18n.t(palaceDescKeys[pIdx]) : '';
          if (palace.stars.length > 0) {
            starsHtml = palace.stars.map(function (s) {
              var starKey = starI18nKeys[s];
              return '<span class="zw-star">' + (starKey ? I18n.t(starKey) : s) + '</span>';
            }).join(' ');
          } else {
            starsHtml = '<span class="zw-no-star">' + I18n.t('noMajorStar') + '</span>';
          }
        }

        html += '<div class="ziwei-cell" title="' + palaceDesc + '" style="grid-row:' + (row+1) + ';grid-column:' + (col+1) + '">';
        html += '<div class="zw-branch">' + I18n.t(branchI18nKeys[branchIdx]) + '</div>';
        html += '<div class="zw-palace-name">' + palaceName + '</div>';
        html += '<div class="zw-stars">' + starsHtml + '</div>';
        html += '</div>';
      }
    }
    html += '</div>';

    area.innerHTML = html;
  }

  // -----------------------------------------------------------------------
  //  Share Feature
  // -----------------------------------------------------------------------

  function generateShareUrl() {
    var params = { lang: I18n.getLang() };
    if (activeTab === 'bazi') {
      params.tab = 'bazi';
      params.date = $('bazi-date') ? $('bazi-date').value : '';
      params.hour = $('bazi-hour') ? $('bazi-hour').value : '12';
      var g = document.querySelector('input[name="bazi-gender"]:checked');
      params.gender = g ? g.value : 'male';
    } else if (activeTab === 'ziwei') {
      params.tab = 'ziwei';
      params.y = $('ziwei-year') ? $('ziwei-year').value : '';
      params.m = $('ziwei-month') ? $('ziwei-month').value : '';
      params.d = $('ziwei-day') ? $('ziwei-day').value : '';
      params.h = $('ziwei-hour') ? $('ziwei-hour').value : '12';
      var zg = document.querySelector('input[name="ziwei-gender"]:checked');
      params.gender = zg ? zg.value : 'male';
    } else if (activeTab === 'liuyao') {
      params.tab = 'liuyao';
      params.method = $('liuyao-method') ? $('liuyao-method').value : 'time';
      if (params.method === 'number') {
        params.n1 = $('liuyao-num1') ? $('liuyao-num1').value : '';
        params.n2 = $('liuyao-num2') ? $('liuyao-num2').value : '';
        params.n3 = $('liuyao-num3') ? $('liuyao-num3').value : '';
      }
      if (lastLiuYaoResult && lastLiuYaoResult.method === params.method &&
          Array.isArray(lastLiuYaoResult.rawLines)) {
        params.lines = lastLiuYaoResult.rawLines.join(',');
      }
    }
    var encoded = btoa(JSON.stringify(params));
    return window.location.origin + window.location.pathname + '#' + encoded;
  }

  function openShareModal() {
    var modal = $('share-modal');
    var input = $('share-url');
    if (!modal || !input) return;
    if (activeTab === 'liuyao') {
      var method = $('liuyao-method') ? $('liuyao-method').value : 'time';
      if (!lastLiuYaoResult || lastLiuYaoResult.method !== method) {
        showToast(I18n.t('noData'));
        return;
      }
    } else {
      var resultArea = $(activeTab + '-result');
      var unavailableState = resultArea && resultArea.querySelector('.empty-state');
      if (unavailableState) {
        showToast(unavailableState.textContent || I18n.t('noData'));
        return;
      }
    }
    input.value = generateShareUrl();
    modal.style.display = 'flex';
    var closeBtn = $('share-modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeShareModal() {
    var modal = $('share-modal');
    if (!modal) return;
    modal.style.display = 'none';
    var shareBtn = $('share-btn');
    if (shareBtn) shareBtn.focus();
  }

  function copyShareLink() {
    var input = $('share-url');
    var url = input && input.value ? input.value : generateShareUrl();
    function fallbackCopy() {
      var ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(I18n.t('copied'));
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        showToast(I18n.t('copied'));
      }).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  function showToast(msg) {
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('show'); });
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { document.body.removeChild(toast); }, 300);
    }, 1800);
  }

  function parseSharedInteger(value, min, max) {
    if ((typeof value !== 'string' && typeof value !== 'number') ||
        String(value).trim() === '' || !/^-?\d+$/.test(String(value))) return null;
    var parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
  }

  function isValidSharedSolarDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var parts = value.split('-').map(Number);
    var parsed = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return parts[0] >= 1900 && parts[0] <= 2100 &&
      parsed.getUTCFullYear() === parts[0] &&
      parsed.getUTCMonth() === parts[1] - 1 &&
      parsed.getUTCDate() === parts[2];
  }

  function isValidSharedGender(value) {
    return value === 'male' || value === 'female';
  }

  function isValidSharedLunarDate(year, month, day) {
    try {
      var solarDate = Calendar.lunarToSolar(year, month, day, false);
      var lunar = Calendar.solarToLunar(solarDate.year, solarDate.month, solarDate.day);
      return lunar.year === year && lunar.month === month && lunar.day === day &&
        lunar.isLeap === false;
    } catch (e) {
      return false;
    }
  }

  /** Parse URL hash and restore state if present. */
  function parseShareHash() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    try {
      var decoded = JSON.parse(atob(hash.substring(1)));
      if (!decoded || typeof decoded !== 'object' ||
          ['bazi', 'ziwei', 'liuyao'].indexOf(decoded.tab) === -1) {
        throw new Error('Invalid shared chart payload');
      }
      if (decoded.lang === 'zh' || decoded.lang === 'en') {
        I18n.setLang(decoded.lang);
        applyI18n();
        rebuildHourSelector();
        rebuildZiweiSelectors();
        var languageButton = $('lang-toggle');
        if (languageButton) languageButton.textContent = decoded.lang === 'zh' ? 'EN' : '中';
      }
      if (decoded.tab === 'bazi') {
        var sharedBaziHour = parseSharedInteger(decoded.hour, 0, 11);
        if (!isValidSharedSolarDate(decoded.date) || sharedBaziHour === null ||
            !isValidSharedGender(decoded.gender)) {
          throw new Error('Invalid shared BaZi inputs');
        }
        if ($('bazi-date')) $('bazi-date').value = decoded.date;
        if ($('bazi-hour')) $('bazi-hour').value = String(sharedBaziHour);
        var radio = document.querySelector('input[name="bazi-gender"][value="' + decoded.gender + '"]');
        if (radio) radio.checked = true;
        switchTab('bazi');
      } else if (decoded.tab === 'ziwei') {
        var sharedZiweiYear = parseSharedInteger(decoded.y, 1900, 2100);
        var sharedZiweiMonth = parseSharedInteger(decoded.m, 1, 12);
        var sharedZiweiDay = parseSharedInteger(decoded.d, 1, 30);
        var sharedZiweiHour = parseSharedInteger(decoded.h, 0, 11);
        if (sharedZiweiYear === null || sharedZiweiMonth === null ||
            sharedZiweiDay === null || sharedZiweiHour === null ||
            !isValidSharedGender(decoded.gender) ||
            !isValidSharedLunarDate(sharedZiweiYear, sharedZiweiMonth, sharedZiweiDay)) {
          throw new Error('Invalid shared Zi Wei inputs');
        }
        if ($('ziwei-year')) $('ziwei-year').value = String(sharedZiweiYear);
        if ($('ziwei-month')) $('ziwei-month').value = String(sharedZiweiMonth);
        if ($('ziwei-day')) $('ziwei-day').value = String(sharedZiweiDay);
        if ($('ziwei-hour')) $('ziwei-hour').value = String(sharedZiweiHour);
        var zwRadio = document.querySelector('input[name="ziwei-gender"][value="' + decoded.gender + '"]');
        if (zwRadio) zwRadio.checked = true;
        switchTab('ziwei');
      } else if (decoded.tab === 'liuyao') {
        if (['time', 'number', 'coin'].indexOf(decoded.method) < 0) {
          throw new Error('Invalid shared Liu Yao method');
        }
        var method = decoded.method;
        if (method === 'number') {
          var sharedN1 = parseSharedInteger(decoded.n1, 1, 999);
          var sharedN2 = parseSharedInteger(decoded.n2, 1, 999);
          var sharedN3 = decoded.n3 === '' || decoded.n3 === undefined
            ? null : parseSharedInteger(decoded.n3, 1, 999);
          if (sharedN1 === null || sharedN2 === null ||
              (decoded.n3 !== '' && decoded.n3 !== undefined && sharedN3 === null)) {
            throw new Error('Invalid shared Liu Yao numbers');
          }
          if ($('liuyao-num1')) $('liuyao-num1').value = String(sharedN1);
          if ($('liuyao-num2')) $('liuyao-num2').value = String(sharedN2);
          if ($('liuyao-num3')) $('liuyao-num3').value = sharedN3 === null ? '' : String(sharedN3);
        }
        if ($('liuyao-method')) $('liuyao-method').value = method;
        if (decoded.lines !== undefined) {
          if (typeof decoded.lines !== 'string') {
            throw new Error('Invalid shared Liu Yao lines');
          }
          var restoredLines = decoded.lines.split(',').map(function (value) { return Number(value); });
          var validLines = restoredLines.length === 6 && restoredLines.every(function (value) {
            return value === 6 || value === 7 || value === 8 || value === 9;
          });
          if (!validLines) throw new Error('Invalid shared Liu Yao lines');
          if (method === 'number') {
            var expectedNumberLines = liuYaoCastByNumber(
              sharedN1, sharedN2, sharedN3
            ).rawLines;
            var matchesSharedNumbers = restoredLines.every(function (value, index) {
              return value === expectedNumberLines[index];
            });
            if (!matchesSharedNumbers) {
              throw new Error('Shared Liu Yao lines do not match the supplied numbers');
            }
          }
          pendingSharedLiuYaoLines = restoredLines;
        }
        updateLiuyaoInputs();
        switchTab('liuyao');
      }
    } catch (e) {
      clearSharedChartHash();
      showToast(I18n.t('invalidShareLink'));
    }
  }

  // -----------------------------------------------------------------------
  //  Initialization
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  //  Background Particle Canvas (subtle bagua / taiji particles)
  // -----------------------------------------------------------------------

  function initBgCanvas() {
    var canvas = $('bg-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var particles = [];
    var PARTICLE_COUNT = 30;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.5,
        dx: (Math.random() - 0.5) * 0.15,
        dy: (Math.random() - 0.5) * 0.15,
        opacity: Math.random() * 0.3 + 0.05
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? 'rgba(212, 175, 55, ' + p.opacity + ')'
          : 'rgba(180, 140, 40, ' + (p.opacity * 0.5) + ')';
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    // Only animate if user allows
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw();
    }
  }

  // -----------------------------------------------------------------------
  //  Drag-to-scroll for luck pillars timeline
  // -----------------------------------------------------------------------

  function enableDragScroll(container) {
    if (!container) return;
    var isDown = false, startX, scrollLeft;
    container.addEventListener('mousedown', function (e) {
      isDown = true;
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
      container.style.cursor = 'grabbing';
    });
    container.addEventListener('mouseleave', function () { isDown = false; container.style.cursor = 'grab'; });
    container.addEventListener('mouseup', function () { isDown = false; container.style.cursor = 'grab'; });
    container.addEventListener('mousemove', function (e) {
      if (!isDown) return;
      e.preventDefault();
      var x = e.pageX - container.offsetLeft;
      container.scrollLeft = scrollLeft - (x - startX);
    });
  }

  // -----------------------------------------------------------------------
  //  Initialization
  // -----------------------------------------------------------------------

  function init() {
    // Detect initial theme from HTML attribute
    darkTheme = document.documentElement.getAttribute('data-theme') === 'dark';

    // Initialize background particles
    initBgCanvas();

    // Build hour selector
    rebuildHourSelector();
    rebuildZiweiSelectors();

    // Set default date to today
    var today = new Date();
    var dateStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    if ($('bazi-date')) $('bazi-date').value = dateStr;

    // Desktop tab buttons
    ['bazi','liuyao','ziwei'].forEach(function (t) {
      var btn = $('tab-' + t);
      if (btn) btn.addEventListener('click', function () { switchTab(t); });
    });

    // Mobile bottom nav buttons
    var bottomItems = document.querySelectorAll('.bottom-nav-item');
    for (var bi = 0; bi < bottomItems.length; bi++) {
      (function (item) {
        item.addEventListener('click', function () {
          var tab = item.getAttribute('data-tab');
          if (tab) switchTab(tab);
        });
      })(bottomItems[bi]);
    }

    // Hero CTA button — scroll to main content
    var heroCta = $('hero-cta-btn');
    if (heroCta) {
      heroCta.addEventListener('click', function () {
        var main = $('main-content');
        if (main) main.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Theme toggle
    var themeBtn = $('theme-toggle');
    if (themeBtn) {
      themeBtn.textContent = darkTheme ? '🌙' : '☀️';
      themeBtn.addEventListener('click', toggleTheme);
    }

    // Language toggle
    var langBtn = $('lang-toggle');
    if (langBtn) {
      langBtn.textContent = 'EN';
      langBtn.addEventListener('click', toggleLang);
    }

    // BaZi real-time calculation
    if ($('bazi-date')) $('bazi-date').addEventListener('change', calculateBazi);
    if ($('bazi-hour')) $('bazi-hour').addEventListener('change', calculateBazi);
    var genderRadios = document.querySelectorAll('input[name="bazi-gender"]');
    for (var i = 0; i < genderRadios.length; i++) {
      genderRadios[i].addEventListener('change', calculateBazi);
    }

    // Liu Yao
    if ($('liuyao-method')) {
      $('liuyao-method').addEventListener('change', handleLiuyaoMethodChange);
      updateLiuyaoInputs();
    }
    if ($('liuyao-cast-btn')) $('liuyao-cast-btn').addEventListener('click', castLiuyao);
    ['liuyao-num1', 'liuyao-num2', 'liuyao-num3'].forEach(function (id) {
      if ($(id)) {
        $(id).addEventListener('input', function () {
          var method = $('liuyao-method') ? $('liuyao-method').value : 'time';
          if (method === 'number' && lastLiuYaoResult) clearLiuyaoResult();
        });
      }
    });

    // Zi Wei real-time calculation
    ['ziwei-year','ziwei-month','ziwei-day','ziwei-hour'].forEach(function (id) {
      if ($(id)) $(id).addEventListener('change', calculateZiwei);
    });
    var zwGenders = document.querySelectorAll('input[name="ziwei-gender"]');
    for (var g = 0; g < zwGenders.length; g++) {
      zwGenders[g].addEventListener('change', calculateZiwei);
    }

    // Share modal and copy link — all handlers live here to satisfy strict CSP.
    if ($('print-btn')) $('print-btn').addEventListener('click', function () {
      window.print();
    });
    if ($('share-btn')) $('share-btn').addEventListener('click', openShareModal);
    if ($('copy-url-btn')) $('copy-url-btn').addEventListener('click', copyShareLink);
    if ($('share-modal-close')) $('share-modal-close').addEventListener('click', closeShareModal);
    var shareModal = $('share-modal');
    if (shareModal) {
      shareModal.addEventListener('click', function (event) {
        if (event.target === shareModal) closeShareModal();
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && shareModal && shareModal.style.display !== 'none') {
        closeShareModal();
      }
    });

    // Reset button
    if ($('reset-btn')) {
      $('reset-btn').addEventListener('click', function () {
        resetActiveTab(dateStr);
      });
    }

    // Apply translations
    applyI18n();

    // Parse URL hash for shared charts
    parseShareHash();

    // Initial tab
    switchTab(activeTab);
    // Recalculate deterministic shared Liu Yao only after all initialization
    // has completed; earlier rendering is overwritten by the final tab setup.
    if (activeTab === 'liuyao' && pendingSharedLiuYaoLines) {
      renderLiuyaoResult(_buildCoinResult(
        pendingSharedLiuYaoLines,
        $('liuyao-method') ? $('liuyao-method').value : 'coin'
      ));
      pendingSharedLiuYaoLines = null;
    } else if (activeTab === 'liuyao' && $('liuyao-method') &&
        $('liuyao-method').value === 'number' &&
        $('liuyao-num1').value && $('liuyao-num2').value) {
      castLiuyao();
    }

    // Enable drag scroll on any existing luck pillar containers
    var luckScroll = document.querySelector('.luck-pillars-scroll');
    if (luckScroll) enableDragScroll(luckScroll);
  }

  // -----------------------------------------------------------------------
  //  DOM Ready
  // -----------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', init);

  // Public API (for debugging / extension)
  return {
    switchTab: switchTab,
    calculateBazi: calculateBazi,
    castLiuyao: castLiuyao,
    calculateZiwei: calculateZiwei,
    toggleTheme: toggleTheme,
    toggleLang: toggleLang,
    drawRadarChart: drawRadarChart,
    buildHexagramSVG: buildHexagramSVG,
    openShareModal: openShareModal,
    closeShareModal: closeShareModal,
    copyShareLink: copyShareLink,
    enableDragScroll: enableDragScroll,
  };
})();


