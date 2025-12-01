/**
 * Re-exports all functionality from @visulima/disposable-email-domains.
 * This provides access to disposable email domain checking utilities.
 *
 * @example
 * ```ts
 * import { isDisposableEmail, isDisposableDomain, getDomainList } from "@visulima/email/validation/disposable-email-domains";
 *
 * if (isDisposableEmail("user@mailinator.com")) {
 *     console.log("Disposable email detected!");
 * }
 * ```
 */
export * from "@visulima/disposable-email-domains";
