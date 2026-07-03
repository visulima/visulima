/**
 * Type definitions for the `vis generate` template runtime.
 *
 * The shape intentionally echoes Bingo's `Template` so a future Bingo
 * adapter (re-exporting `bingo` Templates through this runtime) is a
 * one-pager. Authors do not depend on Bingo to write a vis generator.
 */

export type VariableType = "array" | "boolean" | "enum" | "number" | "string";

/** Common variable fields (all types). */
interface VariableBase {
    /**
     * Default value when the user accepts the prompt without typing.
     * For `boolean` this is `true|false`; for `enum` it must match `values`.
     */
    default?: boolean | number | string | string[];

    /** Hide from prompts; can still be set via CLI or `--defaults`. */
    internal?: boolean;

    /** Sort order in prompts (lower first). Defaults to declaration order. */
    order?: number;

    /** Override the prompt text. Defaults to the variable name. */
    prompt?: string;

    /** When true, the user must provide a non-empty value. */
    required?: boolean;
}

export type StringVariable = VariableBase & { type: "string" };
export type NumberVariable = VariableBase & { type: "number" };
export type BooleanVariable = VariableBase & { default?: boolean; type: "boolean" };
export type ArrayVariable = VariableBase & { type: "array" };
export interface EnumVariable extends VariableBase {
    /** Allow multiple selections (returns `string[]`). */
    multiple?: boolean;
    type: "enum";
    /** Selectable values. */
    values: string[];
}

export type Variable = ArrayVariable | BooleanVariable | EnumVariable | NumberVariable | StringVariable;

/** Map of variable name → spec, as authors declare them. */
export type VariableMap = Record<string, Variable>;

/** Resolved option values passed to `produce()`. */
export type Options = Record<string, unknown>;

/** A file in a Creation can be a string, a Buffer (binary asset), or a nested directory. */
export type CreationFile = Buffer | string;
export interface CreationDirectory {
    [key: string]: CreationDirectory | CreationFile;
}

/**
 * Script entry produced by `produce()`.
 * - `string`: shell command, runs in the destination directory.
 * - `object`: shell commands with optional phase ordering.
 */
export type Script = ScriptObject | string;

export interface ScriptObject {
    /** Shell command(s) to run sequentially. */
    commands: string[];

    /**
     * Phase ordering. Phases run in ascending order; scripts within
     * the same phase are dispatched concurrently. Default: 0.
     */
    phase?: number;
    /** Suppress command output. Default: false. */
    silent?: boolean;
}

/** Object returned by a template's `produce()` function. */
export interface Creation {
    /** Recursive directory tree. Keys with `/` are auto-split. */
    files?: CreationDirectory;

    /**
     * Per-file metadata keyed by the *flattened* destination path
     * (e.g. `src/foo.ts`). Optional — native templates usually omit
     * this; the moon adapter populates it from per-file frontmatter
     * so `force: true` survives the trip to the runner without
     * changing the shape of `files`.
     */
    filesMeta?: Record<string, FileMeta>;
    /** Shell scripts to run after files are written. */
    scripts?: Script[];
    /** User-facing tips printed after the run. */
    suggestions?: string[];
}

export interface FileMeta {
    /**
     * Overwrite an existing file at this path without prompting or
     * consulting the global `--force` flag.
     */
    force?: boolean;
}

/** Context object passed to `produce()`. */
export interface TemplateContext {
    /** Built-in variables: `dest_dir`, `dest_rel_dir`, `working_dir`, `workspace_root`. */
    builtins: BuiltinVars;
    /** Resolved option values (after prompts + CLI overrides + defaults). */
    options: Options;
}

export interface BuiltinVars {
    /** Absolute destination directory. */
    dest_dir: string;
    /** Destination relative to the workspace root. */
    dest_rel_dir: string;
    /** Caller's current working directory. */
    working_dir: string;
    /** Absolute workspace root (from `findMonorepoRootSync`, fallback to `working_dir`). */
    workspace_root: string;
}

/** Top-level "About" metadata for a template. */
export interface TemplateAbout {
    /** One-line description. */
    description: string;
    /** Short identifier shown in `vis generate --list` and prompts. */
    name: string;
}

/**
 * The author-facing template shape.
 * Both native (`.vis/templates/&lt;name>.ts`) and moon-adapter outputs
 * normalize to this.
 */
export interface Template {
    about: TemplateAbout;

    /**
     * Default destination directory (relative to workspace root unless
     * absolute or starting with `./`). Honored when the user does not
     * pass `--to`. Maps to moon's `template.yml` `destination`.
     */
    destination?: string;
    /** Variable schema for prompts. */
    options?: VariableMap;
    /** Build the Creation given resolved options and built-in vars. */
    produce: (context: TemplateContext) => Creation | Promise<Creation>;
}

/**
 * Discovery record: a Template plus where it came from.
 * Surfaced by `vis generate --list`.
 */
export interface DiscoveredTemplate {
    /** Lazy loader — invoke to materialize the Template. */
    load: () => Promise<Template>;
    /** Stable name used by `vis generate &lt;name>`. */
    name: string;
    /** Absolute path on disk (file for native, directory for moon). */
    path: string;
    /** Source classification — affects load + listing. */
    source: "builtin" | "config" | "moon" | "native" | "remote";
}
