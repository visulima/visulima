import { VisConfigError } from "./vis-config-error";

/**
 * One deprecated key found in a loaded config, with the canonical
 * replacement and an optional path describing the JSON path inside the
 * config object (e.g. `scopedTasks[0].scope`).
 */
export interface DeprecatedKey {
    /** Inline nested rename — surfaced indented under the parent. */
    children?: DeprecatedKey[];
    /** Where in the config the key was found (e.g. `scopedTasks[0].scope`). */
    location?: string;
    /** The removed key. */
    name: string;
    /** What the user should rename it to. */
    renamedTo: string;
}

/**
 * Raised when a loaded `vis.config.ts` / `vis.task.ts` still uses keys
 * that have been removed in this major version. The error names every
 * removed key and the canonical replacement so users can rewrite by hand,
 * or run `vis migrate self` to auto-rewrite.
 */
export class VisConfigDeprecatedKeyError extends VisConfigError {
    public readonly filePath: string;

    public readonly removedKeys: ReadonlyArray<DeprecatedKey>;

    public constructor(filePath: string, chain: ReadonlyArray<string>, removedKeys: ReadonlyArray<DeprecatedKey>) {
        const lines: string[] = [`${filePath} uses removed keys.`, ""];

        for (const key of removedKeys) {
            const where = key.location ? ` (at ${key.location})` : "";

            lines.push(`  • ${key.name}${where} → renamed to \`${key.renamedTo}\``);

            for (const child of key.children ?? []) {
                lines.push(`        ↳ ${child.name} → renamed to \`${child.renamedTo}\``);
            }
        }

        lines.push("", "Run `vis migrate self` to auto-rewrite the config (use --dry-run to preview).");

        super(lines.join("\n"), chain);
        this.filePath = filePath;
        this.removedKeys = removedKeys;
    }
}
