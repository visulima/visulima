import type { ExpectationResult } from "./utils";
import { expectAnsiStrings } from "./utils";

export interface CustomMatchers {
    toEqualAnsi: (expected: string) => ExpectationResult;
}

/**
 * Extends Vitest expect with ANSI string comparison
 * Use in test files with: expect.extend({ toEqualAnsi });
 */
export const toEqualAnsi = (actual: string, expected: string): ExpectationResult => expectAnsiStrings(actual, expected);
