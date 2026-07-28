import { analyzeCharacters } from "./checks/character";
import type { DisposableEmailOptions } from "./checks/disposable";
import { isDisposableEmail } from "./checks/disposable";
import type { FreeEmailOptions } from "./checks/free";
import { isFreeEmail } from "./checks/free";
import type { MxCheckResult } from "./checks/mx";
import { checkMxRecords } from "./checks/mx";
import { isNoReply, isRoleAccount } from "./checks/role";
import type { SmtpVerificationOptions } from "./checks/smtp";
import { verifySmtp } from "./checks/smtp";
import { analyzeSymbols } from "./checks/symbol";
import { validateSyntax } from "./checks/syntax";
import { detectTag } from "./checks/tag";
import { parseName } from "./enrich/name";
import { classifyMxRecords } from "./enrich/provider";
import type { TypoOptions } from "./enrich/typo";
import { suggestEmailTypo } from "./enrich/typo";
import { splitAddress } from "./internal/address";
import type { Cache } from "./internal/cache";
import type { ScoreWeights } from "./score";
import { scoreReport } from "./score";
import type { DomainReport, EmailVerificationReport } from "./types";

/**
 * Options for `verifyEmail`.
 */
interface VerifyEmailOptions {
    /** Shared cache for MX/SMTP lookups (dedupes work when verifying lists). */
    cache?: Cache<MxCheckResult>;

    /**
     * Run live SMTP verification (catch-all, mailbox-full, greylist).
     * @default true
     */
    checkSmtp?: boolean;
    /** Disposable-list overrides. */
    disposable?: DisposableEmailOptions;
    /** Free-list overrides. */
    free?: FreeEmailOptions;

    /**
     * Skip all network checks (MX, SMTP, provider) and produce a syntax +
     * heuristic-only report. Overrides `checkSmtp`.
     * @default false
     */
    offline?: boolean;
    /** Additional role-account prefixes to recognize. */
    roleCustomPrefixes?: Iterable<string>;
    /** SMTP probe options (timeout, catch-all probes, retries, …). */
    smtp?: SmtpVerificationOptions;
    /** Typo-suggestion overrides. */
    typo?: TypoOptions;
    /** Score weight overrides. */
    weights?: Partial<ScoreWeights>;
}

const buildOfflineChecks = (
    email: string,
    options: VerifyEmailOptions,
): Pick<EmailVerificationReport, "character" | "didYouMean" | "disposable" | "free" | "name" | "noReply" | "role" | "symbol" | "tag"> => {
    return {
        character: analyzeCharacters(email),
        didYouMean: suggestEmailTypo(email, options.typo)?.full,
        disposable: isDisposableEmail(email, options.disposable),
        free: isFreeEmail(email, options.free),
        name: parseName(email),
        noReply: isNoReply(email),
        role: isRoleAccount(email, options.roleCustomPrefixes),
        symbol: analyzeSymbols(email),
        tag: detectTag(email),
    };
};

/**
 * Verifies and enriches a single email address end-to-end.
 *
 * Runs the offline checks (syntax, disposable, free, role, tag, character,
 * symbol, name, typo) immediately, then — unless `offline` is set — resolves the
 * domain's MX and runs the SMTP probe and provider classification concurrently.
 * Everything is aggregated into one {@link EmailVerificationReport} and scored.
 * @param email The email address to verify.
 * @param options Verification options.
 * @returns The complete verification report.
 * @example
 * ```ts
 * import { verifyEmail } from "@visulima/email-verifier";
 *
 * const report = await verifyEmail("user@gmail.com");
 * console.log(report.state, report.score); // "deliverable" 95
 * ```
 */
const verifyEmail = async (email: string, options: VerifyEmailOptions = {}): Promise<EmailVerificationReport> => {
    const { checkSmtp = true, offline = false } = options;
    const parts = splitAddress(email);
    const normalized = parts?.address ?? (typeof email === "string" ? email.trim().toLowerCase() : "");

    // Validate the normalized (trimmed, lowercased) address rather than the raw
    // input, so a padded-but-valid address like " user@gmail.com " is not rejected
    // by the whitespace-sensitive syntax regex while every other check runs on the
    // trimmed form.
    const syntaxValid = validateSyntax(parts?.address ?? email);

    // Short-circuit on bad syntax — there is nothing to resolve.
    if (!syntaxValid || !parts) {
        const offlineChecks = buildOfflineChecks(normalized, options);
        const domain: DomainReport = { records: [], resolvedVia: "unchecked", valid: false };
        const base = {
            ...offlineChecks,
            acceptAll: false,
            deferred: false,
            domain,
            email: normalized,
            mailboxFull: false,
            secureEmailGateway: false,
            syntaxValid: false,
        };

        return { ...base, ...scoreReport(base, options.weights) };
    }

    const offlineChecks = buildOfflineChecks(parts.address, options);

    let domain: DomainReport = { records: [], resolvedVia: "unchecked", valid: false };
    let smtp: EmailVerificationReport["smtp"];
    let provider: EmailVerificationReport["provider"];
    let secureEmailGateway = false;

    if (!offline) {
        const mxResult = await checkMxRecords(parts.domain, { cache: options.cache });

        domain = { deferred: mxResult.deferred, records: mxResult.records ?? [], resolvedVia: mxResult.resolvedVia, valid: mxResult.valid };

        const records = mxResult.records ?? [];

        if (mxResult.valid && records.length > 0) {
            // Classify the provider from the records we already resolved — no
            // second DNS lookup — and hand the same records to the SMTP probe so
            // it does not re-resolve the domain either.
            provider = classifyMxRecords(records);
            secureEmailGateway = provider?.type === "seg";

            if (checkSmtp) {
                smtp = await verifySmtp(parts.address, { cache: options.cache, ...options.smtp, mxRecords: records });
            }
        }
    }

    const base = {
        ...offlineChecks,
        acceptAll: smtp?.acceptAll ?? false,
        deferred: smtp?.deferred ?? false,
        domain,
        email: parts.address,
        mailboxFull: smtp?.mailboxFull ?? false,
        provider,
        secureEmailGateway,
        smtp,
        syntaxValid: true,
    };

    return { ...base, ...scoreReport(base, options.weights) };
};

export type { EmailVerificationReport, VerificationState } from "./types";
export type { VerifyEmailOptions };
export { verifyEmail };
export default verifyEmail;
