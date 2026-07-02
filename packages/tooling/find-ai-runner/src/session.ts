/**
 * Detection of the AI agent SESSION the current process runs inside — the
 * complement to the binary detection in `index.ts`. Binary detection answers
 * "which AI CLIs are installed on this machine?"; session detection answers
 * "is an AI agent driving THIS process right now?" — the question dev servers,
 * scaffolders, and destructive CLIs ask before switching to machine-readable
 * output, backgrounding themselves, or demanding explicit human consent.
 *
 * Detection is by environment-variable markers the agent harnesses set in the
 * shells they spawn. Markers for invokable providers live on each provider's
 * config (`sessionMarkers` in `providers/*.ts`); agents that are not
 * invokable CLIs (their harness spawns shells but exposes no promptable
 * binary) are listed in {@link EXTRA_AGENT_MARKERS} here. Every entry is
 * sourced from a shipping implementation (the Vercel CLI / Next.js
 * `detect-agent`, Prisma's `ai-safety`, or the harness's own documentation):
 * a false positive silently changes a tool's behavior under a human's
 * fingers. Markers that only prove the PLATFORM (e.g. a Cursor editor
 * terminal, a Replit workspace) — where a human may well be typing — carry
 * `confidence: "ambient"` and are excluded from detection unless explicitly
 * opted into.
 */
import PROVIDERS from "./providers";
import type { AiProviderConfig, AiProviderName, AiSessionConfidence } from "./types";

/** Minimal env shape accepted by {@link detectAiSession} / {@link isAiSession} — `process.env` structurally, injectable for tests. */
type EnvLike = Readonly<Record<string, string | undefined>>;

/** One detected agent session: which agent, how sure, and which env var gave it away. */
interface AiSessionInfo {
    /** Human-readable agent name (e.g. `"Claude Code"`). */
    agent: string;
    /** See {@link AiSessionConfidence}. */
    confidence: AiSessionConfidence;
    /** The matching invokable provider from `providers/`, when the agent is one. */
    provider?: AiProviderName;
    /** The environment variable that matched. */
    variable: string;
}

/** Options for {@link detectAiSession} / {@link isAiSession}. */
interface AiSessionOptions {
    /**
     * Also report `ambient` markers (Cursor editor terminals, Replit
     * workspaces, …). Off by default: ambient environments host humans too,
     * and behavior switches (JSON output, auto-backgrounding) keyed on them
     * surprise those humans. Turn on for telemetry-style consumers where a
     * false positive is harmless.
     */
    includeAmbient?: boolean;
}

/** A fully resolved marker table entry: a provider's `sessionMarkers` entry (or an extra agent's) with display name and provider attached. */
interface AiSessionMarker {
    agent: string;
    confidence: AiSessionConfidence;
    /** Require this exact value (for shared variables like `AGENT`). */
    equals?: string;
    provider?: AiProviderName;
    variable: string;
}

/**
 * Generic marker some harnesses (and the Vercel CLI convention) set with the
 * agent's name as the value — checked first, since it is self-describing.
 */
const AI_AGENT_ENV = "AI_AGENT";

/**
 * Session markers for agents that are NOT invokable providers — their harness
 * spawns shells, but there is no promptable CLI for `providers/` to model.
 * Sources: Vercel CLI / Next.js `detect-agent.ts`, Prisma `ai-safety.ts`.
 */
const EXTRA_AGENT_MARKERS: ReadonlyArray<AiSessionMarker> = [
    { agent: "Cline", confidence: "definite", variable: "CLINE_ACTIVE" },
    { agent: "Aider", confidence: "definite", equals: "Aider", variable: "OR_APP_NAME" },
    { agent: "Antigravity", confidence: "definite", variable: "ANTIGRAVITY_AGENT" },
    { agent: "Augment", confidence: "definite", variable: "AUGMENT_AGENT" },
    { agent: "Replit Agent", confidence: "definite", variable: "REPLIT_CLI" },
    // Ambient: the platform is present, but a human may be the one typing.
    { agent: "Replit workspace", confidence: "ambient", variable: "REPL_ID" },
];

/** Resolve one provider's `sessionMarkers` into full table entries. */
const resolveProviderMarkers = (name: AiProviderName, config: AiProviderConfig): AiSessionMarker[] =>
    config.sessionMarkers.map((marker): AiSessionMarker => {
        return {
            agent: marker.agent ?? config.displayName,
            confidence: marker.confidence,
            equals: marker.equals,
            provider: name,
            variable: marker.variable,
        };
    });

/**
 * The full marker table, assembled from every provider's `sessionMarkers`
 * plus {@link EXTRA_AGENT_MARKERS}, ordered `definite` before `ambient` so a
 * definite signal always shadows an ambient one. First match wins.
 */
const SESSION_MARKERS: ReadonlyArray<AiSessionMarker> = [
    ...(Object.keys(PROVIDERS) as AiProviderName[]).flatMap((name) => resolveProviderMarkers(name, PROVIDERS[name])),
    ...EXTRA_AGENT_MARKERS,
].toSorted((a, b) => {
    if (a.confidence === b.confidence) {
        return 0;
    }

    return a.confidence === "definite" ? -1 : 1;
});

/** True when the env value spells an explicit "off" (`0` / `false`). */
const isDisabledValue = (value: string): boolean => value === "0" || value === "false";

/** The marker's effective value in `env`, or `undefined` when unset/empty/disabled/mismatched. */
const markerValue = (marker: AiSessionMarker, env: EnvLike): string | undefined => {
    const value = env[marker.variable];

    if (value === undefined || value === "" || isDisabledValue(value)) {
        return undefined;
    }

    if (marker.equals !== undefined && value !== marker.equals) {
        return undefined;
    }

    return value;
};

/**
 * Detect the AI agent session the current process runs inside, or `undefined`
 * when none is detected. Pure — pass a custom `env` in tests.
 *
 * The self-describing `AI_AGENT` variable wins over the marker table; ambient
 * markers are only consulted with `includeAmbient: true`.
 */
const detectAiSession = (env: EnvLike = process.env, options: AiSessionOptions = {}): AiSessionInfo | undefined => {
    const generic = env[AI_AGENT_ENV]?.trim();

    if (generic !== undefined && generic !== "" && !isDisabledValue(generic)) {
        return { agent: generic, confidence: "definite", variable: AI_AGENT_ENV };
    }

    for (const marker of SESSION_MARKERS) {
        if (marker.confidence === "ambient" && options.includeAmbient !== true) {
            continue;
        }

        if (markerValue(marker, env) !== undefined) {
            return { agent: marker.agent, confidence: marker.confidence, provider: marker.provider, variable: marker.variable };
        }
    }

    return undefined;
};

/** Convenience predicate over {@link detectAiSession}. */
const isAiSession = (env: EnvLike = process.env, options: AiSessionOptions = {}): boolean => detectAiSession(env, options) !== undefined;

export { AI_AGENT_ENV, detectAiSession, isAiSession, SESSION_MARKERS };
export type { AiSessionInfo, AiSessionMarker, AiSessionOptions, EnvLike };
