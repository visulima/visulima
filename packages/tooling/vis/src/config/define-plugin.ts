import type { VisPlugin } from "../util/hooks";

/**
 * Type-safe helper for defining a vis plugin. Pure identity — exists
 * only so plugin authors get inference from the `VisPlugin` contract
 * without needing a `satisfies` annotation.
 *
 * Lives in its own module so plugins can import it without going
 * through `config.ts`, which re-exports plugins like `otelPlugin` and
 * would otherwise form an import cycle.
 */
export const definePlugin = (plugin: VisPlugin): VisPlugin => plugin;
