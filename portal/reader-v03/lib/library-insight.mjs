// How far a reader got in a book, and how to show it, without a server.
//
// The library screen has to answer three questions at a glance: how much is
// left, how long that takes to listen to, and what the person holding the
// device was doing last time. Idle time must never count as progress, so the
// estimator refuses to guess without a span to measure.

import { remainingMinutes, listeningProgress } from './progress.mjs';

export const MIN_SAMPLE_MS = 30000;
// A book listened to at 400 characters per second was skimmed, not read:
// such a rate is more likely a bug in the timing than a very fast reader.
export const MAX_CHARS_PER_MINUTE = 4000;

export function listeningEstimate({ chars, elapsedMs } = {}) {
  const seconds = Math.max(0, Number(elapsedMs) || 0) / 1000;
  const count = Math.max(0, Number(chars) || 0);
  if (count < 40 || seconds < MIN_SAMPLE_MS / 1000) return { charsPerMinute: 0, reliable: false };
  const rate = Math.round((count / seconds) * 60);
  if (!Number.isFinite(rate) || rate <= 0 || rate > MAX_CHARS_PER_MINUTE) return { charsPerMinute: 0, reliable: false };
  return { charsPerMinute: rate, reliable: true };
}

// When will this book be finished if listening continues every day at the
// observed pace? Returns null when there is nothing honest to say.
export function finishDate({ remainingMinutes: minutes, minutesPerDay } = {}, now = new Date()) {
  const left = Number(minutes) || 0;
  const perDay = Number(minutesPerDay) || 0;
  if (left <= 0) return { days: 0, date: now, label: '已经听完了' };
  if (perDay <= 0) return null;
  const days = Math.max(1, Math.ceil(left / perDay));
  const date = new Date(now.getTime() + days * 86400000);
  return { days, date, label: days === 1 ? '明天就能听完' : `还要 ${days} 天` };
}

// One line for a shelf card or the player: "剩 2 小时 10 分 · 已听 37%".
export function progressLine(book, position, { rate = 1 } = {}) {
  const share = listeningProgress(book, position);
  const minutes = remainingMinutes(book, position, { rate });
  return {
    share,
    minutes,
    label: minutes > 0 ? `还剩约 ${minutes >= 60 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分` : `${minutes} 分钟`}` : '已经到最后一段',
    percentLabel: `${Math.round(share * 100)}%`,
  };
}

const DAY = 86400000;

// "今天 / 昨天 / 3 天前" for a history line, so a stale position is obvious.
export function agoLabel(iso, now = Date.now()) {
  const at = Date.parse(iso ?? '');
  if (!Number.isFinite(at)) return '时间不详';
  const days = Math.floor((now - at) / DAY);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days} 天前`;
  return `${Math.floor(days / 30)} 个月前`;
}

// Yesterday's listening time, from the settings.statistics.days map.
export function yesterdayMinutes(days = {}, now = new Date()) {
  const key = new Date(now.getTime() - DAY).toISOString().slice(0, 10);
  return Math.round(((days ?? {})[key] || 0) / 60000);
}
