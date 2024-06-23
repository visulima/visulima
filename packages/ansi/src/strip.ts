// eslint-disable-next-line import/no-extraneous-dependencies
import ansiRegex from 'ansi-regex';

const regex = ansiRegex();

/**
 * Remove ANSI escape codes from a string.
 *
 * @remarks
 * This method is adapted from chalk's {@link https://github.com/chalk/slice-ansi|`slice-ansi`} package,
 * and is essentially identical.
 *
 * @example
 * ```ts
 * import { strip } from '@visulima/ansi';
 *
 * const stripped = strip('\x1b[32mfoo\x1b[39m'); // 'foo'
 * ```
 *
 * @param input - Input string to strip.
 * @returns The input string with all ANSI escape codes removed.
 */
const strip = (input: string): string => input.replace(regex, '');

export default strip;
