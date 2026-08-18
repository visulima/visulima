import type { SequenceKind } from "./utils/sequence-walker";
import { ESC, findC1Sequence, findSequence, isC1Introducer } from "./utils/sequence-walker";

export type { SequenceKind } from "./utils/sequence-walker";

/** A run of printable text, carrying no escape sequence. */
export interface TextToken {
    /** Offset of the token in the input. */
    index: number;

    type: "text";

    /** The text itself. */
    value: string;
}

/** One complete escape sequence. */
export interface SequenceToken {
    /** Offset of the token in the input. */
    index: number;

    /** Which family the sequence belongs to. */
    kind: SequenceKind;

    type: "sequence";

    /** The sequence including its introducer and terminator. */
    value: string;
}

/**
 * A trailing `ESC` (or C1 introducer) whose sequence never terminated.
 *
 * Emitted rather than silently dropped so a caller streaming terminal output can hold the fragment
 * back and prepend it to the next chunk instead of corrupting it.
 */
export interface PartialToken {
    /** Offset of the token in the input. */
    index: number;

    type: "partial";

    /** Everything from the introducer to the end of the input. */
    value: string;
}

export type AnsiToken = PartialToken | SequenceToken | TextToken;

/**
 * Splits a string into its printable runs and escape sequences.
 *
 * Reading ANSI output usually means answering "which parts of this are text?" — for measuring,
 * rewriting, filtering by sequence type, or forwarding a byte stream without splitting a sequence
 * down the middle. Doing that with a regular expression means re-deriving where sequences end;
 * this shares one walker with `strip`, so the two can never disagree.
 *
 * A lazy generator: a caller looking for the first sequence does not pay to tokenize the rest.
 * @param input The string to scan.
 * @yields Each text run, complete sequence, and any unterminated trailing fragment, in order.
 * @example
 * ```typescript
 * import { scan } from "@visulima/ansi";
 *
 * for (const token of scan("\x1b[31mred\x1b[39m")) {
 *     if (token.type === "text") {
 *         console.log(token.value); // "red"
 *     }
 * }
 * ```
 */
// eslint-disable-next-line func-style
export function* scan(input: string): Generator<AnsiToken, void, undefined> {
    const { length } = input;

    let textStart = 0;
    let index = 0;

    while (index < length) {
        const code = input.codePointAt(index);
        const isEscape = code === ESC;

        if (!isEscape && !isC1Introducer(code)) {
            index += 1;

            continue;
        }

        const bounds = isEscape ? findSequence(input, index) : findC1Sequence(input, index);

        if (index > textStart) {
            yield { index: textStart, type: "text", value: input.slice(textStart, index) };
        }

        if (bounds === undefined) {
            yield { index, type: "partial", value: input.slice(index) };

            return;
        }

        yield { index, kind: bounds.kind, type: "sequence", value: input.slice(index, bounds.end + 1) };

        index = bounds.end + 1;
        textStart = index;
    }

    if (textStart < length) {
        yield { index: textStart, type: "text", value: input.slice(textStart) };
    }
}

export default scan;
