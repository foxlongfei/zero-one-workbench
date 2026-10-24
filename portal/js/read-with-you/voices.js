// Family voices: recording a voice is only allowed with the speaker's explicit,
// recorded consent. This panel collects that consent, shows what was agreed,
// and gives the speaker one-tap revocation and sample deletion.
import { el } from './ui.js';
import { formatStamp } from './layout-helpers.js';

const PURPOSES = [
  { id: 'read-aloud', label: '朗读家庭书架里的书' },
  { id: 'children-stories', label: '给孩子讲故事' },
  { id: 'reminders', label: '家庭提醒与问候' },
];

export class VoicesController {
  constructor({ container, api, server, onPrefer, notify }) {
    this.container = container;
    this.api = api;
    this.server = server;
    this.onPrefer = onPrefer;
    this.notify = notify || (() => {});
    this.voices = [];
    this.preferred = 'system';
    this.loaded = false;
    this.error = '';
  }

  async load() {
    this.render();
    if (!this.server?.online) { this.error = 'offline'; this.render(); return; }
    try {
      const bundle = await this.api.voices();
      this.voices = bundle.voices || [];
      this.preferred = bundle.preferredVoice || 'system';
      this.error = '';
    } catch (err) {
      this.error = err.message;
    }
    this.loaded = true;
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.replaceChildren();
    this.container.append(el('div', {
      class: 'notice',
      text: '这里只保存"授权记录"，不会自动录音。没有本人勾选并签名，任何人都无法用这个声音朗读。',
    }));
    if (this.error === 'offline') {
      this.container.append(el('div', { class: 'notice warn', text: '家庭服务器没有启动，暂时无法管理家庭声音。' }));
    } else if (this.error) {
      this.container.append(el('div', { class: 'notice warn', text: `读取失败：${this.error}` }));
    }

    this.container.append(el('h4', { text: '已登记的声音' }));
    if (!this.voices.length) this.container.append(el('p', { class: 'empty-note', text: '还没有登记任何家庭声音。' }));
    for (const voice of this.voices) this.container.append(this.voiceCard(voice));
    this.container.append(this.consentForm());
  }

  voiceCard(voice) {
    // Sample deletion is its own fact, independent of consent status: revoking
    // consent must not hide the fact that the samples are gone (or still here).
    const samplesGone = Boolean(voice.samplesDeletedAt || voice.deletedAt);
    const card = el('article', {
      class: 'voice-card',
      dataset: { status: voice.status || 'active', voiceId: voice.id, samples: samplesGone ? 'deleted' : 'stored' },
    });
    const head = el('div', { class: 'voice-head' });
    head.append(el('strong', { text: voice.voiceName || voice.displayName || '家庭声音' }));
    head.append(el('span', { class: 'muted', text: statusLabel(voice.status) }));
    card.append(head);

    const consent = voice.consent || {};
    const scope = (consent.purposes || []).map(id => PURPOSES.find(p => p.id === id)?.label || id).join('、') || '未填写用途';
    card.append(el('p', { class: 'muted', text: `授权人：声音本人 · 用途：${scope}` }));
    if (voice.displayName) card.append(el('p', { class: 'muted', text: voice.displayName }));
    card.append(el('p', { class: 'muted', text: `登记时间：${formatStamp(voice.createdAt) || '——'}${voice.expiresAt ? ` · 授权到 ${formatStamp(voice.expiresAt)}` : ''}` }));

    const chosen = this.preferred === voice.id;
    const actions = el('div', { class: 'voice-actions' });
    if (voice.status === 'active') {
      const use = el('button', { type: 'button', text: chosen ? '当前默认声音' : '设为默认' });
      use.disabled = chosen;
      use.onclick = async () => { await this.onPrefer?.(voice.id); await this.load(); };
      actions.append(use);
    }
    if (voice.sample) {
      const play = el('button', { type: 'button', text: '试听样本' });
      play.onclick = () => this.notify('样本试听需要先由家庭服务器生成，本次版本未包含录音上传。', { tone: 'info' });
      actions.append(play);
    }
    if (voice.status === 'active') {
      const revoke = el('button', { type: 'button', class: 'ghost', text: '撤回授权' });
      revoke.onclick = async () => {
        await this.api?.revokeVoice?.(voice.id).catch(err => this.notify(`撤回失败：${err.message}`, { tone: 'error' }));
        this.notify(`已撤回「${voice.voiceName || voice.displayName}」的授权，相关合成音频已清理`);
        await this.load();
      };
      actions.append(revoke);
    }
    const purge = el('button', { type: 'button', class: 'ghost', text: samplesGone ? '样本已删除' : '删除样本' });
    purge.disabled = samplesGone || voice.status === 'deleted';
    purge.onclick = async () => {
      await this.api?.deleteVoiceSamples?.(voice.id).catch(err => this.notify(`删除失败：${err.message}`, { tone: 'error' }));
      this.notify('样本与缓存音频已删除');
      await this.load();
    };
    actions.append(purge);
    card.append(actions);
    return card;
  }

