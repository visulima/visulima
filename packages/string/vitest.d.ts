// eslint-disable-next-line import/no-extraneous-dependencies,import/no-unused-modules
import "vitest";

import type { CustomMatchers } from "./src/test/vitest";

declare module "vitest" {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface,@typescript-eslint/no-explicit-any
    interface Assertion<T = any> extends CustomMatchers<T> {}
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface AsymmetricMatchersContaining extends CustomMatchers {}
}
