// Pure contract tests for the Standard Ebooks catalogue link builder.
// The live catalogue parser is exercised in tests/reader-v03/library-check.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';

import { LIBRARY_BASE, libraryDownloadUrl } from '../../portal/reader-v03/lib/library.mjs';

test('Standard Ebooks downloads use the publisher endpoint and format extension', () => {
  const book = { path: '/ebooks/jane-austen/pride-and-prejudice', authorSlug: 'jane-austen', bookSlug: 'pride-and-prejudice' };
  assert.equal(
    libraryDownloadUrl(book, 'epub'),
    `${LIBRARY_BASE}/ebooks/jane-austen/pride-and-prejudice/downloads/jane-austen_pride-and-prejudice.epub?source=download`,
  );
  assert.equal(
    libraryDownloadUrl(book, 'azw3'),
    `${LIBRARY_BASE}/ebooks/jane-austen/pride-and-prejudice/downloads/jane-austen_pride-and-prejudice.azw3?source=download`,
  );
  assert.match(libraryDownloadUrl(book, 'unknown'), /\.epub\?source=download$/);
});
