// Reading and narration settings. Rendered into the settings panel and written
// straight to localStorage, so preferences survive reloads and other tabs.
import { el } from './ui.js';

const THEMES = [
  { id: 'paper', label: '纸白' },
  { id: 'sepia', label: '米黄' },
  { id: 'night', label: '夜间' },
];

export class SettingsPanel {
  constructor({ container, settings, onChange, onMusic, onMusicClear, music, voices, onManageVoices }) {
    this.container = container;
    this.settings = settings;
    this.onChange = onChange;
    this.onMusic = onMusic;
    this.onMusicClear = onMusicClear;
    this.music = music;
    this.voices = voices || (() => []);
    this.onManageVoices = onManageVoices;
  }

  render() {
    if (!this.container) return;
    const s = this.settings;
    this.container.replaceChildren();

    const speed = el('div', { class: 'setting-row' });
    const speedLabel = el('label', { text: `朗读语速 ${Number(s.speed || 1).toFixed(1)}×` });
    const speedInput = el('input', { type: 'range', min: '0.6', max: '1.6', step: '0.1', value: String(s.speed || 1) });
    speedInput.addEventListener('input', () => {
      speedLabel.textContent = `朗读语速 ${Number(speedInput.value).toFixed(1)}×`;
    });
    speedInput.addEventListener('change', () => this.onChange({ speed: Number(speedInput.value) }));
    speed.append(speedLabel, speedInput);

    const voice = el('div', { class: 'setting-row' });
    voice.append(el('label', { text: '朗读声音' }));
    const select = el('select');
    select.append(new Option('系统语音（本机）', 'system'));
    for (const item of this.voices()) {
      if (item.status && item.status !== 'active') continue;
      select.append(new Option(`家庭声音 · ${item.name}`, item.id));
    }
    select.value = s.voice || 'system';
    select.onchange = () => this.onChange({ voice: select.value });
    voice.append(select);
    const manage = el('button', { type: 'button', class: 'ghost', text: '管理家庭声音与授权 →' });
    manage.onclick = () => this.onManageVoices?.();
    voice.append(manage);

    const layout = el('div', { class: 'setting-row' });
    layout.append(el('label', { text: '阅读方式' }));
    layout.append(this.segmented([{ id: 'scrolled', label: '连续' }, { id: 'paged', label: '分页' }], s.layout || 'scrolled', value => this.onChange({ layout: value })));

    const font = el('div', { class: 'setting-row' });
    const fontLabel = el('label', { text: `正文字号 ${Math.round((s.fontScale || 1) * 100)}%` });
    const fontInput = el('input', { type: 'range', min: '0.85', max: '1.5', step: '0.05', value: String(s.fontScale || 1) });
    fontInput.addEventListener('input', () => { fontLabel.textContent = `正文字号 ${Math.round(fontInput.value * 100)}%`; });
    fontInput.addEventListener('change', () => this.onChange({ fontScale: Number(fontInput.value) }));
    font.append(fontLabel, fontInput);

    const theme = el('div', { class: 'setting-row' });
    theme.append(el('label', { text: '配色' }));
    theme.append(this.segmented(THEMES.map(t => ({ id: t.id, label: t.label })), s.theme || 'paper', value => this.onChange({ theme: value })));

    const musicRow = el('div', { class: 'setting-row' });
    musicRow.append(el('label', { text: '背景音乐' }));
    const name = this.music?.name || '尚未选择';
    musicRow.append(el('p', { class: 'muted', text: `当前：${name}（只保存在本机，不随笔记同步）` }));
    const musicActions = el('div', { class: 'choice' });
    const choose = el('button', { type: 'button', text: this.music?.ready ? '更换音乐' : '选择音乐文件' });
    choose.onclick = () => this.onMusic?.();
    musicActions.append(choose);
    if (this.music?.ready) {
      const clear = el('button', { type: 'button', class: 'ghost', text: '移除音乐' });
      clear.onclick = () => this.onMusicClear?.();
      musicActions.append(clear);
    }
    musicRow.append(musicActions);

    const level = el('div', { class: 'setting-row' });
    const levelLabel = el('label', { text: `音乐音量 ${Math.round((s.musicLevel ?? 0.18) * 100)}%` });
    const levelInput = el('input', { type: 'range', min: '0', max: '0.6', step: '0.02', value: String(s.musicLevel ?? 0.18) });
    levelInput.addEventListener('input', () => { levelLabel.textContent = `音乐音量 ${Math.round(levelInput.value * 100)}%`; });
    levelInput.addEventListener('change', () => this.onChange({ musicLevel: Number(levelInput.value) }));
    level.append(levelLabel, levelInput);

    const duck = el('label', { class: 'check setting-row' });
    const duckBox = el('input', { type: 'checkbox', checked: s.ducking !== false });
    duckBox.onchange = () => this.onChange({ ducking: duckBox.checked });
    duck.append(duckBox, el('span', { text: '朗读时自动降低音乐音量' }));

    this.container.append(speed, voice, layout, font, theme, musicRow, level, duck);
    this.container.append(el('p', { class: 'muted', text: '快捷键：空格 朗读/暂停 · ← → 上一段/下一段 · T 目录 · N 笔记 · B 书签 · 1–6 调速' }));
  }

  segmented(options, active, onPick) {
    const group = el('div', { class: 'segmented', role: 'group' });
    for (const option of options) {
      const button = el('button', { type: 'button', text: option.label });
      button.setAttribute('aria-pressed', String(option.id === active));
      button.onclick = () => onPick(option.id);
      group.append(button);
    }
    return group;
  }
}
