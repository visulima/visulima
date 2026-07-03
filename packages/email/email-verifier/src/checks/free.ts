/**
 * Free-provider checks, re-exported from `@visulima/free-email-domains` so the
 * verifier exposes a single, consistent check surface. The default list is
 * lazily loaded on first use; call `preload` ahead of time to avoid the
 * first-call penalty, or `setDomains` to supply a custom list.
 * @example
 * ```ts
 * import isFreeEmail from "@visulima/email-verifier/checks/free";
 *
 * isFreeEmail("user@gmail.com"); // true
 * ```
 */

export type { FreeEmailOptions } from "@visulima/free-email-domains";
export { areFreeEmails, isFreeDomain, isFreeEmail, isListLoaded, preload, setDomains } from "@visulima/free-email-domains";
export { isFreeEmail as default } from "@visulima/free-email-domains";
