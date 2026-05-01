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
