/**
 * Disposable / throwaway-domain checks, re-exported from
 * `@visulima/disposable-email-domains` so the verifier exposes a single,
 * consistent check surface. The default list is lazily loaded on first use; call
 * `preload` ahead of time to avoid the first-call penalty, or `setDomains` to
 * supply a custom list.
 * @example
 * ```ts
 * import isDisposableEmail from "@visulima/email-verifier/checks/disposable";
 *
 * isDisposableEmail("user@mailinator.com"); // true
 * ```
 */

export type { DisposableEmailOptions } from "@visulima/disposable-email-domains";
export { areDisposableEmails, isDisposableDomain, isDisposableEmail, isListLoaded, preload, setDomains } from "@visulima/disposable-email-domains";
export { isDisposableEmail as default } from "@visulima/disposable-email-domains";
