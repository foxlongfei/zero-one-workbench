// Book building: EPUB (via foliate-js in the browser) and TXT (pure).
// Kept free of DOM APIs so TXT books can be built in tests.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', middot: '·', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’' };

export const decodeEntities = value => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
  .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);

// Extract paragraphs from an XHTML document string (used for fallback parsing
// and unit tests). Preserves CJK text and drops scripts, styles and nav landmarks.
export function paragraphsFromHtml(html) {
  const cleaned = String(html ?? '')
    .replace(/<(script|style|nav|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?(p|div|h[1-6]|li|blockquote|section|article|br|tr|td|th|dt|dd|pre)[^>]*>/gi, '\n');
  return decodeEntities(cleaned)
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function bookFromTxt(text, { title = '未命名', author = '', chapters = null } = {}) {
  const list = chapters ?? [];
  return {
    title,
    author,
    format: 'TXT',
    language: 'zh',
    chapters: list.map((chapter, index) => ({
      title: chapter.title || `第 ${index + 1} 章`,
      paragraphs: chapter.paragraphs,
      sectionIndex: index,
      href: null,
    })),
  };
}

// Build the chapter list from a foliate-js book object: one narration chapter
// per spine section, titled from the nearest TOC entry.
export function mapEpubSections({ sections, toc, metadata = {}, format = 'EPUB' } = {}) {
  const tocTitles = new Map();
  const walk = (items, depth = 0) => {
    for (const item of items ?? []) {
      const href = String(item.href ?? '').split('#')[0];
      if (href && !tocTitles.has(href)) tocTitles.set(href, { label: item.label, depth });
      walk(item.subitems, depth + 1);
    }
  };
  walk(toc);
  return {
    title: pickText(metadata.title),
    author: pickText(metadata.author),
    language: pickText(metadata.language) || 'zh',
    format,
    chapters: (sections ?? []).map((section, index) => {
      const href = String(section.id ?? '').split('#')[0];
      const tocEntry = tocTitles.get(href);
      return {
        title: tocEntry?.label || `第 ${index + 1} 部分`,
        tocLabel: tocEntry?.label ?? null,
        sectionIndex: index,
        href: section.id ?? null,
        paragraphs: [],
      };
    }),
  };
}

export const pickText = value => {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(pickText).find(Boolean) ?? '';
  if (value && typeof value === 'object') return Object.values(value).map(pickText).find(Boolean) ?? '';
  return '';
};

export function fillChapter(chapter, paragraphs) {
  chapter.paragraphs = paragraphs.filter(Boolean);
  return chapter;
}

export const totalParagraphs = book => book?.chapters.reduce((sum, chapter) => sum + chapter.paragraphs.length, 0) ?? 0;
