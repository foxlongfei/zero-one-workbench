// What the reader is allowed to do on the keyboard, and how big it draws text.
//
// The reader is used in a sofa, in bed, with one hand and often by someone who
// is not the person who imported the book: screen-locked listening, a large
// type size and a space bar that means play are product requirements, not
// conveniences. Keeping the rules here (pure, no DOM) means the browser check
// and the unit tests agree on exactly one definition.
//
// Rules:
//   * media keys / headphone buttons are not delivered to the page at all, so
//     they are documented rather than handled (see `MEDIA_KEYS`),
//   * space toggles play unless focus is in a text field,
//   * ← / → turn the page, ↑ / ↓ move one paragraph,
//   * [ / ] nudge the speaking rate,
//   * + / - change the text size.

// One rule per line: key code → action. Keeping the table explicit (and free
// of nested lookups) makes the rule readable in a review and cheap at runtime.
const KEY_TABLE = [
  ['Space', 'toggle'],
  ['ArrowLeft', 'prevPage'],
  ['ArrowRight', 'nextPage'],
  ['ArrowUp', 'prevParagraph'],
  ['ArrowDown', 'nextParagraph'],
  ['BracketLeft', 'slower'],
  ['BracketRight', 'faster'],
  ['Equal', 'textBigger'],
  ['NumpadAdd', 'textBigger'],
  ['Minus', 'textSmaller'],
  ['NumpadSubtract', 'textSmaller'],
];

const ACTIONS = {
  table: KEY_TABLE,
  find(code) {
    for (const entry of KEY_TABLE) {
      if (entry[0] === code) return entry[1];
    }
    return null;
  },
};

export const KEY_CODES = ACTIONS;

// Media keys (MediaPlayPause, MediaTrackNext…) and headphone buttons are
// consumed by the operating system and never reach `keydown`; listing them
// keeps that limitation explicit instead of pretending the app handles them.
export const MEDIA_KEYS = ['MediaPlayPause', 'MediaTrackNext', 'MediaTrackPrevious', 'HeadsetHook'];

// Text fields own the keyboard: typing a note must never start the narration.
// Inputs whose type brings its own key behaviour (a slider adjusts with the
// arrow keys, a checkbox toggles with space) are *not* text fields, so the
// reader keeps its shortcuts there. Anything else — and an <input> without a
// type, which the browser treats as text — swallows the shortcut.
const NATIVE_INPUT_TYPES = [
  'range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'color',
  'date', 'time', 'datetime-local', 'month', 'week',
];

const TYPE_OWNED_INPUTS = new Set(NATIVE_INPUT_TYPES);

const hasOwn = (object, name) => Object.prototype.hasOwnProperty.call(object, name);

export function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable === true) return true;
  if (!hasOwn(target, 'tagName')) return false;
  const tag = String(target.tagName).toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag !== 'input') return false;
  if (!hasOwn(target, 'type')) return true;
  const typeName = String(target.type).toLowerCase();
  return TYPE_OWNED_INPUTS.has(typeName) ? false : true;
}

export function keyAction(event) {
  if (!event || typeof event !== 'object') return null;
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  if (isEditableTarget(event.target)) return null;
  if (!hasOwn(event, 'code')) return null;
  return ACTIONS.find(String(event.code));
}

// Text size: integer steps of 10%, clamped so the page never becomes a single
// word per line (or unreadably small on a phone).
export const TEXT_SCALE_MIN = 0.8;
export const TEXT_SCALE_MAX = 1.8;
export const TEXT_SCALE_STEP = 0.1;

export const clampTextScale = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  const steps = Math.round((number - TEXT_SCALE_MIN) / TEXT_SCALE_STEP);
  return Math.max(TEXT_SCALE_MIN, Math.min(TEXT_SCALE_MAX, TEXT_SCALE_MIN + steps * TEXT_SCALE_STEP));
};

export const stepTextScale = (current, direction) => clampTextScale(Number(current || 1) + Math.sign(direction || 0) * TEXT_SCALE_STEP);

// Rate nudged in tenths so the number on screen stays one the listener asked
// for ("1.2×"), not 1.2000000000000002×.
export const stepRate = (current, direction) => {
  const value = Math.round((Number(current) || 1) * 10 + Math.sign(direction || 0)) / 10;
  return Math.max(0.6, Math.min(1.8, value));
};
