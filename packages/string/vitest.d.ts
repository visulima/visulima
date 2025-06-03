// eslint-disable-next-line import/no-extraneous-dependencies
import "vitest";

import type { CustomMatchers } from "./src/test/vitest";

declare module "vitest" {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Assertion<T = any> = CustomMatchers<T>;

    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface AsymmetricMatchersContaining extends CustomMatchers {}
}
