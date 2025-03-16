import type { ExpectationResult } from "./utils";
import { expectAnsiStrings } from "./utils";

declare module "vitest" {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interface Assertion<T = any> {
        // eslint-disable-next-line @typescript-eslint/method-signature-style
        toEqualAnsi(expected: string): T;
    }

    interface AsymmetricMatchersContaining {
        // eslint-disable-next-line @typescript-eslint/method-signature-style
        toEqualAnsi(expected: string): void;
    }
}

/**
 * Extends Vitest expect with ANSI string comparison
 * Use in test files with: expect.extend({ toEqualAnsi });
 */
// eslint-disable-next-line import/prefer-default-export
export const toEqualAnsi: Matcher = (actual: string, expected: string): ExpectationResult => expectAnsiStrings(actual, expected);
