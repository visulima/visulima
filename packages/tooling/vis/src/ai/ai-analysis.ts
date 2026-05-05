import type { AiProviderInfo, AiProviderName } from "@visulima/find-ai-runner";
import { detectAvailableProviders, detectProvider, PROVIDER_NAMES } from "@visulima/find-ai-runner";
import { Box, renderToString, Table, Text } from "@visulima/tui";
import React from "react";

import type { OutdatedEntry } from "../util/catalog";
import { buildCacheKey, getCachedAnalysis, getTtlForAnalysisType, setCachedAnalysis } from "./ai-cache";
import { runWithRetry } from "./ai-runner";
import type { AiAnalysisResult, AiRecommendation, AnalysisType } from "./types";

// --- Provider selection (vis-specific) ---

interface AiHealConfig {
    /**
     * Usernames allowed to trigger `vis ai heal accept`. Empty list (the
     * default) disables auto-commit entirely. Comparison is case-sensitive
     * against the comment author's login (GitHub) or username (GitLab).
     */
    allowedActors?: string[];
}

interface AiConfig {
    /** Cache TTL in milliseconds. Overrides default (1h / 30min for security). */
    cacheTtl?: number;
    /** `vis ai heal` and `vis ai heal accept` configuration. */
    heal?: AiHealConfig;
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
    if (config?.provider) {
        if (!PROVIDER_NAMES.includes(config.provider as AiProviderName)) {
            return undefined;
        }

        const provider = detectProvider(config.provider as AiProviderName);

        return provider.available ? provider : undefined;
    }

    const available = detectAvailableProviders();

    if (available.length === 0) {
        return undefined;
    }

    const priority = { ...DEFAULT_PRIORITY, ...config?.priority };

    return available.toSorted((a, b) => (priority[b.name] ?? 0) - (priority[a.name] ?? 0))[0];
};

// --- Types ---

// --- Constants ---

const VALID_ACTIONS = new Set(["defer", "review", "skip", "update"]);
const VALID_RISK_LEVELS = new Set(["critical", "high", "low", "medium"]);
const VALID_EFFORTS = new Set(["high", "low", "medium"]);
const CHUNK_THRESHOLD = 50;
const CHUNK_SIZE = 30;

// --- Prompts per analysis type ---

const buildPackageList = (outdated: OutdatedEntry[]): string =>
    outdated
        .map((entry) => {
            const vulnInfo
                = entry.vulnerabilities && entry.vulnerabilities.length > 0
                    ? ` [VULNERABILITIES: ${entry.vulnerabilities.map((v) => `${v.severity} ${v.id}`).join(", ")}]`
                    : "";

            let socketInfo = "";

            if (entry.socketReport) {
                const score = Math.round(entry.socketReport.score.overall * 100);
                const parts = [`score:${String(score)}%`];

                if (entry.socketReport.alerts.length > 0) {
                    const alertsByLevel: Record<string, number> = {};

                    for (const a of entry.socketReport.alerts) {
                        alertsByLevel[a.severity] = (alertsByLevel[a.severity] ?? 0) + 1;
                    }

                    const alertSummary = Object.entries(alertsByLevel)
                        .map(([s, c]) => `${String(c)} ${s}`)
                        .join(", ");

                    parts.push(`alerts: ${alertSummary}`);
                }

                parts.push(`supply-chain:${String(Math.round(entry.socketReport.score.supplyChain * 100))}%`);
                parts.push(`quality:${String(Math.round(entry.socketReport.score.quality * 100))}%`);
                socketInfo = ` [SOCKET.DEV: ${parts.join(", ")}]`;
            }

            return `- ${entry.packageName}: ${entry.currentRange} → ${entry.newRange} (${entry.updateType})${vulnInfo}${socketInfo}`;
        })
        .join("\n");

const JSON_RESPONSE_SCHEMA = `Respond ONLY with valid JSON in this exact structure:
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

const PROMPTS: Record<AnalysisType, (packageList: string) => string> = {
    compatibility: (packageList) => `Analyze the compatibility of these package updates:

${packageList}

For each package:
1. Check peer dependency compatibility
2. Identify potential conflicts with other packages in the list
3. Assess API compatibility between current and target versions
4. Check for deprecated features being removed
5. Evaluate Node.js version requirements

${JSON_RESPONSE_SCHEMA}`,

    impact: (packageList) => `Analyze the impact of updating these npm packages:

${packageList}

