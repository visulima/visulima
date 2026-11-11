import type { configure } from "safe-stable-stringify";

/** The function `configure()` from safe-stable-stringify returns. At runtime it has no `configure`, `stringify` or `default` properties. */
export type StringifyFunction = ReturnType<typeof configure>;
