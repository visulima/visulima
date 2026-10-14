/**
 * Target properties that are read from the target itself, never from its `options` bag.
 * Putting one under `options` parses fine and changes nothing, which is how a flag ends up
 * silently ignored, so the run reports it.
 */
const TARGET_LEVEL_KEYS: ReadonlySet<string> = new Set([
    "cache",
    "command",
    "dependsOn",
    "fingerprintEnv",
    "hashMode",
    "inputs",
    "outputs",
    "parallelism",
    "splitCompound",
    "untrackedEnv",
]);

/**
 * The keys in a target's `options` that belong on the target itself.
 * @param options The target's `options` bag, as written in the config.
 * @returns The misplaced keys, sorted, or an empty array.
 */
export const findMisplacedTargetKeys = (options: object | undefined): string[] => {
    // Config files are untrusted JSON: `options: null` is possible even though the type forbids it.
    if (!options) {
        return [];
    }

    return Object.keys(options)
        .filter((key) => TARGET_LEVEL_KEYS.has(key))
        .toSorted();
};

/**
 * The warning shown for misplaced keys.
 * @param taskId The task the target produces, for context.
 * @param keys The misplaced keys from {@link findMisplacedTargetKeys}.
 * @returns A one-line message naming the keys and where they belong.
 */
export const describeMisplacedTargetKeys = (taskId: string, keys: ReadonlyArray<string>): string =>
    `${taskId}: ${keys.map((key) => `"${key}"`).join(", ")} ${keys.length === 1 ? "is a target property, not an option" : "are target properties, not options"}, so ${keys.length === 1 ? "it is" : "they are"} ignored under "options". Move ${keys.length === 1 ? "it" : "them"} next to "command".`;
