(function (global) {
  'use strict';

  const STORAGE_KEY = 'zero-one.b01.lunar-cases.v1';
  const REQUIRED = [
    ['itemName', '物品名称'],
    ['lastSeenAt', '最后见到的日期时间'],
    ['lastSeenPlace', '最后见到的具体位置'],
    ['searchedPlaces', '已经查找过的位置']
  ];

  function text(value) {
    return String(value || '').trim();
  }

  function missingFields(input) {
    return REQUIRED.filter(([key]) => !text(input[key])).map(([, label]) => label);
  }

  function parseLocalDateTime(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text(value));
    if (!match) throw new Error('请输入有效的最后见到日期时间');
    const parts = match.slice(1).map(Number);
    const [year, month, day, hour, minute] = parts;
    const probe = new Date(year, month - 1, day, hour, minute, 0);
    if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day ||
        probe.getHours() !== hour || probe.getMinutes() !== minute) {
      throw new Error('最后见到日期时间不存在');
    }
    return { year, month, day, hour, minute };
  }

  function safe(label, fn) {
    try { return fn(); } catch (error) { return `${label}不可用：${error.message}`; }
  }

  function calculate(input, Solar) {
    if (!Solar || typeof Solar.fromYmdHms !== 'function') throw new Error('完整历法引擎未加载');
    const missing = missingFields(input);
    if (missing.length) {
      return {
        status: 'NEEDS_INPUT',
        followUp: missing.map(label => `请补充：${label}`),
        boundary: '缺少事实输入时不执行历法计算，也不推测失物位置。'
      };
    }

    const at = parseLocalDateTime(input.lastSeenAt);
    const solar = Solar.fromYmdHms(at.year, at.month, at.day, at.hour, at.minute, 0);
    const lunar = solar.getLunar();
    const idSeed = [input.itemName, input.lastSeenAt, input.lastSeenPlace].map(text).join('|');
    let hash = 2166136261;
    for (let index = 0; index < idSeed.length; index += 1) {
      hash ^= idSeed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return {
      schema: 'zero-one.b01.lost-item.v1',
      status: 'CALCULATED',
      caseId: `LOST-${at.year}${String(at.month).padStart(2, '0')}${String(at.day).padStart(2, '0')}-${(hash >>> 0).toString(16).padStart(8, '0')}`,
      input: {
        itemName: text(input.itemName),
        lastSeenAt: text(input.lastSeenAt),
        lastSeenPlace: text(input.lastSeenPlace),
        searchedPlaces: text(input.searchedPlaces),
        context: text(input.context)
      },
      calculation: {
        solar: solar.toFullString(),
        lunar: lunar.toFullString(),
        yearGanZhi: lunar.getYearInGanZhi(),
        monthGanZhi: lunar.getMonthInGanZhi(),
        dayGanZhi: lunar.getDayInGanZhi(),
        timeGanZhi: lunar.getTimeInGanZhi(),
        eightChar: safe('八字', () => lunar.getEightChar().toString()),
        jieQi: safe('节气', () => lunar.getJieQi()),
        dayYi: safe('宜', () => lunar.getDayYi()),
        dayJi: safe('忌', () => lunar.getDayJi()),
        dayChongSha: safe('冲煞', () => `${lunar.getDayChongDesc()}；${lunar.getDaySha()}`),
        joyDirection: safe('喜神方位', () => lunar.getDayPositionXiDesc()),
        wealthDirection: safe('财神方位', () => lunar.getDayPositionCaiDesc())
      },
      method: {
        engine: '6tail/lunar-javascript',
        license: 'MIT',
        source: 'https://github.com/6tail/lunar-javascript',
        calls: [
          'Solar.fromYmdHms(year, month, day, hour, minute, 0)',
          'solar.getLunar()',
          'lunar.getYearInGanZhi()/getMonthInGanZhi()/getDayInGanZhi()/getTimeInGanZhi()',
          'lunar.getEightChar()/getDayYi()/getDayJi()/getDayPositionXiDesc()/getDayPositionCaiDesc()'
        ],
        reproducibleInput: `${input.lastSeenAt}:00`
      },
      followUp: [
        '最后一次确认物品存在，是目视、使用记录，还是他人转述？',
        '离开最后见到位置后，依次经过了哪些地点？',
        '是否检查了夹层、衣袋、交通工具、失物招领和同行者？'
      ],
      searchPlan: [
        `从“${text(input.lastSeenPlace)}”按离开路线逆序复查，并由另一人复核。`,
        `排除已查位置中的盲区：${text(input.searchedPlaces)}。`,
        '对证件、钥匙、药品或贵重物品，立即采用挂失、报警、联系场所等现实措施。'
      ],
      boundary: '历法输出是可复算的传统文化规则展示，不是失物位置预测；查找结论必须由现实证据确认。',
      createdAt: new Date().toISOString()
    };
  }

  function readCases(storage) {
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(item => item && item.schema === 'zero-one.b01.lost-item.v1') : [];
    } catch (_) { return []; }
  }

  function saveCase(storage, item) {
    if (!item || item.status !== 'CALCULATED') throw new Error('只有完成计算的案例才能保存');
    const cases = readCases(storage).filter(existing => existing.caseId !== item.caseId);
    cases.unshift(item);
    storage.setItem(STORAGE_KEY, JSON.stringify(cases.slice(0, 30)));
    return cases.slice(0, 30);
  }

  global.B01LunarCase = { STORAGE_KEY, missingFields, parseLocalDateTime, calculate, readCases, saveCase };
})(typeof window === 'undefined' ? globalThis : window);
