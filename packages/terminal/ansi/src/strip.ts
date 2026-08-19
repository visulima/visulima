import { ESC, findC1Sequence, findSequence, hasIntroducer, isC1Introducer } from "./utils/sequence-walker";

/**
 * Removes ANSI escape codes from a string.
 *
 * The implementation is a single linear pass over the input (O(n)) — it never
 * relies on a backtracking regular expression, so it is safe to run on
 * untrusted subprocess/log output without risking polynomial ReDoS on
 * adversarial input (e.g. many unterminated `ESC ]` prefixes).
 *
 * Recognised sequences: CSI (`ESC [ ... final`, final byte `0x40`-`0x7e`),
 * OSC (`ESC ] ... BEL` or terminated by ST, covering window titles and
 * hyperlinks), string sequences DCS/SOS/PM/APC (`ESC P|X|^|_ ... ST`), and
 * two-character escapes (`ESC` plus a single byte, e.g. `ESC 7`, `ESC c`).
 * The 8-bit C1 single-byte introducers (`0x9b` CSI, `0x9d` OSC, `0x90` DCS,
 * `0x98` SOS, `0x9e` PM, `0x9f` APC) are recognised as equivalents of their
 * `ESC`-prefixed forms.
 * @param input The string from which to remove ANSI escape codes.
 * @returns The input string with all ANSI escape codes stripped.
 * @example
 * ```typescript
 * import { strip } from "@visulima/ansi";
 *
 * const textWithAnsi = "\x1b[32mHello\x1b[0m";
 * console.log(strip(textWithAnsi)); // "Hello"
 * ```
 */
const strip = (input: string): string => {
    // Fast path: no escape introducer (ESC or 8-bit C1) means nothing to strip.
    if (!hasIntroducer(input)) {
        return input;
    }

    let result = "";
    let chunkStart = 0;
    let index = 0;
    const { length } = input;

    while (index < length) {
        const code = input.codePointAt(index);

        let bounds;

        if (code === ESC) {
            bounds = findSequence(input, index);
        } else if (isC1Introducer(code)) {
            bounds = findC1Sequence(input, index);
        } else {
            index += 1;

            continue;
        }

        // Unrecognised lone ESC or unterminated control string: drop the rest of the input,
        // mirroring a greedy match that never finds its terminator.
        const end = bounds === undefined ? length - 1 : bounds.end;

        result += input.slice(chunkStart, index);
        chunkStart = end + 1;
        index = end + 1;
    }

    result += input.slice(chunkStart);

    return result;
};

export default strip;
