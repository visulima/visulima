/**
 * Public styles surface (`@visulima/tui/styles`).
 *
 * `Styles` is the prop contract every layout-bearing component builds on, so
 * it has to be reachable from outside the package. The module's default export
 * (the yoga style applier the renderer calls) stays internal.
 */
export type { Styles } from "../styles";
