import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Loops configuration.
 */
export interface LoopsConfig extends BaseConfig {
    /**
     * Loops API key (sent as a Bearer token).
     */
    apiKey: string;

    /**
     * Default transactional template id, used when a message doesn't supply its own.
     */
    defaultTransactionalId?: string;

    /**
     * API endpoint override.
     */
    endpoint?: string;
}

/**
 * Loops-specific email options.
 *
 * Loops sends [transactional emails](https://loops.so/docs/api-reference/send-transactional-email) from
 * templates, so the rendered content lives in Loops — `subject`/`html`/`text` are ignored. Provide a
 * `transactionalId` and the `dataVariables` your template expects.
 */
export interface LoopsEmailOptions extends EmailOptions {
    /**
     * Whether to add the recipient to your audience.
     */
    addToAudience?: boolean;

    /**
     * Variables passed to the Loops template.
     */
    dataVariables?: Record<string, unknown>;

    /**
     * The Loops transactional template id.
     */
    transactionalId?: string;
}
