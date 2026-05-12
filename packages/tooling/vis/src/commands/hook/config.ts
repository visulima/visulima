import { writeFileSync } from "node:fs";

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { DEFAULT_HOOKS_DIRECTORY } from "./constants";

/**
 * Sidecar configuration consumed by `vis hook run --stage &lt;stage>`.
 *
 * Lives at `&lt;hooksDirectory>/config.json` (default `.vis-hooks/config.json`)
 * and is the single source of truth for what each git hook actually
 * does. The generated `&lt;stage>` shell scripts are intentionally thin —
 * they only `exec` vis with the stage name and forward `$@`, which lets
 * us swap implementations (e.g. native dispatch, parallel execution)
 * without rewriting user-tracked files.
 *
 * Security note: `entry` strings are executed via `sh -c` so users can
 * pin shell pipelines / env-var expansion. Migrated values come from
 * the user's own `.pre-commit-config.yaml`, so we treat the config as
 * trusted input. Do not load a `config.json` from an untrusted source.
 */
export interface HookEntry {
    /** Run only when other hooks would be skipped (empty file list). */
    alwaysRun?: boolean;
    /** Extra args passed after `entry`/`builtin`; user-supplied. */
    args?: ReadonlyArray<string>;

    /**
     * Name of a vis-bundled builtin (see `builtins/`). Mutually exclusive
     * with `entry` and `fail`; exactly one of the three must be set.
     */
    builtin?: string;
    /** User-supplied shell command (the first token is the executable). */
    entry?: string;
    /** Regex (JS flavor) of paths to drop after `files`. */
    exclude?: string;
    /** Tag list — every tag must be absent (pre-commit `exclude_types`). */
    excludeTypes?: ReadonlyArray<string>;

    /**
     * `language: fail` equivalent — print this message and exit non-zero.
     * Used for "don't use this tool" guard hooks.
     */
    fail?: string;
    /** Regex (JS flavor) of paths to keep. */
    files?: string;
    /** Stable identifier used in logs (pre-commit `id`). */
    id: string;
    /** Human-readable name for log output (pre-commit `name`). */
    name?: string;
    /** Append filtered file paths to argv. Defaults to true. */
    passFilenames?: boolean;
    /** Tag list — every tag must be present (pre-commit `types`). */
    types?: ReadonlyArray<string>;
    /** Tag list — at least one tag must be present (pre-commit `types_or`). */
    typesOr?: ReadonlyArray<string>;
    /** Echo the command to stderr before running it (shell `set -x`). */
    verbose?: boolean;
}

export interface HookConfig {
    /** Stop on first hook failure. Mirrors prek `fail_fast`. */
    failFast?: boolean;
    /** stage name → ordered hook list. */
    stages: Record<string, HookEntry[]>;
    /** Schema version; bump for breaking changes. */
    version: 1;
}

export const HOOK_CONFIG_FILENAME = "config.json";

export const HOOK_CONFIG_VERSION = 1 as const;

const ENTRY_KEYS = new Set<string>([
    "alwaysRun",
    "args",
    "builtin",
    "entry",
    "exclude",
    "excludeTypes",
    "fail",
    "files",
    "id",
    "name",
    "passFilenames",
    "types",
    "typesOr",
    "verbose",
]);

const CONFIG_KEYS = new Set<string>(["failFast", "stages", "version"]);

const FILTER_KEYS = ["args", "exclude", "excludeTypes", "files", "passFilenames", "types", "typesOr"] as const;

const configPath = (root: string, hooksDirectory: string): string => join(root, hooksDirectory, HOOK_CONFIG_FILENAME);

const isStringRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

const asStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) {
        return undefined;
    }

    const out: string[] = [];

    for (const item of value) {
        if (typeof item !== "string") {
            return undefined;
        }

        out.push(item);
    }

    return out;
};

const asBoolean = (value: unknown): boolean | undefined => (typeof value === "boolean" ? value : undefined);

const asNonEmptyString = (value: unknown): string | undefined => (typeof value === "string" && value.length > 0 ? value : undefined);

export interface ParseWarning {
    /** Hook id if the warning relates to an entry, undefined for top-level. */
    hookId?: string;
    message: string;
    /** Stage the warning belongs to, undefined for top-level config. */
    stage?: string;
}

