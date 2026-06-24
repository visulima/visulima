/**
 * Runtime adapter contract for the cross-runtime multi-tool (see
 * `rfc/design-runtime-multitool.md`). Phase 0 defines the identity +
 * detection metadata; Phase 1 extends adapters with the spawn-building
 * methods (`runFile` / `runScript` / `install` / `exec`) that route through
 * `pm-runner`. Deno is a planned third adapter — deliberately not a
 * `RuntimeId` yet (it carries permission + no-`node_modules` semantics that
 * the first cut omits).
 */

/** JS runtimes vis can target today. `"deno"` is deferred. */
export type RuntimeId = "bun" | "node";

export interface RuntimeAdapter {
    /** Stable runtime identifier. */
    readonly id: RuntimeId;

    /** Human-readable label for `--help` / logs. */
    readonly label: string;

    /**
     * Lockfiles whose presence (walking up from cwd) selects this runtime,
     * highest-priority first. Mirrors `pm-runner`'s lockfile table so the two
     * detectors never disagree.
     */
    readonly lockfiles: ReadonlyArray<string>;

    /**
     * File that declares runnable scripts for this runtime. `package.json`
     * for both Node and Bun; `deno.json` when the Deno adapter lands.
     */
    readonly scriptSource: "package.json";
}
