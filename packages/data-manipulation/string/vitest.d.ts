// eslint-disable-next-line import/no-extraneous-dependencies
import "vitest";

import type { CustomMatchers } from "./src/test/vitest";

declare module "vitest" {
    // Parameters must match vitest's `Assertion<R, T>` declaration exactly for the interfaces to merge.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type, unused-imports/no-unused-vars
    interface Assertion<R extends void | Promise<void> = void, T = unknown> extends CustomMatchers {}

    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface AsymmetricMatchersContaining extends CustomMatchers {}
}
