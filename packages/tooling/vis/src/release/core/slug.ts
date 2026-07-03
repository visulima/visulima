/**
 * Shared change-file slug generator.
 *
 * Filenames under `&lt;changesDir>/` need a unique-ish slug so multiple change
 * files can land in the same PR without conflicting. The slug is meant to
 * be human-skimmable in `git status`, not cryptographically random.
 *
 * Pickable strategies:
 *   - `randomAnimalSlug()` — `&lt;adjective>-&lt;animal>`. Used by `vis release add`
 *     and `vis release generate` for friendly UX.
 *   - `randomTimestampSlug(prefix)` — `&lt;prefix>-&lt;base36 timestamp>-&lt;4 hex>`.
 *     Used by `vis release plan -i --write` where the operator already
 *     knows the file came from an interactive override.
 */

const SLUG_WORDS: ReadonlyArray<string> = [
    "amber",
    "azure",
    "blue",
    "brave",
    "calm",
    "clever",
    "cool",
    "dazzle",
    "eager",
    "fancy",
    "gentle",
    "happy",
    "icy",
    "jolly",
    "keen",
    "lively",
    "merry",
    "neat",
    "ocean",
    "polite",
    "quiet",
    "rapid",
    "sleek",
    "tidy",
    "upbeat",
    "vivid",
    "warm",
    "xenial",
    "yummy",
    "zesty",
    "fox",
    "owl",
    "lynx",
    "otter",
    "deer",
    "hawk",
    "wren",
    "seal",
    "newt",
    "frog",
];

// Math.random is fine here — these slugs are filename suffixes, not security tokens.
// eslint-disable-next-line sonarjs/pseudo-random
const pickWord = (): string => SLUG_WORDS[Math.floor(Math.random() * SLUG_WORDS.length)] ?? "neat";

export const randomAnimalSlug = (): string => `${pickWord()}-${pickWord()}`;

// eslint-disable-next-line sonarjs/pseudo-random -- non-security; filename suffix only
export const randomTimestampSlug = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
