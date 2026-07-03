import type { ValidationStatus } from "../types";

/**
 * Runtime context every transport validator receives. Allows transports to
 * read the captured secret, any paired `depends_on_rule` variables, and (for
 * types whose YAML carries extra fields like `Grpc`) the full `validation:`
 * block.
 */
export interface TransportContext {
    /** Variables injected from `depends_on_rule` (e.g. AWS needs both TOKEN + AKID). */
    extras: Record<string, string>;
    /** The captured secret — usually a connection string, JSON payload, or opaque token. */
    secret: string;
    /** Raw `validation:` block for transports whose YAML carries extra fields (Grpc). */
    validation: Record<string, unknown>;
}

export type TransportValidator = (context: TransportContext) => Promise<ValidationStatus>;

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
    /** Short explanation of what verification against this provider means. */
    summary: string;
    /** Inline validator. Missing when `implemented === false`. */
    validate?: TransportValidator;
}
