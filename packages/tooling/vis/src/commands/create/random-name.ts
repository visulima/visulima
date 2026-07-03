/**
 * Random project name generator — produces friendly `word-word` names
 * used as default project name suggestions in interactive mode.
 *
 * Uses `@nkzw/safe-word-list` for a curated set of ~2700 safe English words.
 */

import { getRandomWord } from "@nkzw/safe-word-list";

/**
 * Generate a random `word-word` project name from the safe word list.
 * @example
 * ```ts
 * randomName(); // "swift-ember"
 * randomName(); // "bold-prism"
 * ```
 */
export const randomName = (): string => `${getRandomWord()}-${getRandomWord()}`;