For each package, provide:
1. Risk level (low/medium/high/critical)
2. Recommended action (update/skip/review/defer)
3. Reason for recommendation
4. Known breaking changes (if any)
5. Estimated migration effort (low/medium/high)

${JSON_RESPONSE_SCHEMA}`,

    recommend: (packageList) => `Provide smart recommendations for updating these packages:

${packageList}

Consider:
1. Update priority based on security, features, and stability
2. Grouping related packages for atomic updates
3. Best practices for the specific package ecosystem
4. Risk vs. benefit analysis
5. Suggested update order
6. If Socket.dev scores are provided, prioritize packages with low supply chain or quality scores

${JSON_RESPONSE_SCHEMA}`,

    security: (packageList) => `Analyze the security implications of these package updates:

${packageList}

For each package:
1. Check if the update fixes known vulnerabilities (use the vulnerability data above)
2. Assess if the new version introduces security risks
3. Evaluate if this is a security-sensitive package (auth, crypto, session, etc.)
4. Recommend urgency of the update based on vulnerability severity
5. Flag any packages where skipping the update poses security risk
6. If Socket.dev scores are provided, factor in supply chain and quality scores — low scores indicate higher risk

${JSON_RESPONSE_SCHEMA}`,
};

const VALID_ANALYSIS_TYPES = new Set<string>(["compatibility", "impact", "recommend", "security"]);

const validateAnalysisType = (type: string): AnalysisType => {
    if (VALID_ANALYSIS_TYPES.has(type)) {
        return type as AnalysisType;
    }

    return "impact";
};

const buildAnalysisPrompt = (outdated: OutdatedEntry[], analysisType: AnalysisType = "impact"): string => {
    const packageList = buildPackageList(outdated);

    return PROMPTS[analysisType](packageList);
};

// --- Response parsing ---

const JSON_BLOCK_REGEX = /```(?:json)?\s*([\s\S]*?)```/;

const JSON_OBJECT_REGEX = /\{[\s\S]*\}/;

const extractJson = (text: string): unknown => {
    try {
        return JSON.parse(text) as unknown;
    } catch {
        // continue
    }

    const blockMatch = JSON_BLOCK_REGEX.exec(text);

    if (blockMatch?.[1]) {
        try {
            return JSON.parse(blockMatch[1]) as unknown;
        } catch {
            // continue
        }
    }

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

const parseAiResponse = (text: string, provider: string, analysisType: AnalysisType): AiAnalysisResult => {
    const parsed = extractJson(text);

    if (!parsed || typeof parsed !== "object") {
        return { analysisType, provider, recommendations: [], summary: "Failed to parse AI response.", warnings: ["AI response was not valid JSON."] };
    }

    const data = parsed as Record<string, unknown>;
    const rawRecs = Array.isArray(data.recommendations) ? (data.recommendations as Record<string, unknown>[]) : [];

    return {
        analysisType,
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

const ruleBasedAnalysis = (outdated: OutdatedEntry[], analysisType: AnalysisType): AiAnalysisResult => {
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
            riskLevel = "high";
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
        analysisType,
        provider: "rule-engine",
        recommendations,
        summary: `Rule-based ${analysisType} analysis for ${String(outdated.length)} packages.`,
        warnings: ["No AI provider available — using built-in rule engine."],
    };
};

// --- Chunking ---

const analyzeChunk = async (provider: AiProviderInfo, chunk: OutdatedEntry[], analysisType: AnalysisType): Promise<AiAnalysisResult> => {
    const prompt = buildAnalysisPrompt(chunk, analysisType);
    const stdout = await runWithRetry(provider, prompt);

    return parseAiResponse(stdout, provider.name, analysisType);
};

const mergeResults = (results: AiAnalysisResult[], provider: string, analysisType: AnalysisType): AiAnalysisResult => {
    const recommendations: AiRecommendation[] = [];
    const warnings: string[] = [];
    const summaries: string[] = [];

    for (const result of results) {
        recommendations.push(...result.recommendations);
        warnings.push(...result.warnings);

        if (result.summary) {
            summaries.push(result.summary);
        }
    }

    return {
        analysisType,
        provider,
        recommendations,
        summary: summaries.length === 1 ? (summaries[0] ?? "") : `Analyzed ${String(recommendations.length)} packages in ${String(results.length)} batches.`,
        warnings: [...new Set(warnings)],
    };
};

// --- Output formatting ---

const ANALYSIS_TYPE_LABELS: Record<AnalysisType, string> = {
    compatibility: "Compatibility",
    impact: "Impact",
    recommend: "Recommendations",
    security: "Security",
};

const formatAiAnalysis = (result: AiAnalysisResult): string => {
    const typeLabel = ANALYSIS_TYPE_LABELS[result.analysisType] ?? result.analysisType;
    const header = `${typeLabel} Analysis (${result.provider})`;

    const tableData = result.recommendations.flatMap((rec) => {
        const rows: { action: string; effort: string; package: string; reason: string; risk: string }[] = [
            { action: rec.action, effort: rec.effort, package: rec.package, reason: rec.reason, risk: rec.riskLevel },
        ];

        if (rec.breakingChanges.length > 0) {
            rows.push({ action: "", effort: "", package: "", reason: `Breaking: ${rec.breakingChanges.join("; ")}`, risk: "" });
        }

        return rows;
    });

    const columns = process.stdout.columns || 80;

    return renderToString(
        React.createElement(
            Box,
            { borderStyle: "round", flexDirection: "column", paddingLeft: 1, paddingRight: 1 },
            React.createElement(Text, { bold: true }, header),
            React.createElement(Text, null, ""),
            React.createElement(Text, null, result.summary),
            React.createElement(Text, null, ""),
            React.createElement(Table, { borderStyle: "none", data: tableData }),
            ...(result.warnings.length > 0
                ? [
                    React.createElement(Text, null, ""),
                    ...result.warnings.map((warning, i) => React.createElement(Text, { dimColor: true, key: String(i) }, `  ${warning}`)),
                ]
                : []),
        ),
        { columns },
    );
};

const formatAiAnalysisJson = (result: AiAnalysisResult): string => JSON.stringify(result, undefined, 2);

// --- Public API ---

const runAiAnalysis = async (
    outdated: OutdatedEntry[],
    logger: Console,
    config?: AiConfig,
    analysisType: AnalysisType = "impact",
): Promise<AiAnalysisResult> => {
    const provider = resolveProvider(config);

    if (!provider) {
        logger.info("No AI CLI tool found, using rule-based analysis.\n");

        return ruleBasedAnalysis(outdated, analysisType);
    }

    // Check cache before calling AI
    const cacheKey = buildCacheKey(provider.name, analysisType, outdated);
    const cached = getCachedAnalysis(cacheKey);

    if (cached) {
        logger.info(`Using cached ${analysisType} analysis from ${cached.provider}.\n`);

        return cached;
    }

    const typeLabel = ANALYSIS_TYPE_LABELS[analysisType] ?? analysisType;

    logger.info(`Running ${typeLabel.toLowerCase()} analysis with ${provider.name}...\n`);

    try {
        let result: AiAnalysisResult;

        if (outdated.length > CHUNK_THRESHOLD) {
            logger.info(`Splitting ${String(outdated.length)} packages into batches of ${String(CHUNK_SIZE)}...\n`);

            const chunks: OutdatedEntry[][] = [];

            for (let index = 0; index < outdated.length; index += CHUNK_SIZE) {
                chunks.push(outdated.slice(index, index + CHUNK_SIZE));
            }

            const results: AiAnalysisResult[] = [];

            for (let index = 0; index < chunks.length; index += 1) {
                logger.info(`  Batch ${String(index + 1)}/${String(chunks.length)}...`);

                const chunk = chunks[index];

                if (chunk) {
                    results.push(await analyzeChunk(provider, chunk, analysisType));
                }
            }

            result = mergeResults(results, provider.name, analysisType);
        } else {
            const stdout = await runWithRetry(provider, buildAnalysisPrompt(outdated, analysisType));

            result = parseAiResponse(stdout, provider.name, analysisType);
        }

        setCachedAnalysis(cacheKey, result, getTtlForAnalysisType(analysisType, config?.cacheTtl));

        return result;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        logger.warn(`AI analysis failed (${message}), falling back to rule engine.\n`);

        return ruleBasedAnalysis(outdated, analysisType);
    }
};

export type { AiConfig, AiHealConfig };

export {
    buildAnalysisPrompt,
    DEFAULT_PRIORITY,
    extractJson,
    formatAiAnalysis,
    formatAiAnalysisJson,
    normalizeRecommendation,
    parseAiResponse,
    resolveProvider,
    ruleBasedAnalysis,
    runAiAnalysis,
    validateAnalysisType,
};

export { type AiAnalysisResult, type AiRecommendation, type AnalysisType } from "./types";
