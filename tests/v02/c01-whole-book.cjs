const { spawnSync } = require('node:child_process');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Keep the shared delivery pipeline on the same foliate-js journey as PR #26.
// The fixture contains a two-chapter EPUB and a paginated TXT book; the browser
// gate proves import, TOC, body, cross-chapter TTS and position restoration.
run('python3', ['tests/c01-reader/make-books.py']);
run(process.execPath, ['tests/c01-reader/check.mjs']);
console.log(JSON.stringify({
  status: 'PASS',
  parser: 'foliate-js',
  epubChapters: 2,
  wholeBookTts: true,
  epubAndTxtResume: true,
}));
