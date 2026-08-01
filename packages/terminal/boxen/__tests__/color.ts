import { Colorize } from "@visulima/colorize";

/**
 * Color bindings for the test suite, pinned to a fixed color-support level.
 *
 * `@visulima/colorize` resolves its level once, at import time, by delegating to
 * `@visulima/is-ansi-color-supported` — which reads `FORCE_COLOR`, `NO_COLOR`,
 * the CI variables and `process.stdout.isTTY`. Its module-level `red`/`bgRed`/…
 * exports therefore emit plain text whenever the suite runs without a TTY: under
 * the husky + lint-staged pre-commit hook, with output piped to a file, or on a
 * CI log collector. Tests that assert on escape sequences then fail for a reason
 * that has nothing to do with boxen.
 *
 * Boxen never detects color itself — it only applies the color callbacks the
 * caller hands it — so every escape sequence in these tests is produced by
 * colorize, not by boxen. Binding the styles to an instance with an explicit
 * level makes the assertions depend on boxen's behavior alone, which is what
 * they are meant to cover, instead of on whichever terminal happens to be
 * attached. Nothing is weakened: if boxen stopped applying a color callback the
 * escape sequence would vanish from the output and the assertion would still
 * catch it.
 *
 * Level 1 (basic 16 colors) rather than 3: every style used in the suite is a
 * basic named color, and level 1 emits exactly the codes the committed snapshots
 * record.
 */
const pinnedColorize = new Colorize({ level: 1 });

const { bgRed, blue, green, red, yellow } = pinnedColorize;

// `x` cannot occur inside an ANSI SGR sequence (ESC `[` digits `;` `m`), so
// splitting a style's output on it always yields exactly the opening and
// closing halves.
const SENTINEL = "x";

/**
 * The opening escape sequence a pinned style emits, recovered from the style's
 * own output.
 *
 * Assertions use this instead of a hand-written escape literal so they state the
 * relationship — "the box contains what `bgRed` emits" — rather than a constant
 * that has to be kept in sync with colorize by hand.
 * @param style A pinned style function from this module.
 * @returns The escape sequence `style` prepends to its input.
 */
const openSequence = (style: (value: string) => string): string => {
    const [open = ""] = style(SENTINEL).split(SENTINEL);

    return open;
};

export { bgRed, blue, green, openSequence, red, yellow };
