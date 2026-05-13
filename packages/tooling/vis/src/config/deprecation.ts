import type { DeprecatedKey } from "../errors";
import { VisConfigDeprecatedKeyError } from "../errors";

/**
 * Scan a raw `vis.config.ts` export for keys that have been removed in
 * the current major. Returns the list of offenders (with rename targets)
 * or an empty array when the config is clean. Callers throw a
 * {@link VisConfigDeprecatedKeyError} when the array is non-empty.
 *
 * Detection is shallow-but-targeted: we only look at the documented
 * config keys, not every property in user space. This keeps the check
 * cheap and avoids false positives from user-defined fields.
 */
const detectDeprecatedConfigKeys = (raw: Record<string, unknown>): DeprecatedKey[] => {
    const found: DeprecatedKey[] = [];

    if (Object.hasOwn(raw, "targetDefaults")) {
        found.push({ name: "targetDefaults", renamedTo: "tasks" });
    }

    if (Object.hasOwn(raw, "taskRunnerOptions")) {
        found.push({ name: "taskRunnerOptions", renamedTo: "taskRunner" });
    }

    if (Object.hasOwn(raw, "taskDefaults")) {
        const { taskDefaults } = raw;
        const children: DeprecatedKey[] = [];

        if (Array.isArray(taskDefaults)) {
            for (const [index, block] of taskDefaults.entries()) {
                if (block && typeof block === "object") {
                    if (Object.hasOwn(block as object, "scope")) {
                        children.push({
                            location: `taskDefaults[${index}].scope`,
                            name: "scope",
                            renamedTo: "match",
                        });
                    }

                    if (Object.hasOwn(block as object, "targets")) {
                        children.push({
                            location: `taskDefaults[${index}].targets`,
                            name: "targets",
                            renamedTo: "tasks",
                        });
                    }
                }
            }
        }

        found.push({
            children: children.length > 0 ? children : undefined,
            name: "taskDefaults",
            renamedTo: "scopedTasks",
        });
    } else if (Array.isArray(raw.scopedTasks)) {
        // User already adopted `scopedTasks` but may still use old inner keys.
        for (const [index, block] of raw.scopedTasks.entries()) {
            if (block && typeof block === "object") {
                if (Object.hasOwn(block as object, "scope")) {
                    found.push({
                        location: `scopedTasks[${index}].scope`,
                        name: "scope",
                        renamedTo: "match",
                    });
                }

                if (Object.hasOwn(block as object, "targets")) {
                    found.push({
                        location: `scopedTasks[${index}].targets`,
                        name: "targets",
                        renamedTo: "tasks",
                    });
                }
            }
        }
    }

    return found;
};

/**
 * Scan a raw `vis.task.ts` overlay for removed keys. Only one rename
 * applies here: the inner `targets` field became `tasks` for
 * consistency with the workspace config.
 */
const detectDeprecatedTaskKeys = (raw: Record<string, unknown>): DeprecatedKey[] => {
    if (Object.hasOwn(raw, "targets") && !Object.hasOwn(raw, "tasks")) {
        return [{ name: "targets", renamedTo: "tasks" }];
    }

    return [];
};

/**
 * Throw a {@link VisConfigDeprecatedKeyError} if the raw config uses
 * removed field names. No-op on a clean config.
 */
export const assertNoDeprecatedConfigKeys = (filePath: string, chain: ReadonlyArray<string>, raw: unknown): void => {
    if (!raw || typeof raw !== "object") {
        return;
    }

    const found = detectDeprecatedConfigKeys(raw as Record<string, unknown>);

    if (found.length > 0) {
        throw new VisConfigDeprecatedKeyError(filePath, chain, found);
    }
};

/**
 * Throw a {@link VisConfigDeprecatedKeyError} if a `vis.task.ts` overlay
 * uses the removed `targets` key. No-op on a clean overlay.
 */
export const assertNoDeprecatedTaskKeys = (filePath: string, chain: ReadonlyArray<string>, raw: unknown): void => {
    if (!raw || typeof raw !== "object") {
        return;
    }

    const found = detectDeprecatedTaskKeys(raw as Record<string, unknown>);

    if (found.length > 0) {
        throw new VisConfigDeprecatedKeyError(filePath, chain, found);
    }
};
