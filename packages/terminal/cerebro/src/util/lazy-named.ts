import type { CommandExecute, LazyCommandModule } from "../types/command";
import type { Toolbox as IToolbox } from "../types/toolbox";

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
// eslint-disable-next-line import/prefer-default-export -- re-exported by name from src/index.ts as public API
export const lazyNamed
    // No `TContext` parameter on purpose. It appeared only in the return type, so
    // TypeScript resolved it from whatever context the loader was assigned into —
    // and inside `defineCommand`, that context is `NoInfer`-wrapped and still has
    // unresolved type parameters, which collapsed it to `never`. Pinning the wide
    // toolbox instead is always assignable to a narrower one, because the handler
    // parameter is contravariant.
    = <M extends Record<string, unknown>>(load: () => Promise<M>, key: keyof M): () => Promise<LazyCommandModule<IToolbox>> =>
        async () => {
            const loaded = await load();

            return { default: loaded[key] as CommandExecute<IToolbox> };
        };
