// 背景音混音规则的单元测试：node --test tests/reader/unit
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, SCENE_IDS, sceneById, effectiveGain, AmbientMixer } from '../../../portal/reader/ambient.js';

test('内置音景均为合成实现，带 id/name/build', () => {
  assert.ok(SCENES.length >= 4);
  assert.deepEqual(SCENE_IDS, SCENES.map(s => s.id));
  for (const scene of SCENES) {
    assert.equal(typeof scene.build, 'function', scene.id);
    assert.ok(scene.name && scene.glyph && scene.description);
  }
});

test('sceneById 未命中返回 null', () => {
  assert.equal(sceneById('nope'), null);
  assert.equal(sceneById('rain')?.id, 'rain');
});

test('effectiveGain 朗读时压到 25%，关闭压低则保持原音量', () => {
  assert.equal(effectiveGain(0.4, { speaking: true, ducking: true }), 0.1);
  assert.equal(effectiveGain(0.4, { speaking: false, ducking: true }), 0.4);
  assert.equal(effectiveGain(0.4, { speaking: true, ducking: false }), 0.4);
  assert.equal(effectiveGain(-1, { speaking: false, ducking: true }), 0);
  assert.equal(effectiveGain(5, { speaking: false, ducking: true }), 1);
});

test('AmbientMixer 无 AudioContext 时安全降级', async () => {
  const mixer = new AmbientMixer();
  mixer.setVolume(0.5);
  mixer.setSpeaking(true);
  assert.equal(mixer.isPlaying, false);
  assert.equal(await mixer.play('rain'), false);
  mixer.stop();
  mixer.destroy();
});

test('AmbientMixer 用假 AudioContext 记录压音与停止', async () => {
  const created = [];
  const makeParam = () => ({ value: 0, setTargetAtTime(v) { this.value = v; } });
  class FakeCtx {
    constructor() { this.sampleRate = 8000; this.state = 'running'; this.currentTime = 0; this.destination = {}; created.push(this); }
    createGain() { return { gain: makeParam(), connect: n => n }; }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { return { connect: n => n, start() { this.started = true; }, stop() { this.stopped = true; } }; }
    createBiquadFilter() { return { connect: n => n, frequency: makeParam(), Q: makeParam() }; }
    createOscillator() { return { connect: n => n, start() {}, stop() {}, frequency: makeParam(), type: 'sine' }; }
    createMediaElementSource() { return { connect() {} }; }
    close() { this.closed = true; }
  }
  globalThis.AudioContext = FakeCtx;
  try {
    const mixer = new AmbientMixer();
    mixer.setVolume(0.4);
    assert.equal(await mixer.play('hearth'), true);
    assert.equal(mixer.playingId, 'hearth');
    const ctx = created[0];
    assert.equal(ctx.destination !== undefined, true);
    mixer.setSpeaking(true);
    assert.equal(mixer.master.gain.value, 0.1);
    mixer.setDucking(false);
    assert.equal(mixer.master.gain.value, 0.4);
    mixer.stop();
    assert.equal(mixer.isPlaying, false);
    mixer.destroy();
    assert.equal(ctx.closed, true);
  } finally {
    delete globalThis.AudioContext;
  }
});
