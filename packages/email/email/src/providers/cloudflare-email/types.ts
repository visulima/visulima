import type { DkimOptions } from "../../crypto/types";
import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Cloudflare Email Workers configuration.
 *
 * Cloudflare's send binding lives in the Workers runtime, so you wire it up yourself and pass a thin
 * `send` function — keeping this provider runtime-agnostic and testable.
 */
export interface CloudflareEmailConfig extends BaseConfig {
    /**
     * DKIM signing, applied to the serialized MIME message just before it is handed to
     * {@link CloudflareEmailConfig.send}.
     *
     * Canonicalization defaults to `relaxed/relaxed` here rather than the `simple/simple` of
     * {@link DkimOptions}, since relaying hops re-wrap whitespace. `privateKey` must be key
     * content — the Workers runtime has no filesystem, so `file://` paths do not resolve.
     */
    dkim?: DkimOptions;

    /**
     * Sends a raw RFC 822 message via your Worker's Email binding.
     * @param from The envelope-from address.
     * @param to The single recipient address.
     * @param raw The full RFC 822 (EML) message.
     * @example
     * ```ts
     * send: async (from, to, raw) => {
     *   const { EmailMessage } = await import("cloudflare:email");
     *   await env.SEND_EMAIL.send(new EmailMessage(from, to, raw));
     * }
     * ```
     */
    send: (from: string, to: string, raw: string) => Promise<void>;
}

/**
 * Cloudflare Email-specific options.
 */
export type CloudflareEmailOptions = EmailOptions;
