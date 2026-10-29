'use strict';

const form = document.getElementById('response-form');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const response = Object.fromEntries(new FormData(form));
  response.packetCode = document.body.dataset.packet;
  response.submittedAt = new Date().toISOString();
  const blob = new Blob([`${JSON.stringify(response, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reader-response-${response.participantCode}.json`;
  link.click();
  URL.revokeObjectURL(url);
  form.hidden = true;
  document.getElementById('completion').hidden = false;
});