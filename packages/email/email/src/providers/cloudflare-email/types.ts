import type { BaseConfig, EmailOptions } from "../../types";

/**
 * Cloudflare Email Workers configuration.
 *
 * Cloudflare's send binding lives in the Workers runtime, so you wire it up yourself and pass a thin
 * `send` function — keeping this provider runtime-agnostic and testable.
 */
export interface CloudflareEmailConfig extends BaseConfig {
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
