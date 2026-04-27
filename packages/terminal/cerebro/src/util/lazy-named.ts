import type { CommandExecute, LazyCommandModule } from "../types/command";

/**
 * Builds a `loader` for commands whose handler lives as a named export in a
 * shared handler module (the typical pattern when one file holds multiple
 * subcommands' execute functions).
 * @example
 * ```ts
 * // commands/cache/handler.ts
 * export const cacheListExecute: CommandExecute<Toolbox> = async (toolbox) => { ... };
 * export const cacheCleanExecute: CommandExecute<Toolbox> = async (toolbox) => { ... };
 *
 * // commands/cache/index.ts
 * cli.addCommand({
 *     name: "list",
 *     loader: lazyNamed(() => import("./handler"), "cacheListExecute"),
 * });
 * ```
 */
export const lazyNamed = <M extends Record<string, unknown>, K extends keyof M, TContext>(
    load: () => Promise<M>,
    key: K,
): (() => Promise<LazyCommandModule<TContext>>) =>
    async () => {
        const module_ = await load();

        return { default: module_[key] as CommandExecute<TContext> };
    };
