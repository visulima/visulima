import { boxen } from "@visulima/boxen";
import type { AiProviderInfo, AiProviderName } from "@visulima/find-ai-runner";
import { detectAvailableProviders, detectProvider, PROVIDER_NAMES, runProvider } from "@visulima/find-ai-runner";
import { createTable } from "@visulima/tabular";

import type { OutdatedEntry } from "./catalog";

// --- Provider selection (vis-specific) ---

interface AiConfig {
    /** Override default provider priority. Higher = preferred. */
    priority?: Record<string, number>;
    /** Use a specific provider, skip auto-detection. */
    provider?: string;
}

const DEFAULT_PRIORITY: Record<string, number> = {
    amp: 30,
    claude: 80,
    codex: 60,
    copilot: 50,
    crush: 35,
    cursor: 40,
    droid: 20,
    gemini: 100,
    kimi: 25,
    opencode: 35,
    qwen: 30,
};

/** Resolve which AI provider to use based on config and availability. */
const resolveProvider = (config?: AiConfig): AiProviderInfo | undefined => {
    // If a specific provider is requested, detect only that one
    if (config?.provider) {
        if (!PROVIDER_NAMES.includes(config.provider as AiProviderName)) {
            return undefined;
        }

        const provider = detectProvider(config.provider as AiProviderName);

        return provider.available ? provider : undefined;
    }

    // Otherwise, pick the highest-priority available provider
    const available = detectAvailableProviders();

    if (available.length === 0) {
        return undefined;
    }

    const priority = { ...DEFAULT_PRIORITY, ...config?.priority };

    return available.toSorted((a, b) => (priority[b.name] ?? 0) - (priority[a.name] ?? 0))[0];
};

// --- Types ---

interface AiRecommendation {
    action: "defer" | "review" | "skip" | "update";
    breakingChanges: string[];
    effort: "high" | "low" | "medium";
    package: string;
    reason: string;
    riskLevel: "critical" | "high" | "low" | "medium";
}

interface AiAnalysisResult {
    provider: string;
    recommendations: AiRecommendation[];
    summary: string;
    warnings: string[];
}

// --- Prompt ---

const VALID_ACTIONS = new Set(["defer", "review", "skip", "update"]);
const VALID_RISK_LEVELS = new Set(["critical", "high", "low", "medium"]);
const VALID_EFFORTS = new Set(["high", "low", "medium"]);

const buildAnalysisPrompt = (outdated: OutdatedEntry[]): string => {
    const packageList = outdated
        .map((entry) => {
            const vulnInfo
                = entry.vulnerabilities && entry.vulnerabilities.length > 0
                    ? ` [VULNERABILITIES: ${entry.vulnerabilities.map((v) => `${v.severity} ${v.id}`).join(", ")}]`
                    : "";

            return `- ${entry.packageName}: ${entry.currentRange} → ${entry.newRange} (${entry.updateType})${vulnInfo}`;
        })
        .join("\n");

    return `Analyze the impact of updating these npm packages:

${packageList}

For each package, provide:
1. Risk level (low/medium/high/critical)
2. Recommended action (update/skip/review/defer)
3. Reason for recommendation
4. Known breaking changes (if any)
5. Estimated migration effort (low/medium/high)

Respond ONLY with valid JSON in this exact structure:
{
  "summary": "Brief overall summary",
  "recommendations": [
    {
      "package": "package-name",
      "action": "update|skip|review|defer",
      "reason": "explanation",
      "riskLevel": "low|medium|high|critical",
      "breakingChanges": ["change1"],
      "effort": "low|medium|high"
    }
  ],
  "warnings": ["warning1"]
}`;
};

// --- Response parsing ---

// eslint-disable-next-line sonarjs/slow-regex, regexp/no-super-linear-backtracking -- bounded by AI response size
const JSON_BLOCK_REGEX = /```(?:json)?\s*([\s\S]*?)```/;
// eslint-disable-next-line sonarjs/slow-regex -- bounded by AI response size
const JSON_OBJECT_REGEX = /\{[\s\S]*\}/;

const extractJson = (text: string): unknown | undefined => {
    // Strategy 1: direct parse
    try {
        return JSON.parse(text) as unknown;
    } catch {
        // continue
    }

    // Strategy 2: markdown code block
    const blockMatch = JSON_BLOCK_REGEX.exec(text);

    if (blockMatch?.[1]) {
        try {
            return JSON.parse(blockMatch[1]) as unknown;
        } catch {
            // continue
        }
    }

    // Strategy 3: find first { ... } block
    const objectMatch = JSON_OBJECT_REGEX.exec(text);

    if (objectMatch?.[0]) {
        try {
            return JSON.parse(objectMatch[0]) as unknown;
        } catch {
            // continue
        }
    }

    return undefined;
};

const normalizeRecommendation = (raw: Record<string, unknown>): AiRecommendation => {
    return {
        action: VALID_ACTIONS.has(raw.action as string) ? (raw.action as AiRecommendation["action"]) : "review",
        breakingChanges: Array.isArray(raw.breakingChanges) ? (raw.breakingChanges as string[]) : [],
        effort: VALID_EFFORTS.has(raw.effort as string) ? (raw.effort as AiRecommendation["effort"]) : "medium",
        package: typeof raw.package === "string" ? raw.package : "",
        reason: typeof raw.reason === "string" ? raw.reason : "",
        riskLevel: VALID_RISK_LEVELS.has(raw.riskLevel as string) ? (raw.riskLevel as AiRecommendation["riskLevel"]) : "medium",
    };
};

