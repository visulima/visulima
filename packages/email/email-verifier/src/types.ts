import type { CharacterResult } from "./checks/character";
import type { MxRecord, MxResolution } from "./checks/mx";
import type { SmtpVerificationResult } from "./checks/smtp";
import type { SymbolResult } from "./checks/symbol";
import type { TagResult } from "./checks/tag";
import type { NameResult } from "./enrich/name";
import type { MxProviderInfo } from "./enrich/provider";

/**
 * The overall deliverability verdict for an address, mirroring emailable's states.
 *
 * - `deliverable`: the mailbox almost certainly exists and accepts mail.
 * - `risky`: deliverable but lower-quality (catch-all, role, disposable, full mailbox).
 * - `undeliverable`: syntax/domain/mailbox failure — do not send.
 * - `unknown`: could not be determined (SMTP blocked, greylisted, or not probed).
 */
export type VerificationState = "deliverable" | "risky" | "undeliverable" | "unknown";

/**
 * The resolved domain portion of a verification report.
 */
export interface DomainReport {
    /** The MX records found (empty when resolved via A/AAAA or not at all). */
    records: MxRecord[];
    /** How mail-acceptance was established (`unchecked` when DNS was skipped). */
    resolvedVia: MxResolution | "unchecked";
    /** True when the domain can accept mail. */
    valid: boolean;
}

/**
 * A complete email verification + enrichment report.
 *
 * Aggregates every check and enrichment into a single object whose shape reads
 * as a drop-in mental model for emailable's API response.
 */
export interface EmailVerificationReport {
    /** True when the SMTP server accepts any recipient (catch-all / accept-all). */
    acceptAll: boolean;
    /** Local-part character analysis. */
    character: CharacterResult;
    /** True when the SMTP result was inconclusive (greylisting / temporary failure). */
    deferred: boolean;
    /** Typo-corrected address suggestion, if the domain looked misspelled. */
    didYouMean?: string;
    /** True when the address uses a known disposable / throwaway domain. */
    disposable: boolean;
    /** The resolved domain details. */
    domain: DomainReport;
    /** The normalized (lowercased, trimmed) email address. */
    email: string;
    /** True when the address uses a known free mailbox provider. */
    free: boolean;
    /** True when the mailbox exists but is over quota. */
    mailboxFull: boolean;
    /** Name parsed from the local part (no gender detection). */
    name: NameResult;
    /** True when the address is a no-reply / do-not-reply mailbox. */
    noReply: boolean;
    /** The classified mailbox/SEG provider, if recognized. */
    provider?: MxProviderInfo;
    /** Human-readable explanation of the `state`. */
    reason: string;
    /** True when the address is a role-based (shared) mailbox. */
    role: boolean;
    /** Composite 0–100 quality score. */
    score: number;
    /** True when the resolving MX is a Secure Email Gateway. */
    secureEmailGateway: boolean;
    /** The raw SMTP probe result, when SMTP verification ran. */
    smtp?: SmtpVerificationResult;
    /** The overall deliverability verdict. */
    state: VerificationState;
    /** Symbol / Unicode-script analysis. */
    symbol: SymbolResult;
    /** True when the address passed the syntax check. */
    syntaxValid: boolean;
    /** Sub-address (tag) detection result. */
    tag: TagResult;
}
