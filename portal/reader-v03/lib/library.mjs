// Open library access for the reader: Standard Ebooks.
//
// Standard Ebooks publishes carefully edited, DRM-free public-domain ebooks
// and exposes its catalogue and downloads with CORS enabled. We never re-host
// a book; the browser fetches the publisher's own EPUB/AZW3 file and stores it
// in the reader's local IndexedDB shelf.
//
// Public-domain status is stated for the United States. Visitors elsewhere
// must check their own local law; the UI says this explicitly.

export const LIBRARY_BASE = 'https://standardebooks.org';

export const libraryDownloadUrl = (book, format = 'epub') => {
  const ext = format === 'azw3' ? 'azw3' : 'epub';
  return `${LIBRARY_BASE}${book.path}/downloads/${book.authorSlug}_${book.bookSlug}.${ext}?source=download`;
};

// Parse a `/ebooks?query=...` page. Kept as a pure mapping over the DOM so a
// browser test can prove the live catalogue still matches this contract.
export function parseSearchPage(doc) {
  const items = [...doc.querySelectorAll('ol.ebooks-list > li[typeof="schema:Book"]')];
  return items.map(item => {
    const path = item.getAttribute('about') || item.querySelector('a[property="schema:url"]')?.getAttribute('href') || '';
    const parts = path.split('/').filter(Boolean);
    const authorSlug = parts[1] || '';
    const bookSlug = parts[2] || '';
    const title = item.querySelector('p a[property="schema:url"] span[property="schema:name"]')?.textContent?.trim()
      || item.querySelector('a[property="schema:url"]')?.textContent?.trim()
      || '';
    const author = item.querySelector('p.author span[property="schema:name"]')?.textContent?.trim() || '';
    const cover = item.querySelector('img')?.getAttribute('src') || '';
    return {
      id: `se:${path}`,
      path,
      authorSlug,
      bookSlug,
      title,
      author,
      cover: cover ? new URL(cover, LIBRARY_BASE).href : '',
      pageUrl: `${LIBRARY_BASE}${path}`,
      epubUrl: libraryDownloadUrl({ path, authorSlug, bookSlug }, 'epub'),
      azw3Url: libraryDownloadUrl({ path, authorSlug, bookSlug }, 'azw3'),
      source: 'Standard Ebooks',
      rights: 'Public domain (United States)',
    };
  }).filter(book => book.path && book.bookSlug);
}

export async function searchStandardEbooks(query = '', { perPage = 48 } = {}) {
  const url = new URL('/ebooks', LIBRARY_BASE);
  if (query) url.searchParams.set('query', query);
  url.searchParams.set('per-page', String(perPage));
  url.searchParams.set('sort', query ? 'relevance' : 'popularity');
  const response = await fetch(url, { headers: { accept: 'application/xhtml+xml,text/html' } });
  if (!response.ok) throw new Error(`Standard Ebooks 返回 ${response.status}`);
  const text = await response.text();
  let doc = new DOMParser().parseFromString(text, 'application/xhtml+xml');
  if (doc.querySelector('parsererror')) doc = new DOMParser().parseFromString(text, 'text/html');
  if (doc.querySelector('parsererror')) {
    throw new Error('无法解析 Standard Ebooks 书目页面');
  }
  return parseSearchPage(doc);
}

export async function fetchLibraryBook(book, format = 'epub') {
  const url = format === 'azw3' ? book.azw3Url : book.epubUrl;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载失败：HTTP ${response.status}`);
  const blob = await response.blob();
  if (blob.size < 10000 || /text\/html|xhtml/i.test(blob.type)) {
    throw new Error('下载源返回了网页而不是电子书文件');
  }
  return blob;
}
