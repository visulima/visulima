/**
 * Portable replacement for `node:util`'s `stripVTControlCharacters`.
 *
 * The Node builtin is a plain regex replace with no platform bindings behind it,
 * but importing `node:util` to reach it makes every module that strips ANSI
 * unloadable on runtimes without a Node compatibility layer — Cloudflare Workers
 * (`workerd`) without the `nodejs_compat` flag, browsers, and edge runtimes in
 * general. Inlining the same pattern keeps the behaviour byte-for-byte identical
 * with Node's while leaving the package free of `node:*` imports.
 *
 * The pattern is the one Node itself uses, adopted from `ansi-regex`: an ESC
 * (`U+001B`) or 8-bit CSI (`U+009B`) introducer, optional intermediate bytes,
 * then either an OSC-style body closed by BEL (`U+0007`) or a string terminator
 * (`ESC \` / `U+009C`), or a CSI-style parameter list closed by a final byte.
 *
 * Built with `new RegExp` rather than a literal so the control code points stay
 * readable as escapes in the source instead of being embedded raw. It is a
 * verbatim transcription — the redundant groups and quantifiers the regex
 * linters flag are part of the upstream pattern and must not be "simplified",
 * or the output stops matching Node's byte for byte.
 *
 * ## Why this is not `RE_ANSI`
 *
 * This package deliberately carries two ANSI patterns, and they are not
 * interchangeable. `RE_ANSI` (`src/constants.ts`) is the package's own hardened
 * ANSI stripper — it recognises SGR/CSI sequences and OSC 8 hyperlinks, and
 * nothing else. `RE_VT_CONTROL` exists for one contract only: producing exactly
 * what `node:util.stripVTControlCharacters` produces, verified byte-identical
 * over 500 000 fuzzed strings.
 *
 * They cannot be merged, because the two contracts genuinely disagree. Against
 * `ESC[s`, `ESC[u`, `ESC[~` and generic OSC (`ESC]0;title BEL`), `RE_VT_CONTROL`
 * strips and `RE_ANSI` leaves the input untouched. Folding either into the other
 * would silently change one of the two behaviours.
 *
 * **Which one to change for a given bug:** if the report is about this package's
 * ANSI-aware helpers (width measurement, slicing, wrapping, `stripAnsi`), it is
 * `RE_ANSI`. If it is about `stripVTControlCharacters` disagreeing with Node,
 * it is this pattern — and the fix is whatever restores parity with `node:util`,
 * never a local "improvement".
 *
 * ## ReDoS
 *
 * The nested quantifiers here look alarming next to the flattened classes in
 * `RE_ANSI` (which were flattened for exactly that reason). They were measured:
 * `ESC[` followed by `";a"`×n, `"a;"`×n, `"1"`×n, and repeated bare introducers
 * all scale linearly from 2 KB to 32 KB of input, topping out around 0.5 ms.
 * There is no catastrophic backtracking to fix; please do not re-litigate it
 * without a failing benchmark.
 * @see https://github.com/chalk/ansi-regex (MIT — Sindre Sorhus, Qix-, arjunmehta, LitoMore)
 */
/* eslint-disable regexp/no-useless-quantifier, regexp/no-useless-non-capturing-group, regexp/no-trivially-nested-quantifier, regexp/prefer-w, sonarjs/empty-string-repetition, sonarjs/no-control-regex, unicorn/prefer-string-raw */
const RE_VT_CONTROL: RegExp = new RegExp(
    "[\\u001B\\u009B][[\\]()#;?]*"
    + "(?:(?:(?:(?:;[-a-zA-Z\\d/#&.:=?%@~_]+)*"
    + "|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d/#&.:=?%@~_]*)*)?"
    + "(?:\\u0007|\\u001B\\u005C|\\u009C))"
    + "|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))",
    "g",
);
/* eslint-enable regexp/no-useless-quantifier, regexp/no-useless-non-capturing-group, regexp/no-trivially-nested-quantifier, regexp/prefer-w, sonarjs/empty-string-repetition, sonarjs/no-control-regex, unicorn/prefer-string-raw */

/**
 * Removes ANSI/VT control sequences from a string.
 * @param value The string to strip ANSI/VT control sequences from.
 * @returns The string with every ANSI/VT control sequence removed.
 */
const stripVTControlCharacters = (value: string): string => {
    if (typeof value !== "string") {
        throw new TypeError(`The "value" argument must be of type string. Received ${typeof value}`);
    }

    return value.replaceAll(RE_VT_CONTROL, "");
};

export default stripVTControlCharacters;
