import { readFile, writeFile } from "node:fs/promises";

import { isAbsolute, join, relative, resolve } from "@visulima/path";

import type { HashBucketDiff } from "../report/run-summary-utils";
import type { AiConfig } from "./ai-analysis";
import { extractJson, resolveProvider } from "./ai-analysis";
import { buildHashCacheKey, getCachedJson, setCachedJson } from "./ai-cache";
import type { FailureContext } from "./ai-failure-context";
import { runWithRetry } from "./ai-runner";

/**
 * Single source-file edit. Mirrors the shape of the Edit tool used by
 * Claude Code agents — exact-string find-and-replace, scoped to one
 * file. Encoded as a JSON object so cache files and `--format json`
 * output round-trip cleanly.
 */
export interface FixPatch {
    file: string;
    newString: string;
    oldString: string;
    reason?: string;
}

export interface FixProposal {
    /**
     * Set when the AI cannot produce a safe patch (e.g. environmental
     * failure, ambiguous root cause). When present, `patches` must be
     * empty and the CLI should print this message instead of a diff.
     */
    cannotFix?: string;
    confidence: "high" | "low" | "medium";
    explanation: string;
    patches: FixPatch[];
    provider: string;
}

/**
 * Outcome of attempting to apply a single {@link FixPatch}.
 *
 * - `applied`: `oldString` matched exactly once and was replaced.
 * - `no-match`: `oldString` was not present in the file.
 * - `ambiguous-match`: `oldString` matched more than once. The patch
 *   is rejected (we don't guess which occurrence the AI meant).
 * - `missing-file`: the file does not exist on disk.
 * - `outside-workspace`: the resolved file path escapes
 *   `workspaceRoot`. Rejected to prevent the AI from writing outside
 *   the project (e.g. `../../etc/passwd`).
 * - `error`: any other I/O error (read/write).
 *
 * In dry-run mode, a successful `applied` entry includes
 * `previewBefore` / `previewAfter` snippets but does NOT touch disk.
 */
export interface PatchResult {
    absolutePath?: string;
    error?: string;
    patch: FixPatch;
    previewAfter?: string;
    previewBefore?: string;
    status: "ambiguous-match" | "applied" | "error" | "missing-file" | "no-match" | "outside-workspace";
}

const FIX_CACHE_TTL_MS = 60 * 60 * 1000;
const PREVIEW_CONTEXT_CHARS = 80;
const VALID_CONFIDENCE = new Set<FixProposal["confidence"]>(["high", "low", "medium"]);

const buildSystemPrompt = (): string => `You are an expert software engineer helping fix a failing build/test/lint task.

You will be given:
- The terminal output (stdout/stderr) from the failed task.
- Optional metadata: command, working directory, project, task hash, and a diff describing what changed in the task's hash inputs since the previous run that did not fail.

Your job:
1. Identify the root cause from the terminal output.
2. Propose a minimal set of source-file patches that fix the cause.
3. If you cannot determine a safe fix, set "cannotFix" with a clear, actionable explanation.

Constraints:
- Patches MUST be exact string replacements. The "oldString" must appear verbatim in the named file. Paths are relative to the working directory.
- Each "oldString" must be unique within its file. Include surrounding context so the match is unambiguous.
- Do NOT include unrelated cleanup, formatting changes, or speculative refactors.
- If the failure is environmental (missing tool, network) or requires running commands, prefer "cannotFix" over a guess.
- Keep "explanation" short (1-3 sentences). Reserve "reason" on each patch for why that specific edit fixes the cause.

Respond ONLY with valid JSON in this exact structure:
{
  "explanation": "Brief root-cause analysis and what the fix does.",
  "confidence": "low|medium|high",
  "patches": [
    {
      "file": "path/relative/to/cwd.ts",
      "oldString": "exact text to find",
      "newString": "exact replacement text",
      "reason": "why this change fixes it"
    }
  ],
  "cannotFix": "optional — set when no safe patch can be proposed"
}`;

