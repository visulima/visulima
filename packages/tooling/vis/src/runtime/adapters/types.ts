/**
 * Runtime adapter contract for the cross-runtime multi-tool (see
 * `rfc/design-runtime-multitool.md`). Phase 0 defines the identity +
 * detection metadata; Phase 1 extends adapters with the spawn-building
 * methods (`runFile` / `runScript` / `install` / `exec`) that route through
 * `pm-runner`.
 */

/** JS runtimes vis can target today. */
export const RUNTIME_IDS = ["bun", "node"] as const;

export type RuntimeId = (typeof RUNTIME_IDS)[number];

export const isRuntimeId = (value: string): value is RuntimeId => (RUNTIME_IDS as ReadonlyArray<string>).includes(value);

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
}