  consentForm() {
    const form = el('form', { class: 'consent-form' });
    form.append(el('h4', { text: '登记一个声音' }));
    form.append(el('p', { class: 'muted', text: '必须由声音本人完成。请如实填写，事后可随时撤回。' }));

    const nameLabel = el('label', { class: 'setting-row' });
    nameLabel.append(el('span', { text: '声音名称' }));
    const name = el('input', { type: 'text', placeholder: '例如：外婆的声音', required: true, name: 'voiceName' });
    nameLabel.append(name);

    const owner = el('label', { class: 'setting-row' });
    owner.append(el('span', { text: '授权人（声音本人的姓名或称呼）' }));
    const ownerInput = el('input', { type: 'text', placeholder: '必须与声音本人一致', required: true, name: 'authorizedBy' });
    owner.append(ownerInput);

    const purposes = el('fieldset');
    purposes.append(el('legend', { text: '允许的用途（至少一项）' }));
    const boxes = PURPOSES.map(purpose => {
      const label = el('label', { class: 'check' });
      const box = el('input', { type: 'checkbox', name: 'purpose', value: purpose.id });
      label.append(box, el('span', { text: purpose.label }));
      purposes.append(label);
      return box;
    });

    const statement = el('fieldset');
    statement.append(el('legend', { text: '本人声明' }));
    const statementText = el('label', { class: 'check' });
    const statementBox = el('input', { type: 'checkbox', name: 'statement' });
    statementText.append(statementBox, el('span', { text: '我是这个声音的本人，自愿授权按上述用途合成朗读，并知道我可以随时撤回授权、删除样本。' }));
    statement.append(statementText);

    const expiry = el('label', { class: 'setting-row' });
    expiry.append(el('span', { text: '授权有效期（可选）' }));
    const expiryInput = el('input', { type: 'date', name: 'expiresAt' });
    expiry.append(expiryInput);

    const submit = el('button', { type: 'submit', class: 'primary', text: '登记并授权' });
    const status = el('p', { class: 'muted', role: 'status' });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const picked = boxes.filter(box => box.checked).map(box => box.value);
      if (!name.value.trim() || !ownerInput.value.trim()) { status.textContent = '请填写声音名称与授权人。'; return; }
      if (!picked.length) { status.textContent = '请至少选择一项用途。'; return; }
      if (!statementBox.checked) { status.textContent = '需要声音本人勾选声明后才能登记。'; return; }
      if (!this.server?.online) { status.textContent = '家庭服务器未启动，无法登记。'; return; }
      submit.disabled = true;
      try {
        const expiryStamp = expiryInput.value ? Date.parse(`${expiryInput.value}T23:59:59`) : null;
        await this.api.addVoice({
          voiceName: name.value.trim(),
          displayName: `由 ${ownerInput.value.trim()} 授权的声音`,
          consent: {
            // The server only accepts the literal 'voice-owner' marker: whoever
            // signs the consent must be the voice owner themselves.
            authorizedBy: 'voice-owner',
            purposes: picked,
            statement: `${ownerInput.value.trim()}：本人自愿授权按上述用途合成朗读，可随时撤回授权并删除样本。`,
            recordedAt: Date.now(),
            expiresAt: Number.isFinite(expiryStamp) ? expiryStamp : null,
          },
        });
        status.textContent = '';
        this.notify(`「${name.value.trim()}」已登记，可用于朗读`);
        await this.load();
      } catch (err) {
        status.textContent = `登记失败：${err.message}`;
      } finally {
        submit.disabled = false;
      }
    });

    form.append(nameLabel, owner, purposes, statement, expiry, submit, status);
    return form;
  }
}

function statusLabel(status) {
  return ({ active: '有效授权', revoked: '已撤回授权', deleted: '已删除样本', expired: '授权已过期' })[status] || status;
}
