/**
 * Input guards for MCP tool arguments. The MCP boundary is the trust boundary
 * for an LLM-driven client — these helpers reject values that would interpret
 * as path traversal, CLI flag injection, or other CLI-level confusables.
 */

// `\w` = [A-Za-z0-9_]; bare `.`/`..` match the regex but are safe in the only
// caller (`get-run-logs.ts`), which appends a literal `.json` suffix and joins
// inside a fixed `.task-runner/runs/` prefix — so `..` resolves to `..json`,
// a normal filename, never a parent-dir traversal.
const RUN_ID_PATTERN = /^[\w.-]+$/;

export const isValidRunId = (value: string): boolean => RUN_ID_PATTERN.test(value);

/**
 * Task IDs are `&lt;project>:&lt;target>`; both halves are package or npm-scope
 * shaped. The exec layer uses argv-form spawn so shell metacharacters are
 * inert, but a leading `-` would be parsed as a CLI flag by the vis CLI.
 */
export const isValidTaskId = (value: string): boolean => value.length > 0 && !value.startsWith("-") && value.includes(":");

/**
 * Guard for free-form positional arguments forwarded to the vis CLI (template
 * names, file paths). Spawn is argv-form so shell metacharacters are inert, but
 * a leading `-` would be parsed as a CLI flag — turning an LLM-supplied
 * `files: ["--fix"]` into a write operation that violates the `readOnlyHint`
 * contract clients rely on for auto-approval. Callers must additionally insert
 * a literal `--` separator before any positionals so a value that *becomes*
 * flag-shaped through some other path can never be reinterpreted as an option.
 */
export const isSafePositional = (value: string): boolean => value.length > 0 && !value.startsWith("-");

/**
 * Guard for free-form values forwarded as the argument of a CLI option (e.g.
 * `--since &lt;ref>`, `--query &lt;expr>`, `--ecosystem &lt;list>`, `--db &lt;path>`). The
 * option name is a fixed literal, but the value itself is LLM-supplied: the
 * `@visulima/command-line-args` tokenizer classifies any `--x`/`-x` token as an
 * option rather than the preceding option's value, so a flag-shaped value like
 * `since: "--fix"` is re-read as a real flag — flipping a `readOnlyHint: true`
 * tool into a write. Reject the leading `-` at the tool boundary before pushing
 * the value onto argv.
 */
export const isSafeOptionValue = (value: string): boolean => !value.startsWith("-");

/**
 * Validate and append user-supplied positional file paths to a `vis` argv. On
 * success the paths are pushed after a literal `--` separator (so they can never
 * be reinterpreted as flags) and `undefined` is returned. When any entry is
 * flag-shaped, the argv is left untouched and a human-readable rejection message
 * is returned for the caller to surface as an `errorResponse`.
 *
 * Shared by the `lint` and `fmt` tools, which both forward an optional `files`
 * list and are annotated `readOnlyHint: true`.
 */
export const appendPositionalFiles = (args: string[], files: string[] | undefined): string | undefined => {
    if (!files || files.length === 0) {
        return undefined;
    }

    const unsafe = files.find((file) => !isSafePositional(file));

    if (unsafe !== undefined) {
        return `Invalid file path "${unsafe}". A leading "-" would be parsed as a CLI flag.`;
    }

    args.push("--", ...files);

    return undefined;
};
