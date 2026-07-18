import type { ValidationStatus } from "../types";

/**
 * Runtime context every transport validator receives. Allows transports to
 * read the captured secret, any paired `depends_on_rule` variables, and (for
 * types whose YAML carries extra fields like `Grpc`) the full `validation:`
 * block.
 */
export interface TransportContext {
    /**
     * Host allowlist for outbound transport connections. When set, a transport
     * whose resolved target host (from the captured URI or its fixed provider
     * endpoint) is not in this set is skipped without connecting — the same
     * untrusted-config exfiltration defence the HTTP validator applies. Hosts
     * are compared case-insensitively against `URL.host` (`host` or `host:port`).
     */
    allowedHosts?: ReadonlySet<string>;
    /** Variables injected from `depends_on_rule` (e.g. AWS needs both TOKEN + AKID). */
    extras: Record<string, string>;
    /** The captured secret — usually a connection string, JSON payload, or opaque token. */
    secret: string;
    /** Abort signal — honoured before dialling and forwarded to drivers that support it. */
    signal?: AbortSignal;
    /** Raw `validation:` block for transports whose YAML carries extra fields (Grpc). */
    validation: Record<string, unknown>;
}

export type TransportValidator = (context: TransportContext) => Promise<ValidationStatus>;

/**
 * Resolve the outbound host(s) a transport would contact for a given context,
 * so the allowlist gate can decide before any connection is opened. Returns
 * `undefined` when no host can be derived (unparseable URI) — treated as
 * fail-closed when an allowlist is active. Absent on offline transports (JWT).
 */
export type TransportHostResolver = (context: TransportContext) => string[] | undefined;

export interface ValidatorTransport {
    /** Human-readable provider name used in warnings and `--list-validators`. */
    displayName: string;
    /** `true` when we ship an inline implementation; the user just needs the peer dep installed. */
    implemented: boolean;

    /**
     * The peer dependency required to run this validator. Omitted when the
     * transport needs bespoke logic rather than an off-the-shelf driver (`Raw`
     * custom protocols; `Jdbc` reuses MongoDB/MySQL/Postgres; `Coinbase` has
     * no upstream spec yet).
     */
    packageName?: string;
    /**
     * Resolve the host(s) this transport would dial for the allowlist gate.
     * Present only on transports that open network connections; offline
     * transports (JWT) omit it and are never gated.
     */
    resolveHosts?: TransportHostResolver;
    /** Short explanation of what verification against this provider means. */
    summary: string;
    /** Inline validator. Missing when `implemented === false`. */
    validate?: TransportValidator;
}