const formatBucket = (label: string, bucket: HashBucketDiff): string | undefined => {
    const lines: string[] = [];

    if (bucket.added.length > 0) {
        lines.push(`  added: ${bucket.added.join(", ")}`);
    }

    if (bucket.changed.length > 0) {
        lines.push(`  changed: ${bucket.changed.join(", ")}`);
    }

    if (bucket.removed.length > 0) {
        lines.push(`  removed: ${bucket.removed.join(", ")}`);
    }

    if (lines.length === 0) {
        return undefined;
    }

    return `- ${label}:\n${lines.join("\n")}`;
};

const buildHashDiffSummary = (failureContext: FailureContext): string => {
    if (!failureContext.hashDiff) {
        return "No hash-diff available — there is no previous run to compare against.";
    }

    const parts: string[] = [];

    if (failureContext.hashDiff.commandChanged) {
        parts.push("- command line changed since previous run");
    }

    const nodes = formatBucket("file inputs", failureContext.hashDiff.nodes);
    const implicit = formatBucket("implicit deps", failureContext.hashDiff.implicitDeps);
    const runtime = formatBucket("runtime/env", failureContext.hashDiff.runtime);

    if (nodes) {
        parts.push(nodes);
    }

    if (implicit) {
        parts.push(implicit);
    }

    if (runtime) {
        parts.push(runtime);
    }

    return parts.length === 0 ? "No detectable changes between this run and the previous run." : parts.join("\n");
};

const buildUserPrompt = (failureContext: FailureContext): string => {
    const lines: string[] = [`Task: ${failureContext.taskId}`];

    if (failureContext.project) {
        lines.push(`Project: ${failureContext.project}`);
    }

    if (failureContext.target) {
        lines.push(`Target: ${failureContext.target}`);
    }

    if (failureContext.command) {
        lines.push(`Command: ${failureContext.command}`);
    }

    if (failureContext.cwd) {
        lines.push(`CWD: ${failureContext.cwd}`);
    }

    if (failureContext.exitCode !== undefined) {
        lines.push(`Exit code: ${String(failureContext.exitCode)}`);
    }

    if (failureContext.hash) {
        lines.push(`Task hash: ${failureContext.hash}`);
    }

    lines.push("", "Hash-diff since previous run:", buildHashDiffSummary(failureContext), "");

    if (failureContext.terminalOutputCaptured) {
        lines.push("Terminal output:", "```", failureContext.terminalOutput, "```");
    } else {
        lines.push(
            "Terminal output: <no failure log was captured for this task>",
            "Set \"cannotFix\" and tell the user to re-run with `vis run` so logs can be captured.",
        );
    }

    return lines.join("\n");
};

const buildFixPrompt = (failureContext: FailureContext): string => `${buildSystemPrompt()}\n\n${buildUserPrompt(failureContext)}`;

const normalizeFixProposal = (raw: Record<string, unknown>, provider: string): FixProposal => {
    const rawPatches = Array.isArray(raw.patches) ? (raw.patches as Record<string, unknown>[]) : [];
    const patches: FixPatch[] = [];

    for (const rawPatch of rawPatches) {
        if (typeof rawPatch.file !== "string" || rawPatch.file.length === 0) {
            continue;
        }

        if (typeof rawPatch.oldString !== "string" || rawPatch.oldString.length === 0) {
            continue;
        }

        if (typeof rawPatch.newString !== "string") {
            continue;
        }

        patches.push({
            file: rawPatch.file,
            newString: rawPatch.newString,
            oldString: rawPatch.oldString,
            reason: typeof rawPatch.reason === "string" && rawPatch.reason.length > 0 ? rawPatch.reason : undefined,
        });
    }

    const cannotFixRaw = typeof raw.cannotFix === "string" && raw.cannotFix.length > 0 ? raw.cannotFix : undefined;

    return {
        cannotFix: cannotFixRaw,
        confidence: VALID_CONFIDENCE.has(raw.confidence as FixProposal["confidence"]) ? (raw.confidence as FixProposal["confidence"]) : "low",
        explanation: typeof raw.explanation === "string" ? raw.explanation : "",
        // Enforce the FixProposal invariant: when `cannotFix` is set,
        // `patches` must be empty. Some AI responses include both
        // (e.g. "I'm not sure but here's a guess") — drop the guess
        // so downstream consumers can rely on the invariant.
        patches: cannotFixRaw ? [] : patches,
        provider,
    };
};

