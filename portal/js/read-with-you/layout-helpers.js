// Keyboard, MediaSession and screen-wake helpers shared by the reader shell.
export function shortcutFor(event, layout) {
  if (event.defaultPrevented) return null;
  if (event.target.closest?.('input,textarea,select,[contenteditable="true"]')) return null;
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  const key = event.key;
  if (key === 'ArrowRight' || key === 'PageDown' || key === 'j' || key === 'J') return { action: 'next' };
  if (key === 'ArrowLeft' || key === 'PageUp' || key === 'k' || key === 'K') return { action: 'prev' };
  if (key === ' ') return { action: layout === 'scrolled' ? 'page-next' : 'toggle-speech' };
  if (key === 'Escape') return { action: 'close-panels' };
  if (key === 'n' || key === 'N') return { action: 'toggle-panel', panel: 'notes' };
  if (key === 't' || key === 'T') return { action: 'toggle-panel', panel: 'toc' };
  if (key === 'b' || key === 'B') return { action: 'add-bookmark' };
  if (key === 'Home') return { action: 'start' };
  if (['1', '2', '3', '4', '5', '6'].includes(key)) return { action: 'speed', value: 0.4 + Number(key) * 0.2 };
  return null;
}

export function setupMediaSession(handlers) {
  if (!('mediaSession' in navigator)) return { update() {}, clear() {} };
  const map = { play: handlers.play, pause: handlers.pause, nexttrack: handlers.next, previoustrack: handlers.prev, stop: handlers.stop };
  for (const [action, handler] of Object.entries(map)) {
    try { navigator.mediaSession.setActionHandler(action, handler ? () => handler() : null); } catch {}
  }
  return {
    update(meta = {}) {
      try {
        if ('MediaMetadata' in window && meta.title !== undefined) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: meta.title || '', artist: meta.artist || '陪你读书', album: meta.album || '',
            artwork: meta.artwork ? [{ src: meta.artwork, sizes: '512x512' }] : [],
          });
        }
        if ('playbackState' in navigator.mediaSession) navigator.mediaSession.playbackState = meta.state || 'none';
      } catch {}
    },
    clear() {
      try {
        navigator.mediaSession.metadata = null;
        if ('playbackState' in navigator.mediaSession) navigator.mediaSession.playbackState = 'none';
      } catch {}
    },
  };
}

export function keepScreenAwake() {
  let lock = null;
  let wanted = false;
  const acquire = async () => {
    if (!wanted || lock || document.visibilityState !== 'visible') return;
    try {
      if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen');
    } catch {}
  };
  const release = () => {
    wanted = false;
    try { lock?.release?.(); } catch {}
    lock = null;
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acquire(); });
  return { request() { wanted = true; acquire(); }, release };
}

export function timeLabel(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function formatStamp(stamp) {
  if (!stamp) return '';
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
