// Playlist resolution for 听世界 (listening world): background music, radio
// streams and podcasts resolved from licences. Resolution is data-driven and
// pure so it can be tested; playback itself lives in the UI.
//
// Rights model: every source states license and whether it is safe for public
// deployment. Streams at third-party URLs are never re-hosted; we only link to
// the official endpoint the rights holder publishes. Bundled assets must be
// public-domain or CC0/CC-BY (attribution rendered in the UI).

const hourNumber = date => (date instanceof Date ? date.getHours() : Number(date));

export const BUILTIN_SOURCES = [
  {
    id: 'ambience-room',
    kind: 'ambience',
    title: '安静书房',
    attribution: '合成环境音，公共领域（本站生成）',
    license: 'public-domain',
    requiresNetwork: false,
    daypart: null,
  },
  {
    id: 'bbcr3',
    kind: 'radio',
    title: 'BBC Radio 3 · 古典音乐',
    url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_three',
    homepage: 'https://www.bbc.co.uk/radio3',
    attribution: 'BBC Radio 3 官方公开直播地址',
    license: 'official-stream',
    requiresNetwork: true,
    daypart: ['day'],
    topic: 'classical',
  },
  {
    id: 'france-musique',
    kind: 'radio',
    title: 'France Musique · 古典音乐',
    url: 'https://icecast.radiofrance.fr/francemusique-midfi.mp3',
    homepage: 'https://www.radiofrance.fr/francemusique',
    attribution: 'Radio France 官方公开直播地址',
    license: 'official-stream',
    requiresNetwork: true,
    daypart: ['day'],
    topic: 'classical',
  },
  {
    id: 'ningxia-story',
    kind: 'podcast',
    title: '睡前故事（示例单集）',
    url: '',
    attribution: '示例条目：上线前须替换为持权方授权节目',
    license: 'placeholder',
    requiresNetwork: true,
    daypart: ['evening'],
    topic: 'story',
  },
];

export function resolveDaypart(date = new Date()) {
  const h = hourNumber(date);
  if (h < 7) return 'night';
  if (h < 18) return 'day';
  return 'evening';
}

// Pick the playlist to play behind the book.
export function resolvePlaylist({ sources = BUILTIN_SOURCES, ambience = [], daypart = resolveDaypart(), topic = '', favourites = [], mode = 'auto' } = {}) {
  if (mode === 'ambience') {
    const item = ambience[0];
    if (!item) return { kind: 'none', reason: '尚未添加背景音乐文件' };
    return { kind: 'ambience', item };
  }
  if (mode === 'favourites') {
    const source = sources.find(s => favourites.includes(s.id));
    if (!source) return { kind: 'none', reason: '收藏夹为空' };
    return playlistOf(source);
  }
  const candidates = sources.filter(source => source.license !== 'placeholder'
    && source.daypart?.includes(daypart)
    && (!topic || source.topic === topic));
  if (candidates.length) return playlistOf(candidates[0]);
  if (ambience.length) return { kind: 'ambience', item: ambience[0] };
  return { kind: 'none', reason: `当前时段（${daypart}）没有可用频道` };
}

const playlistOf = source => ({
  kind: source.kind,
  item: source,
  playable: source.requiresNetwork ? Boolean(source.url) : true,
});

export function catalog({ sources = BUILTIN_SOURCES } = {}) {
  const byKind = {};
  for (const source of sources) {
    byKind[source.kind] = byKind[source.kind] || [];
    byKind[source.kind].push(source);
  }
  return byKind;
}
