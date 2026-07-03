import { stripVTControlCharacters } from "node:util";

import type { AiProviderInfo } from "@visulima/find-ai-runner";

import type { SecurityVulnerability } from "../security/advisories";
import type { AiConfig } from "./ai-analysis";
import { extractJson, resolveProvider } from "./ai-analysis";
import { buildHashCacheKey, getCachedJson, getTtlForAnalysisType, setCachedJson } from "./ai-cache";
import { runWithRetry } from "./ai-runner";

/**
 * `vis audit --explain` — enrich vulnerability findings with plain-English
 * AI explanations. Reuses the shared provider/runner/cache scaffolding
 * (find-ai-runner auto-detects an installed AI CLI; no API key or new
 * dependency). Absence of a provider is a graceful no-op, never a failure.
 */

export interface AuditExplainTarget {
    packageName: string;
    packageVersion: string;
    vulnerability: SecurityVulnerability;
}

/** Stable map key shared with the handler's table/JSON/HTML render paths. */
export const explainKey = (target: Pick<AuditExplainTarget, "packageName" | "packageVersion"> & { vulnerability: Pick<SecurityVulnerability, "id"> }): string =>
    `${target.packageName}@${target.packageVersion}:${target.vulnerability.id}`;

const isSelectAll = (raw: boolean | null | string | undefined): boolean =>
    raw === undefined || raw === null || raw === true || raw === "" || raw === "true" || raw.toString().toLowerCase() === "all";

/**
 * Resolve the `--explain` argument into the subset of findings to explain:
 * bare/`all` → every finding; a 1-based number → that finding by position;
 * otherwise an exact (case-insensitive) match on the vulnerability id or
 * one of its aliases (a CVE or GHSA identifier).
 */
export const selectTargets = (targets: AuditExplainTarget[], raw: boolean | null | string | undefined): AuditExplainTarget[] => {
    if (isSelectAll(raw)) {
        return targets;
    }

    const token = String(raw).trim();

    if (/^\d+$/.test(token)) {
        const index = Number.parseInt(token, 10) - 1;
        const picked = targets[index];

        return picked ? [picked] : [];
    }

    const needle = token.toLowerCase();

    return targets.filter((target) => {
        const { aliases, id } = target.vulnerability;

        return id.toLowerCase() === needle || (aliases ?? []).some((alias) => alias.toLowerCase() === needle);
    });
};

export const buildExplainPrompt = (target: AuditExplainTarget): string => {
    const { packageName, packageVersion, vulnerability } = target;
    const aliases = (vulnerability.aliases ?? []).join(", ") || "none";
    const fixed = (vulnerability.fixedVersions ?? []).join(", ") || "no fixed version published";

    return `You are a security engineer. Explain this dependency vulnerability for a developer triaging it.

Package: ${packageName}@${packageVersion}
Advisory: ${vulnerability.id} (aliases: ${aliases})
Severity: ${vulnerability.severity}
Fixed in: ${fixed}
Summary: ${vulnerability.summary}

Respond ONLY with valid JSON in this exact structure, each value 1-3 plain sentences, no markdown:
{
  "whatItIs": "what the vulnerability is and how it is exploited",
  "areYouAtRisk": "what usage pattern makes an app actually exposed; be honest that lockfile presence alone is not exploitation",
  "whatToDo": "the concrete remediation step"
}`;
};

/**
 * The model reply is untrusted text that ends up on a terminal. Strip ANSI/VT
 * escape sequences and the remaining C0 control chars (keeping tab/newline) so
 * a crafted advisory summary can't move the cursor, recolor output, or spoof a
 * prompt when the explanation is rendered.
 */
const sanitize = (text: string): string =>
    stripVTControlCharacters(text)
        // eslint-disable-next-line no-control-regex -- intentional: strips C0/DEL controls from untrusted model output (tab/newline preserved by the gap in the range).
        .replaceAll(/[\u0000-\u0008\u000B-\u001F\u007F]/gu, "")
        .trim();

const formatExplanation = (parts: { areYouAtRisk: string; whatItIs: string; whatToDo: string }): string =>
    `What it is: ${parts.whatItIs}\nAre you at risk: ${parts.areYouAtRisk}\nWhat to do: ${parts.whatToDo}`;

/** Parse the model reply; fall back to trimmed raw text when it is not the expected JSON. */
export const parseExplanation = (text: string): string => {
    const parsed = extractJson(text);

    if (parsed && typeof parsed === "object") {
        const data = parsed as Record<string, unknown>;
        const whatItIs = typeof data.whatItIs === "string" ? sanitize(data.whatItIs) : "";
        const areYouAtRisk = typeof data.areYouAtRisk === "string" ? sanitize(data.areYouAtRisk) : "";
        const whatToDo = typeof data.whatToDo === "string" ? sanitize(data.whatToDo) : "";

        if (whatItIs || areYouAtRisk || whatToDo) {
            return formatExplanation({ areYouAtRisk, whatItIs, whatToDo });
        }
    }

    return sanitize(text);
};

const mapWithConcurrency = async <T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> => {
    let cursor = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor;

            cursor += 1;

            const item = items[index];

            if (item !== undefined) {
                await worker(item);
            }
        }
    });

    await Promise.all(runners);
};

const EXPLAIN_CONCURRENCY = 3;

export interface ExplainLogger {
    info?: (message: string) => void;
    warn?: (message: string) => void;
}

export interface ExplainDeps {
    resolveProvider: (config?: AiConfig) => AiProviderInfo | undefined;
    runWithRetry: (provider: AiProviderInfo, prompt: string) => Promise<string>;
}

const DEFAULT_DEPS: ExplainDeps = { resolveProvider, runWithRetry };

/**
 * Fetch explanations for the given targets, concurrency-capped and cached.
 * Returns a map keyed by {@link explainKey}; missing entries simply mean
 * "no explanation" (no provider, or that finding failed) and are rendered
 * as absent rather than blocking the audit.
 */
export const explainFindings = async (
    targets: AuditExplainTarget[],
    config: AiConfig | undefined,
    logger?: ExplainLogger,
    deps: ExplainDeps = DEFAULT_DEPS,
): Promise<Map<string, string>> => {
    const explanations = new Map<string, string>();

    if (targets.length === 0) {
        return explanations;
    }

    const provider = deps.resolveProvider(config);

    if (!provider) {
        logger?.info?.("No AI CLI provider found on PATH — skipping --explain.");

        return explanations;
    }

    const ttlMs = getTtlForAnalysisType("security", config?.cacheTtl);

    await mapWithConcurrency(targets, EXPLAIN_CONCURRENCY, async (target) => {
        const key = explainKey(target);
        const cacheKey = buildHashCacheKey({
            id: target.vulnerability.id,
            kind: "audit-explain",
            name: target.packageName,
            provider: provider.name,
            version: target.packageVersion,
        });
        const cached = getCachedJson(cacheKey);

        if (typeof cached === "string") {
            explanations.set(key, cached);

            return;
        }

        try {
            const stdout = await deps.runWithRetry(provider, buildExplainPrompt(target));
            const explanation = parseExplanation(stdout);

            if (explanation) {
                explanations.set(key, explanation);
                setCachedJson(cacheKey, explanation, ttlMs);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);

            logger?.warn?.(`Explain failed for ${target.vulnerability.id} (${message}).`);
        }
    });

    return explanations;
};