const parseFixResponse = (text: string, provider: string): FixProposal => {
    const parsed = extractJson(text);

    if (!parsed || typeof parsed !== "object") {
        return {
            cannotFix: "AI response was not valid JSON.",
            confidence: "low",
            explanation: "Failed to parse AI response.",
            patches: [],
            provider,
        };
    }

    return normalizeFixProposal(parsed as Record<string, unknown>, provider);
};

const buildFixCacheKey = (provider: string, failureContext: FailureContext): string =>
    buildHashCacheKey({
        cwd: failureContext.cwd ?? null,
        flow: "ai-fix",
        hash: failureContext.hash ?? null,
        provider,
        taskId: failureContext.taskId,
        terminalOutput: failureContext.terminalOutput,
        terminalOutputCaptured: failureContext.terminalOutputCaptured,
    });

export interface RunFixOptions {
    /** Set to false to bypass the on-disk cache (read AND write). */
    cache?: boolean;
    config?: AiConfig;
}

/**
 * Generates a fix proposal for a failed task by feeding the
 * {@link FailureContext} to the configured AI provider.
 *
 * Returns `undefined` only when no provider is available or the
 * provider call itself fails. A response that the AI declined to fix
 * is still returned (with `cannotFix` populated) so the CLI can
 * surface the reason.
 */
export const runFixAnalysis = async (failureContext: FailureContext, logger: Console, options: RunFixOptions = {}): Promise<FixProposal | undefined> => {
    const provider = resolveProvider(options.config);

    if (!provider) {
        logger.warn("No AI provider available — install one of: claude, gemini, copilot, codex.\n");

        return undefined;
    }

    const useCache = options.cache !== false;
    const cacheKey = buildFixCacheKey(provider.name, failureContext);

    if (useCache) {
        const cached = getCachedJson(cacheKey) as FixProposal | undefined;

        if (cached) {
            logger.info(`Using cached fix proposal from ${cached.provider}.\n`);

            return cached;
        }
    }

    logger.info(`Generating fix proposal with ${provider.name}...\n`);

    try {
        const stdout = await runWithRetry(provider, buildFixPrompt(failureContext));
        const proposal = parseFixResponse(stdout, provider.name);

        if (useCache && proposal.patches.length > 0 && !proposal.cannotFix) {
            setCachedJson(cacheKey, proposal, FIX_CACHE_TTL_MS);
        }

        return proposal;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        logger.warn(`AI fix proposal failed (${message}).\n`);

        return undefined;
    }
};

/**
 * Resolves a patch's `file` field to an absolute path. The AI prompt
 * specifies cwd-relative paths, but the model can return absolute or
 * traversing paths anyway, so callers must verify containment via
 * {@link isInsideWorkspace} before reading or writing.
 */
export const resolvePatchPath = (workspaceRoot: string, cwd: string | undefined, file: string): string => {
    if (isAbsolute(file)) {
        return resolve(file);
    }

    const base = cwd ?? workspaceRoot;

    return resolve(join(base, file));
};

/**
 * Returns true when `absolutePath` is `workspaceRoot` itself or sits
 * underneath it. Uses `relative()` rather than string-prefix matching
 * to avoid the `/work/foo` ⊂ `/work/foobar` false-positive.
 */
