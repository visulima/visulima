import type { ShapeViolation } from "../errors";
import { VisConfigShapeError } from "../errors";

/**
 * Renders a value for an error message: its type, plus the key names when
 * it's a plain object so `{ pattern, config }` points straight at the typo
 * instead of just saying "object".
 */
const describe = (value: unknown): string => {
    if (value === null) {
        return "null";
    }

    if (Array.isArray(value)) {
        return "an array";
    }

    if (typeof value === "object") {
        const keys = Object.keys(value);

        return keys.length > 0 ? `an object with { ${keys.join(", ")} }` : "an empty object";
    }

    return typeof value;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Validate the structurally-strict corners of a raw config.
 *
 * Most config keys are records whose wrong shapes degrade harmlessly —
 * an unknown key is ignored, a wrong scalar is coerced at the use site.
 * `scopedTasks` is different: it is iterated with `for…of` and its inner
 * `tasks` is fed straight to `Object.entries`, so a wrong shape crashed
 * the CLI with an unattributed `TypeError` from a bundled chunk long
 * after load, naming neither the file nor the key.
 *
 * Only shapes that would otherwise throw are checked here — this is not a
 * general schema pass. `schemas/vis-config.schema.json` remains the full
 * contract for editors.
 */
const detectShapeViolations = (raw: Record<string, unknown>): ShapeViolation[] => {
    const violations: ShapeViolation[] = [];

    if (!Object.hasOwn(raw, "scopedTasks") || raw.scopedTasks === undefined) {
        return violations;
    }

    const { scopedTasks } = raw;

    if (!Array.isArray(scopedTasks)) {
        violations.push({
            expected: "an array of `{ match?, tasks }` blocks",
            found: describe(scopedTasks),
            location: "scopedTasks",
        });

        return violations;
    }

    for (const [index, block] of scopedTasks.entries()) {
        const location = `scopedTasks[${index}]`;

        if (!isPlainObject(block)) {
            violations.push({ expected: "a `{ match?, tasks }` block", found: describe(block), location });

            continue;
        }

        if (!isPlainObject(block.tasks)) {
            violations.push({
                expected: "`tasks` to be an object keyed by target name",
                found: block.tasks === undefined ? `a block with { ${Object.keys(block).join(", ")} }` : describe(block.tasks),
                location: `${location}.tasks`,
            });
        }

        if (block.match !== undefined && !isPlainObject(block.match)) {
            violations.push({
                expected: "`match` to be an object of project constraints",
                found: describe(block.match),
                location: `${location}.match`,
            });
        }
    }

    return violations;
};

/**
 * Throw a {@link VisConfigShapeError} if the raw config holds a value the
 * loader cannot work with. No-op on a well-formed config.
 */
export const assertValidConfigShape = (filePath: string, chain: ReadonlyArray<string>, raw: unknown): void => {
    if (!raw || typeof raw !== "object") {
        return;
    }

    const violations = detectShapeViolations(raw as Record<string, unknown>);

    if (violations.length > 0) {
        throw new VisConfigShapeError(filePath, chain, violations);
    }
};
