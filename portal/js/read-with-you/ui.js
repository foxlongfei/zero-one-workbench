// Small DOM helpers shared by the reader modules.
const HIDDEN_KEY = 'hidden';

export function toast(message, { tone = 'info', ms = 3200 } = {}) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = String(message ?? '');
  node.dataset.tone = tone;
  node.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('is-visible'), ms);
}

export function closePanels() {
  document.querySelectorAll('.panel').forEach(panel => { panel[HIDDEN_KEY] = true; });
  document.body.classList.remove('panels-open');
}

export function openPanel(name) {
  closePanels();
  const panel = document.getElementById(`${name}Panel`);
  if (!panel) return null;
  // `hidden` is an HTML boolean attribute; writing the `hidden` JS property does
  // not remove it, so set the attribute itself.
  panel.removeAttribute('hidden');
  document.body.classList.add('panels-open');
  return panel;
}

export function panelIsOpen(name) {
  const panel = document.getElementById(`${name}Panel`);
  return Boolean(panel) && !panel.hasAttribute('hidden');
}

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(child => child != null));
  return node;
}

export function formatTime(stamp) {
  if (!stamp) return '';
  try {
    return new Date(stamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function clipped(text, length = 90) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > length ? `${value.slice(0, length)}…` : value;
}
