'use strict';

const speakButton = document.getElementById('speak');
const pauseButton = document.getElementById('pause-speech');
const stopButton = document.getElementById('stop-speech');
const status = document.getElementById('speech-status');
const article = document.querySelector('article[aria-label="中文原创摘要"]');

if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
  speakButton.disabled = true;
  pauseButton.disabled = true;
  stopButton.disabled = true;
  status.textContent = '此浏览器没有可用的语音朗读能力';
} else {
  speakButton.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(article.innerText.trim());
    utterance.lang = 'zh-CN';
    utterance.onstart = () => { status.textContent = '正在朗读'; };
    utterance.onend = () => { status.textContent = '朗读结束'; };
    utterance.onerror = () => { status.textContent = '朗读失败；请检查浏览器语音设置'; };
    window.speechSynthesis.speak(utterance);
  });
  pauseButton.addEventListener('click', () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      status.textContent = '继续朗读';
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      status.textContent = '已暂停';
    }
  });
  stopButton.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    status.textContent = '已停止';
  });
}