import { BEL, OSC } from "./constants";

/** Strips OSC terminators (BEL, ESC) so caller-supplied parameters cannot inject escape sequences. */
// eslint-disable-next-line no-control-regex, sonarjs/no-control-regex
const sanitize = (value: string): string => value.replaceAll(/[\u0007\u001B]/g, "");

/**
 * Returns a FinalTerm shell-integration sequence (`OSC 133`).
 *
 * The FinalTerm protocol lets shells mark the structure of their output — where
 * the prompt starts, where the user's command begins, where its output starts
 * and when it finished — so terminals can offer features like jump-to-prompt,
 * command status and selection of command output.
 *
 * Sequence: `OSC 133 ; Pt BEL`
 * @param pm The semicolon-delimited parameters of the sequence.
 * @returns The `OSC 133` escape sequence.
 * @see {@link https://iterm2.com/documentation-shell-integration.html}
 */
export const finalTerm = (...pm: string[]): string => `${OSC}133;${pm.map((value) => sanitize(value)).join(";")}${BEL}`;

/**
 * Marks the start of the shell prompt. Sent just before the prompt is printed.
 *
 * Sequence: `OSC 133 ; A ; Pt BEL`
 * @param pm Additional parameters appended after the `A` marker.
 * @returns The `OSC 133 ; A` escape sequence.
 */
export const finalTermPrompt = (...pm: string[]): string => finalTerm("A", ...pm);

/**
 * Marks the end of the prompt and the start of the user's command input.
 *
 * Sequence: `OSC 133 ; B ; Pt BEL`
 * @param pm Additional parameters appended after the `B` marker.
 * @returns The `OSC 133 ; B` escape sequence.
 */
export const finalTermCmdStart = (...pm: string[]): string => finalTerm("B", ...pm);

/**
 * Marks the start of the command output (the command is about to be executed).
 *
 * Sequence: `OSC 133 ; C ; Pt BEL`
 * @param pm Additional parameters appended after the `C` marker.
 * @returns The `OSC 133 ; C` escape sequence.
 */
export const finalTermCmdExecuted = (...pm: string[]): string => finalTerm("C", ...pm);

/**
 * Marks the end of the command output. May carry the command's exit code.
 *
 * Sequence: `OSC 133 ; D ; Pt BEL`
 * @param pm Additional parameters appended after the `D` marker (e.g. the exit code).
 * @returns The `OSC 133 ; D` escape sequence.
 */
export const finalTermCmdFinished = (...pm: string[]): string => finalTerm("D", ...pm);
