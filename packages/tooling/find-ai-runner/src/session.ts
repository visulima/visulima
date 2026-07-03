/**
 * Detection of the AI agent SESSION the current process runs inside — the
 * complement to the binary detection in `index.ts`. Binary detection answers
 * "which AI CLIs are installed on this machine?"; session detection answers
 * "is an AI agent driving THIS process right now?" — the question dev servers,
 * scaffolders, and destructive CLIs ask before switching to machine-readable
 * output, backgrounding themselves, or demanding explicit human consent.
 *
 * Detection is primarily by environment-variable markers the agent harnesses
 * set in the shells they spawn. A marker is either a single variable or a
 * composite `all`/`any`/`none` condition (the latter distinguishes an agent
 * run from a human typing in the same editor — e.g. Zed with `PAGER=cat` vs
 * without). Markers for invokable providers live on each provider's config
 * (`sessionMarkers` in `providers/*.ts`); agents that are not invokable CLIs
 * (their harness spawns shells but exposes no promptable binary) are listed in
 * {@link EXTRA_AGENT_MARKERS} here. Agents that mark their shells with NO env
 * variable at all (Octofriend, Devin, Factory Droid) are detectable only by
 * walking the process ancestry — an opt-in, slower path ({@link PROCESS_AGENTS}
 * + `checkProcesses`).
 *
 * Every entry is sourced from a shipping implementation (Vercel CLI / Next.js
 * `detect-agent`, Prisma's `ai-safety`, `am-i-vibing`, or the harness's own
 * docs): a false positive silently changes a tool's behavior under a human's
 * fingers. Markers that only prove the PLATFORM (a Cursor editor terminal, a
 * Replit workspace) — where a human may well be typing — carry
 * `confidence: "ambient"` (type `interactive`) and are excluded from detection
 * unless explicitly opted into.
 */
import { getProcessAncestry } from "./process-tree";
import PROVIDERS from "./providers";
import type { AiProviderConfig, AiProviderName, AiSessionConfidence, AiSessionMarkerConfig, AiSessionType, EnvCondition } from "./types";

/** Minimal env shape accepted by {@link detectAiSession} / {@link isAiSession} — `process.env` structurally, injectable for tests. */
type EnvLike = Readonly<Record<string, string | undefined>>;

/** One detected agent session: which agent, how sure, and what gave it away. */
interface AiSessionInfo {
    /** Human-readable agent name (e.g. `"Claude Code"`). */
    agent: string;
    /** See {@link AiSessionConfidence}. */
    confidence: AiSessionConfidence;
    /** The matching invokable provider from `providers/`, when the agent is one. */
    provider?: AiProviderName;

    /**
     * What gave the agent away: an environment variable name (`"CLAUDECODE"`),
     * a composite marker's label (`"TERM_PROGRAM+PAGER"`), or a process-ancestry
     * match (`"process:octofriend"`). Not necessarily a bare variable name.
     */
    signal: string;
    /** See {@link AiSessionType}. */
    type: AiSessionType;
}

/** Options for {@link detectAiSession} / {@link isAiSession} and their async variants. */
interface AiSessionOptions {
    /**
     * Explicit process ancestry (nearest command name first) for
     * {@link detectAiSessionAsync}. When provided, the ancestry is NOT spawned —
     * used for testing and for callers that already have the process tree.
     */
    ancestry?: ReadonlyArray<string>;

    /**
     * Also walk the process ancestry to detect agents that set no env marker
     * (Octofriend, Devin, Factory Droid). Only honored by the async variants.
     * Off by default: reading the process tree spawns a subprocess and is
     * meaningfully slow, especially on Windows.
     */
    checkProcesses?: boolean;

    /**
     * Also report `ambient`/`interactive` markers (Cursor editor terminals,
     * Replit workspaces, …). Off by default: ambient environments host humans
     * too, and behavior switches (JSON output, auto-backgrounding) keyed on
     * them surprise those humans. Turn on for telemetry-style consumers where a
     * false positive is harmless.
     */
    includeAmbient?: boolean;
}

/** A fully resolved marker table entry: a config marker with display name, provider, type, and a normalized condition attached. */
interface AiSessionMarker {
    agent: string;
    confidence: AiSessionConfidence;
    /** Reporting label surfaced as the matched `variable`. */
    label: string;
    /** Normalized env condition to evaluate. */
    match: EnvCondition;
    provider?: AiProviderName;
    type: AiSessionType;
}

/** An agent detectable only via process ancestry (it sets no env marker on the shells it spawns). */
interface ProcessAgent {
    agent: string;
    /** Lowercased process name to look for in the ancestry. */
    process: string;
    provider?: AiProviderName;
}

/**
 * Generic marker some harnesses (and the Vercel CLI convention) set with the
 * agent's name as the value — checked first, since it is self-describing.
 */
