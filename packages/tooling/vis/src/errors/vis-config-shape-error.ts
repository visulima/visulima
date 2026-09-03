import { VisConfigError } from "./vis-config-error";

/** One malformed value found in a loaded config. */
export interface ShapeViolation {
    /** What the loader requires there (e.g. `an array of { match?, tasks } blocks`). */
    expected: string;
    /** What was found instead, rendered for the message (e.g. `object`, `{ pattern, config }`). */
    found: string;
    /** JSON path of the offending value (e.g. `scopedTasks[0]`). */
    location: string;
}

/**
 * Raised when a loaded `vis.config.ts` has a structurally invalid value —
 * the right key name holding the wrong shape.
 *
 * Without this the failure surfaced much later, as a bare
 * `TypeError: Cannot convert undefined or null to object` thrown from a
 * bundled chunk, naming neither the config file nor the key at fault.
 */
export class VisConfigShapeError extends VisConfigError {
    public readonly filePath: string;

    public readonly violations: ReadonlyArray<ShapeViolation>;

    public constructor(filePath: string, chain: ReadonlyArray<string>, violations: ReadonlyArray<ShapeViolation>) {
        const lines: string[] = [`${filePath} has an invalid value.`, ""];

        for (const violation of violations) {
            lines.push(`  • ${violation.location} — expected ${violation.expected}, found ${violation.found}`);
        }

        lines.push("", "See https://visulima.com/docs/packages/vis/configuration for the expected shape.");

        super(lines.join("\n"), chain);
        this.filePath = filePath;
        this.violations = violations;
    }
}