const parseAiResponse = (text: string, provider: string): AiAnalysisResult => {
    const parsed = extractJson(text);

    if (!parsed || typeof parsed !== "object") {
        return { provider, recommendations: [], summary: "Failed to parse AI response.", warnings: ["AI response was not valid JSON."] };
    }

    const data = parsed as Record<string, unknown>;
    const rawRecs = Array.isArray(data.recommendations) ? (data.recommendations as Record<string, unknown>[]) : [];

    return {
        provider,
        recommendations: rawRecs.map((rec) => normalizeRecommendation(rec)),
        summary: typeof data.summary === "string" ? data.summary : "",
        warnings: Array.isArray(data.warnings) ? (data.warnings as string[]) : [],
    };
};

// --- Rule-based fallback ---

const KNOWN_BREAKING: Record<string, string[]> = {
    eslint: ["ESLint 9.0: Flat config required", "ESLint 8.0+: New rule formats"],
    next: ["Next.js 13+: App router changes", "Next.js 14+: Server components default"],
    react: ["React 17 to 18: Concurrent features", "React 18+: Strict mode changes"],
    typescript: ["TypeScript 5.0: New decorators", "TypeScript 4.7+: ESM changes"],
    vite: ["Vite 5: Node.js 18+ required"],
    vue: ["Vue 3: Composition API", "Vue 3: Breaking template changes"],
    webpack: ["Webpack 5: Node.js polyfills removed"],
};

const SECURITY_SENSITIVE = new Set(["bcrypt", "cors", "crypto-js", "express-session", "helmet", "jose", "jsonwebtoken", "node-forge", "oauth", "passport"]);

const ruleBasedAnalysis = (outdated: OutdatedEntry[]): AiAnalysisResult => {
    const recommendations: AiRecommendation[] = outdated.map((entry) => {
        const hasVulnerabilities = entry.vulnerabilities && entry.vulnerabilities.length > 0;
        const isSecuritySensitive = SECURITY_SENSITIVE.has(entry.packageName);
        const breakingChanges = KNOWN_BREAKING[entry.packageName] ?? [];

        let riskLevel: AiRecommendation["riskLevel"] = "low";
        let action: AiRecommendation["action"] = "update";
        let effort: AiRecommendation["effort"] = "low";
        let reason = "Patch/minor update, safe to apply.";

        if (entry.updateType === "major") {
            riskLevel = "high";
            action = breakingChanges.length > 0 ? "review" : "update";
            effort = "medium";
            reason
                = breakingChanges.length > 0
                    ? `Major update with known breaking changes: ${breakingChanges[0]}`
                    : "Major version update, review changelog before applying.";
        } else if (entry.updateType === "minor") {
            riskLevel = "medium";
            reason = "Minor update, generally safe.";
        }

        if (hasVulnerabilities) {
            action = "update";
            reason = "Security update — current version has known vulnerabilities.";
        }

        if (isSecuritySensitive && entry.updateType === "major") {
            action = "review";
            reason = "Security-sensitive package with major update, careful review needed.";
            effort = "high";
        }

        return { action, breakingChanges, effort, package: entry.packageName, reason, riskLevel };
    });

    return {
        provider: "rule-engine",
        recommendations,
        summary: `Rule-based analysis for ${String(outdated.length)} packages.`,
        warnings: ["No AI provider available — using built-in rule engine."],
    };
};

// --- Output formatting ---

const formatAiAnalysis = (result: AiAnalysisResult): string => {
    const table = createTable();

    table.setHeaders(["Package", "Risk", "Action", "Effort", "Reason"]);

    for (const rec of result.recommendations) {
        table.addRow([rec.package, rec.riskLevel, rec.action, rec.effort, rec.reason]);

        if (rec.breakingChanges.length > 0) {
            table.addRow(["", { colSpan: 4, content: `Breaking: ${rec.breakingChanges.join("; ")}` }]);
        }
    }

    const header = `AI Analysis (${result.provider})`;
    const parts = [table.toString()];

    if (result.warnings.length > 0) {
        parts.push(result.warnings.map((warning) => `  ${warning}`).join("\n"));
    }

    return boxen(`${result.summary}\n\n${parts.join("\n")}`, { headerText: header, padding: { left: 1, right: 1 } });
};

// --- Public API ---

const runAiAnalysis = async (outdated: OutdatedEntry[], logger: Console, config?: AiConfig): Promise<AiAnalysisResult> => {
    const provider = resolveProvider(config);

    if (!provider) {
        logger.info("No AI CLI tool found, using rule-based analysis.\n");

        return ruleBasedAnalysis(outdated);
    }

    logger.info(`Running AI analysis with ${provider.name}...\n`);

    const prompt = buildAnalysisPrompt(outdated);

    try {
        const result = await runProvider(provider, prompt, { timeoutMs: 120_000 });

        return parseAiResponse(result.stdout, provider.name);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        logger.warn(`AI analysis failed (${message}), falling back to rule engine.\n`);

        return ruleBasedAnalysis(outdated);
    }
};

export type { AiAnalysisResult, AiConfig, AiRecommendation };

export { buildAnalysisPrompt, extractJson, formatAiAnalysis, normalizeRecommendation, parseAiResponse, ruleBasedAnalysis, runAiAnalysis };