const parseEntry = (raw: unknown, warnings: ParseWarning[], stage: string): HookEntry => {
    if (!isStringRecord(raw)) {
        throw new TypeError("hook entry must be an object");
    }

    if (typeof raw["id"] !== "string" || raw["id"].length === 0) {
        throw new TypeError("hook entry is missing `id`");
    }

    const entry: HookEntry = { id: raw["id"] };

    const alwaysRun = asBoolean(raw["alwaysRun"]);

    if (alwaysRun !== undefined) {
        entry.alwaysRun = alwaysRun;
    }

    const args = asStringArray(raw["args"]);

    if (args) {
        entry.args = args;
    }

    const builtin = asNonEmptyString(raw["builtin"]);

    if (builtin) {
        entry.builtin = builtin;
    }

    const entryCmd = asNonEmptyString(raw["entry"]);

    if (entryCmd) {
        entry.entry = entryCmd;
    }

    const exclude = asNonEmptyString(raw["exclude"]);

    if (exclude) {
        entry.exclude = exclude;
    }

    const excludeTypes = asStringArray(raw["excludeTypes"]);

    if (excludeTypes) {
        entry.excludeTypes = excludeTypes;
    }

    const fail = asNonEmptyString(raw["fail"]);

    if (fail) {
        entry.fail = fail;
    }

    const files = asNonEmptyString(raw["files"]);

    if (files) {
        entry.files = files;
    }

    const name = asNonEmptyString(raw["name"]);

    if (name) {
        entry.name = name;
    }

    const passFilenames = asBoolean(raw["passFilenames"]);

    if (passFilenames !== undefined) {
        entry.passFilenames = passFilenames;
    }

    const types = asStringArray(raw["types"]);

    if (types) {
        entry.types = types;
    }

    const typesOr = asStringArray(raw["typesOr"]);

    if (typesOr) {
        entry.typesOr = typesOr;
    }

    const verbose = asBoolean(raw["verbose"]);

    if (verbose !== undefined) {
        entry.verbose = verbose;
    }

    const dispatchTargets = [entry.builtin, entry.entry, entry.fail].filter((v) => v !== undefined).length;

    if (dispatchTargets !== 1) {
        throw new TypeError(`hook "${entry.id}" must set exactly one of \`builtin\`, \`entry\`, \`fail\``);
    }

    if (entry.fail !== undefined) {
        const offending = FILTER_KEYS.filter((key) => entry[key] !== undefined);

        if (offending.length > 0) {
            throw new TypeError(`hook "${entry.id}" is a \`fail\` entry — remove ${offending.join(", ")} (filters do not apply)`);
        }
    }

    for (const key of Object.keys(raw)) {
        if (!ENTRY_KEYS.has(key)) {
            warnings.push({ hookId: entry.id, message: `unknown field "${key}" ignored`, stage });
        }
    }

    return entry;
};

const parseConfig = (raw: unknown, warnings: ParseWarning[]): HookConfig => {
    if (!isStringRecord(raw)) {
        throw new TypeError("hook config must be an object");
    }

    if (raw["version"] !== HOOK_CONFIG_VERSION) {
        throw new TypeError(`unsupported hook config version: expected ${HOOK_CONFIG_VERSION}, got ${String(raw["version"])}`);
    }

    if (!isStringRecord(raw["stages"])) {
        throw new TypeError("hook config is missing `stages` map");
    }

    const stages: Record<string, HookEntry[]> = {};

    for (const [stage, list] of Object.entries(raw["stages"])) {
        if (!Array.isArray(list)) {
            throw new TypeError(`hook config: stage "${stage}" must be an array`);
        }

        stages[stage] = list.map((item) => parseEntry(item, warnings, stage));
    }

    const config: HookConfig = {
        stages,
        version: HOOK_CONFIG_VERSION,
    };

    const failFast = asBoolean(raw["failFast"]);

    if (failFast !== undefined) {
        config.failFast = failFast;
    }

    for (const key of Object.keys(raw)) {
        if (!CONFIG_KEYS.has(key)) {
            warnings.push({ message: `unknown top-level field "${key}" ignored` });
        }
    }

    return config;
};

/**
 * Load `.vis-hooks/config.json` from disk. Returns `undefined` when the
 * file is absent so callers can short-circuit (no hooks configured),
 * and throws on malformed JSON / schema violations so users notice
 * typos instead of getting a silent no-op at commit time.
 *
 * `warnings` (optional) receives non-fatal issues (unknown fields,
 * stylistic problems). Callers may surface them to the user.
 */
export const loadHookConfig = (root: string, hooksDirectory: string = DEFAULT_HOOKS_DIRECTORY, warnings?: ParseWarning[]): HookConfig | undefined => {
    const path = configPath(root, hooksDirectory);

    if (!isAccessibleSync(path)) {
        return undefined;
    }

    const content: string = readFileSync(path);
    let parsed: unknown;

    try {
        parsed = JSON.parse(content);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        throw new TypeError(`failed to parse ${path}: ${message}`, { cause: error });
    }

    return parseConfig(parsed, warnings ?? []);
};

/**
 * Write `.vis-hooks/config.json` atomically-ish (via writeFileSync;
 * single fsync). Pretty-prints with 4-space indent to match the
 * project's JSON convention.
 */
export const writeHookConfig = (root: string, hooksDirectory: string, config: HookConfig): void => {
    const path = configPath(root, hooksDirectory);

    writeFileSync(path, `${JSON.stringify(config, undefined, 4)}\n`, "utf8");
};