const AI_AGENT_ENV = "AI_AGENT";

/**
 * Session markers for agents that are NOT invokable providers — their harness
 * spawns shells, but there is no promptable CLI for `providers/` to model.
 * Sources: Vercel CLI / Next.js `detect-agent.ts`, Prisma `ai-safety.ts`, `am-i-vibing`.
 */
const EXTRA_AGENT_MARKERS: ReadonlyArray<AiSessionMarkerConfig & { agent: string; provider?: AiProviderName }> = [
    { agent: "Cline", confidence: "definite", variable: "CLINE_ACTIVE" },
    { agent: "Aider", confidence: "definite", label: "OR_APP_NAME|AIDER_API_KEY", match: { any: [["OR_APP_NAME", "Aider"], "AIDER_API_KEY"] } },
    { agent: "Antigravity", confidence: "definite", label: "ANTIGRAVITY_AGENT", match: { any: ["ANTIGRAVITY_AGENT", "ANTIGRAVITY_PROJECT_ID"] } },
    // Augment Code's Auggie CLI sets AUGMENT_AGENT (=1) on every shell tool execution.
    { agent: "Augment", confidence: "definite", variable: "AUGMENT_AGENT" },
    { agent: "Windsurf", confidence: "definite", variable: "CODEIUM_EDITOR_APP_ROOT" },
    { agent: "Warp", confidence: "definite", variable: "OZ_RUN_ID" },
    { agent: "Pi", confidence: "definite", equals: "true", variable: "PI_CODING_AGENT" },
    {
        agent: "Jules",
        confidence: "definite",
        label: "HOME+USER",
        match: {
            all: [
                ["HOME", "/home/jules"],
                ["USER", "swebot"],
            ],
        },
    },
    { agent: "Replit Agent", confidence: "definite", variable: "REPLIT_CLI" },
    { agent: "Replit Assistant", confidence: "definite", label: "REPL_ID+REPLIT_MODE", match: { all: ["REPL_ID", ["REPLIT_MODE", "assistant"]] } },
    // eslint-disable-next-line no-secrets/no-secrets -- the label is a human-readable var list, not a secret
    { agent: "Bolt.new", confidence: "definite", label: "SHELL+npm_config_yes", match: { all: [["SHELL", "/bin/jsh"], "npm_config_yes"] } },
    {
        agent: "Zed",
        confidence: "definite",
        label: "TERM_PROGRAM+PAGER",
        match: {
            all: [
                ["TERM_PROGRAM", "zed"],
                ["PAGER", "cat"],
            ],
        },
    },
    // Ambient (type: interactive): the platform is present, but a human may be the one typing.
    { agent: "Replit workspace", confidence: "ambient", label: "REPL_ID", match: { all: ["REPL_ID"], none: [["REPLIT_MODE", "assistant"]] } },
    { agent: "Bolt.new editor", confidence: "ambient", label: "SHELL", match: { all: [["SHELL", "/bin/jsh"]], none: ["npm_config_yes"] } },
    { agent: "Zed editor", confidence: "ambient", label: "TERM_PROGRAM", match: { all: [["TERM_PROGRAM", "zed"]], none: [["PAGER", "cat"]] } },
];

/**
 * Agents detectable only by walking the process ancestry — their harness marks
 * spawned shells with no env variable, so `checkProcesses` is the only signal.
 */
const PROCESS_AGENTS: ReadonlyArray<ProcessAgent> = [
    { agent: "Octofriend", process: "octofriend" },
    { agent: "Devin", process: "devin" },
    { agent: "Factory Droid", process: "droid", provider: "droid" },
];

/** Default session type per confidence when a marker doesn't declare one explicitly. */
const CONFIDENCE_TYPE: Record<AiSessionConfidence, AiSessionType> = { ambient: "interactive", definite: "agent" };

/** Narrows to a meaningful env value: set, non-empty, and not an explicit `0`/`false`. */
const isTruthy = (value: string | undefined): value is string => value !== undefined && value !== "" && value !== "0" && value !== "false";

/** Evaluate an env condition against the given environment. */
const matchCondition = (condition: EnvCondition, env: EnvLike): boolean => {
    if (typeof condition === "string") {
        return isTruthy(env[condition]);
    }

    if (Array.isArray(condition)) {
        return env[condition[0]] === condition[1];
    }

    if (condition.all && !condition.all.every((entry) => matchCondition(entry, env))) {
        return false;
    }

    if (condition.any && !condition.any.some((entry) => matchCondition(entry, env))) {
        return false;
    }

    if (condition.none?.some((entry) => matchCondition(entry, env))) {
        return false;
    }

    // An object with no clauses matches nothing (avoids a vacuously-true false positive).
    return Boolean(condition.all ?? condition.any ?? condition.none);
};

