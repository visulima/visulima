import type { SuppressionStore } from "../deliverability/suppression";
import { filterSuppressed } from "../deliverability/suppression";
import EmailError from "../errors/email-error";
import type { EmailAddress } from "../types";
import type { Middleware } from "./types";

/**
 * Options for {@link withSuppression}.
 */
export interface SuppressionMiddlewareOptions {
    /**
     * Called with the recipients that were removed because they are suppressed.
     * @param suppressed The dropped recipients.
     */
    onSuppressed?: (suppressed: EmailAddress[]) => void;
}

/**
 * Filters suppressed recipients out of the `to` list before sending, and short-circuits with a failed
 * result when every recipient is suppressed.
 * @param store The suppression store to check against.
 * @param options Middleware options. See {@link SuppressionMiddlewareOptions}.
 * @returns A middleware that enforces the suppression list.
 */
export const withSuppression
    = (store: SuppressionStore, options: SuppressionMiddlewareOptions = {}): Middleware =>
        async (email, next) => {
            const empty = { allowed: [] as EmailAddress[], suppressed: [] as EmailAddress[] };
            const to = await filterSuppressed(email.to, store);
            const cc = email.cc ? await filterSuppressed(email.cc, store) : empty;
            const bcc = email.bcc ? await filterSuppressed(email.bcc, store) : empty;

            const suppressed = [...to.suppressed, ...cc.suppressed, ...bcc.suppressed];

            if (suppressed.length > 0) {
                options.onSuppressed?.(suppressed);
            }

            if (to.allowed.length === 0 && cc.allowed.length === 0 && bcc.allowed.length === 0) {
                return { error: new EmailError("middleware", "All recipients are suppressed", { code: "ALL_SUPPRESSED" }), success: false };
            }

            return next({
                ...email,
                bcc: bcc.allowed.length > 0 ? bcc.allowed : undefined,
                cc: cc.allowed.length > 0 ? cc.allowed : undefined,
                to: to.allowed,
            });
        };
