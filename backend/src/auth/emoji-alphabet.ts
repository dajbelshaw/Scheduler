/**
 * Curated set of 128 emoji for Emoji ID generation.
 *
 * Selection criteria:
 * - Renders consistently across iOS, Android, Windows, macOS
 * - No flags, skin-tone variants, ZWJ sequences, or gender modifiers
 * - No visually ambiguous pairs (e.g. similar faces excluded)
 * - No Japanese/regional symbols
 * - Drawn from: animals, food, nature, objects, activities, travel
 * - Visually distinct at small sizes (16px+)
 */

export const EMOJI_ALPHABET: readonly string[] = [
  // Animals (24)
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗',

  // Sea & nature creatures (8)
  '🐙', '🦑', '🦀', '🐡', '🐬', '🐳', '🦋', '🐢',

  // Food & drink (24)
  '🍎', '🍊', '🍋', '🍇', '🍓', '🍒', '🍑', '🥝',
  '🍕', '🍔', '🌮', '🍜', '🍣', '🍦', '🎂', '🍩',
  '🍪', '🥐', '🧀', '🥚', '🌽', '🥕', '🍄', '🥑',

  // Nature (16)
  '🌸', '🌻', '🌹', '🌿', '🍀', '🍁', '🍂', '🌊',
  '🌙', '⭐', '🌈', '⚡', '🔥', '❄️', '🌍', '🌋',

  // Objects (24)
  '⚽', '🏀', '🎾', '🏆', '🎯', '🎲', '🎮', '🎸',
  '🎺', '🥁', '🎨', '📷', '🔭', '🔬', '💡', '🔑',
  '⚓', '🧲', '💎', '🏺', '🧩', '🪄', '🎪', '🎠',

  // Travel & places (16)
  '🚀', '✈️', '🚂', '⛵', '🚁', '🏠', '🏰', '⛺',
  '🗺️', '🧭', '🏔️', '🌅', '🎡', '🗼', '🏟️', '🌉',

  // Symbols & misc (16)
  '💜', '💛', '💚', '💙', '🧡', '❤️', '🖤', '🤍',
  '☀️', '🌀', '💫', '🌠', '🎆', '🎇', '✨', '🍀',
] as const;

export const ALPHABET_SIZE = EMOJI_ALPHABET.length; // 128
export const ID_LENGTH = 4; // 128^4 = 268,435,456 permutations