/** Normalize a config marker (simple `variable`/`equals` or composite `match`+`label`) into a resolved marker. */
const resolveMarker = (config: AiSessionMarkerConfig, agent: string, provider?: AiProviderName): AiSessionMarker => {
    const base = { agent: config.agent ?? agent, confidence: config.confidence, provider, type: config.type ?? CONFIDENCE_TYPE[config.confidence] };

    if ("match" in config) {
        return { ...base, label: config.label, match: config.match };
    }

    return { ...base, label: config.variable, match: config.equals === undefined ? config.variable : [config.variable, config.equals] };
};

/** Resolve one provider's `sessionMarkers` into full table entries. */
const resolveProviderMarkers = (name: AiProviderName, config: AiProviderConfig): AiSessionMarker[] =>
    config.sessionMarkers.map((marker) => resolveMarker(marker, config.displayName, name));

/**
 * The full marker table, assembled from every provider's `sessionMarkers`
 * plus {@link EXTRA_AGENT_MARKERS}, ordered `definite` before `ambient` so a
 * definite signal always shadows an ambient one. First match wins.
 */
const SESSION_MARKERS: ReadonlyArray<AiSessionMarker> = [
    ...(Object.keys(PROVIDERS) as AiProviderName[]).flatMap((name) => resolveProviderMarkers(name, PROVIDERS[name])),
    ...EXTRA_AGENT_MARKERS.map((marker) => resolveMarker(marker, marker.agent, marker.provider)),
].toSorted((a, b) => {
    if (a.confidence === b.confidence) {
        return 0;
    }

    return a.confidence === "definite" ? -1 : 1;
});

/**
 * Detect the AI agent session the current process runs inside from environment
 * markers alone, or `undefined` when none is detected. Pure and synchronous —
 * pass a custom `env` in tests.
 *
 * The self-describing `AI_AGENT` variable wins over the marker table; ambient
 * markers are only consulted with `includeAmbient: true`. Process-ancestry-only
 * agents are NOT checked here — use {@link detectAiSessionAsync} with
 * `checkProcesses: true` for those.
 */
const detectAiSession = (env: EnvLike = process.env, options: AiSessionOptions = {}): AiSessionInfo | undefined => {
    const generic = env[AI_AGENT_ENV]?.trim();

    if (isTruthy(generic)) {
        return { agent: generic, confidence: "definite", signal: AI_AGENT_ENV, type: "agent" };
    }

    for (const marker of SESSION_MARKERS) {
        if (marker.confidence === "ambient" && options.includeAmbient !== true) {
            continue;
        }

        if (matchCondition(marker.match, env)) {
            return { agent: marker.agent, confidence: marker.confidence, provider: marker.provider, signal: marker.label, type: marker.type };
        }
    }

    return undefined;
};

/** Match the process ancestry (nearest command name first) against {@link PROCESS_AGENTS}. Pure. */
const detectAiSessionByProcess = (ancestry: ReadonlyArray<string>): AiSessionInfo | undefined => {
    for (const name of ancestry) {
        const agent = PROCESS_AGENTS.find((candidate) => candidate.process === name);

        if (agent) {
            return { agent: agent.agent, confidence: "definite", provider: agent.provider, signal: `process:${agent.process}`, type: "agent" };
        }
    }

    return undefined;
};

/**
 * Async superset of {@link detectAiSession}. Checks env markers first; when
 * `checkProcesses` is set and no env marker matched, walks the process ancestry
 * to catch agents that set no env variable (Octofriend, Devin, Factory Droid).
 * Pass `options.ancestry` to supply the process tree yourself (and skip the
 * subprocess spawn), e.g. in tests.
 */
const detectAiSessionAsync = async (env: EnvLike = process.env, options: AiSessionOptions = {}): Promise<AiSessionInfo | undefined> => {
    const envHit = detectAiSession(env, options);

    if (envHit || options.checkProcesses !== true) {
        return envHit;
    }

    if (options.ancestry !== undefined) {
        return detectAiSessionByProcess(options.ancestry);
    }

    const ancestry = await getProcessAncestry();

    return detectAiSessionByProcess(ancestry);
};

/** Convenience predicate over {@link detectAiSession}. */
const isAiSession = (env: EnvLike = process.env, options: AiSessionOptions = {}): boolean => detectAiSession(env, options) !== undefined;

/** Convenience predicate over {@link detectAiSessionAsync}. */
const isAiSessionAsync = async (env: EnvLike = process.env, options: AiSessionOptions = {}): Promise<boolean> => {
    const session = await detectAiSessionAsync(env, options);

    return session !== undefined;
};

export { AI_AGENT_ENV, detectAiSession, detectAiSessionAsync, detectAiSessionByProcess, isAiSession, isAiSessionAsync, PROCESS_AGENTS, SESSION_MARKERS };
export type { AiSessionInfo, AiSessionMarker, AiSessionOptions, EnvLike, ProcessAgent };