export const isInsideWorkspace = (workspaceRoot: string, absolutePath: string): boolean => {
    const rel = relative(workspaceRoot, absolutePath);

    if (rel === "") {
        return true;
    }

    return !rel.startsWith("..") && !isAbsolute(rel);
};

const buildPreview = (content: string, oldString: string, newString: string): { previewAfter: string; previewBefore: string } => {
    const index = content.indexOf(oldString);
    const start = Math.max(0, index - PREVIEW_CONTEXT_CHARS);
    const endBefore = Math.min(content.length, index + oldString.length + PREVIEW_CONTEXT_CHARS);

    const before = content.slice(start, endBefore);
    const replaced = `${content.slice(start, index)}${newString}${content.slice(index + oldString.length, endBefore)}`;

    return { previewAfter: replaced, previewBefore: before };
};

export interface ApplyFixOptions {
    /** When true, validate matches and produce previews but don't write. */
    dryRun?: boolean;
}

/**
 * Applies each patch in the proposal to disk (or just validates it
 * when `dryRun` is true). The function never throws — every patch
 * gets a {@link PatchResult} entry so the caller can render a full
 * report (e.g. "2/3 applied, 1 skipped").
 *
 * Patches are applied sequentially per file. If two patches target
 * the same file, the second one is matched against the post-first
 * content. Failed patches do NOT abort the loop; the rest still run.
 */
export const applyFixProposal = async (
    workspaceRoot: string,
    cwd: string | undefined,
    proposal: FixProposal,
    options: ApplyFixOptions = {},
): Promise<PatchResult[]> => {
    const dryRun = options.dryRun === true;
    const fileCache = new Map<string, string>();
    const results: PatchResult[] = [];

    for (const patch of proposal.patches) {
        const absolutePath = resolvePatchPath(workspaceRoot, cwd, patch.file);

        if (!isInsideWorkspace(workspaceRoot, absolutePath)) {
            results.push({ absolutePath, patch, status: "outside-workspace" });

            continue;
        }

        let content = fileCache.get(absolutePath);

        if (content === undefined) {
            try {
                content = await readFile(absolutePath, "utf8");
            } catch (error: unknown) {
                const errorCode = (error as NodeJS.ErrnoException).code;

                results.push({
                    absolutePath,
                    error: errorCode === "ENOENT" ? undefined : (error as Error).message,
                    patch,
                    status: errorCode === "ENOENT" ? "missing-file" : "error",
                });

                continue;
            }

            fileCache.set(absolutePath, content);
        }

        const firstIndex = content.indexOf(patch.oldString);

        if (firstIndex === -1) {
            results.push({ absolutePath, patch, status: "no-match" });

            continue;
        }

        const secondIndex = content.indexOf(patch.oldString, firstIndex + patch.oldString.length);

        if (secondIndex !== -1) {
            results.push({ absolutePath, patch, status: "ambiguous-match" });

            continue;
        }

        const { previewAfter, previewBefore } = buildPreview(content, patch.oldString, patch.newString);
        const updated = `${content.slice(0, firstIndex)}${patch.newString}${content.slice(firstIndex + patch.oldString.length)}`;

        if (!dryRun) {
            try {
                await writeFile(absolutePath, updated, "utf8");
            } catch (error: unknown) {
                // Disk state is now uncertain (writeFile is not atomic
                // on most platforms). Drop the in-memory cache so a
                // later patch on the same file re-reads from disk
                // instead of building on a "post-patch" view that may
                // not exist on disk.
                fileCache.delete(absolutePath);

                results.push({
                    absolutePath,
                    error: (error as Error).message,
                    patch,
                    status: "error",
                });

                continue;
            }
        }

        fileCache.set(absolutePath, updated);

        results.push({ absolutePath, patch, previewAfter, previewBefore, status: "applied" });
    }

    return results;
};

export { buildFixPrompt, normalizeFixProposal, parseFixResponse };
