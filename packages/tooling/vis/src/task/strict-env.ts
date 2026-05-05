/**
 * Strict env mode — scan a command string (and any string env values
 * it may interpolate from) for `${VAR}` and `$VAR` references and
 * report which ones resolve to neither the task's effective env nor
 * `process.env`. The default mode silently lets the shell substitute
 * an empty string, which masks misconfigured deploys; strict mode
 * surfaces those references at task-spawn time so the failure names
 * the variable instead of producing weird downstream behavior.
 *
 * Limitations of v1 (intentional — keeps the surface small):
 * - Only POSIX-style shells (`$VAR`, `${VAR}`, `${VAR:-default}`).
 *   Windows `%VAR%` references are ignored — strict env there is a
 *   shell-level concern outside vis's scope.
 * - References inside single quotes are *included*, because vis
 *   doesn't know the target shell's quoting rules at hash time and
 *   single-quoted bash literals shouldn't usually carry `$VAR` anyway.
 *   Targets that legitimately do can opt out via `options.strictEnv: false`.
 * - References with a default (`${VAR:-fallback}`) are *not* a miss
 *   even when `VAR` is unset — the shell would expand the default.
 */

const PLACEHOLDER_REGEX = /\$(\{([A-Z_]\w*)(:-[^}]*)?\}|([A-Z_]\w*))/gi;

const POSIX_SPECIALS = new Set(["0", "!", "#", "$", "*", "-", "?", "@", "_"]);

/**
 * Extracts every distinct `${VAR}` / `$VAR` reference from a command
 * string. Special POSIX shell variables (`$@`, `$*`, `$#`, `$$`,
 * digits, `$_`) are skipped — they're not user-controlled env vars.
 */
export const extractEnvReferences = (command: string): { hasDefault: boolean; name: string }[] => {
    const found = new Map<string, boolean>();

    for (const match of command.matchAll(PLACEHOLDER_REGEX)) {
        const braced = match[2];
        const bareName = match[4];
        const defaultClause = match[3];
        const name = braced ?? bareName;

        if (name === undefined) {
            continue;
        }

        if (POSIX_SPECIALS.has(name)) {
            continue;
        }

        const hasDefault = defaultClause !== undefined;
        const previous = found.get(name);

        // If we've seen the same var with AND without a default,
        // require it to be set — the unconditional reference will
        // expand to "" when missing.
        if (previous === undefined) {
            found.set(name, hasDefault);
        } else if (previous && !hasDefault) {
            found.set(name, false);
        }
    }

    return [...found.entries()].map(([name, hasDefault]) => {
        return { hasDefault, name };
    });
};

export interface StrictEnvViolation {
    /** Names of env vars referenced by the command that are unset. */
    missing: string[];
    /** The task id that failed validation. */
    taskId: string;
}

export interface StrictEnvCheckOptions {
    /** The shell command that will be spawned. */
    command: string;
    /** Process env — fallback when the task env doesn't define a name. */
    processEnv: Record<string, string | undefined>;
    /** Effective env for the task — envFile + service env + per-task env. */
    taskEnv: Record<string, string | undefined>;
    /** The task id (for error reporting). */
    taskId: string;
}

/**
 * Returns a {@link StrictEnvViolation} if the command references any
 * env vars that are unset in both `taskEnv` and `processEnv`. Returns
 * `undefined` when every reference resolves cleanly.
 *
 * A var defined as the empty string is treated as set. The shell would
 * substitute "" anyway, but the user explicitly chose that — strict
 * env's job is to catch *unintended* empties, not policed values.
 */
export const checkStrictEnv = (options: StrictEnvCheckOptions): StrictEnvViolation | undefined => {
    const { command, processEnv, taskEnv, taskId } = options;

    const references = extractEnvReferences(command);

    if (references.length === 0) {
        return undefined;
    }

    const missing: string[] = [];

    for (const { hasDefault, name } of references) {
        if (hasDefault) {
            continue;
        }

        const fromTask = taskEnv[name];
        const fromProcess = processEnv[name];

        if (fromTask === undefined && fromProcess === undefined) {
            missing.push(name);
        }
    }

    if (missing.length === 0) {
        return undefined;
    }

    return { missing: missing.toSorted(), taskId };
};

/**
 * Renders a violation as a single-line, action-oriented error message
 * suitable for both task output (`terminalOutput`) and structured
 * logs. The format is stable for testing.
 */
export const formatStrictEnvError = (violation: StrictEnvViolation): string => {
    const list = violation.missing.map((name) => `$${name}`).join(", ");

    return (
        `Strict env: ${violation.taskId} references unset variable${violation.missing.length === 1 ? "" : "s"} ${list}. `
        + `Set ${violation.missing.length === 1 ? "it" : "them"} in the task env, an envFile, or the parent shell — or opt out with options.strictEnv: false.`
    );
};
