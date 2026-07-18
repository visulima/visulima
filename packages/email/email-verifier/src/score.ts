import type { EmailVerificationReport, VerificationState } from "./types";

/**
 * The fields of a report the scorer consumes (everything except the derived
 * `score`, `state`, and `reason`).
 */
type ScoreInput = Omit<EmailVerificationReport, "reason" | "score" | "state">;

/**
 * Overridable penalty/bonus weights for the quality score.
 *
 * Each value is points applied to a 100-point baseline. Penalties are positive
 * numbers that get subtracted; bonuses are added.
 */
interface ScoreWeights {
    acceptAll: number;
    character: number;
    deferred: number;
    didYouMean: number;
    disposable: number;
    free: number;
    knownProvider: number;
    mailboxFull: number;
    mixedScripts: number;
    noReply: number;
    role: number;
    smtpUnverified: number;
    symbol: number;
}

/**
 * The default scoring rubric. Transparent and additive so callers can reason
 * about — and override — every weight.
 */
const DEFAULT_WEIGHTS: ScoreWeights = {
    acceptAll: 25,
    character: 15,
    deferred: 15,
    didYouMean: 20,
    disposable: 60,
    free: 5,
    knownProvider: 5,
    mailboxFull: 40,
    mixedScripts: 30,
    noReply: 25,
    role: 25,
    smtpUnverified: 10,
    symbol: 10,
};

/**
 * The outcome of scoring: the numeric score plus the derived state and reason.
 */
interface ScoreResult {
    reason: string;
    score: number;
    state: VerificationState;
}

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const isPermanentReject = (input: ScoreInput): boolean =>
    input.smtp !== undefined && !input.smtp.valid && !input.smtp.deferred && !input.mailboxFull && (input.smtp.code ?? 0) >= 500;

type StateVerdict = { reason: string; state: VerificationState };

// An SMTP-accepted mailbox is deliverable unless a risk signal downgrades it.
const deriveAcceptedState = (input: ScoreInput): StateVerdict => {
    if (input.disposable) {
        return { reason: "disposable_mailbox", state: "risky" };
    }

    if (input.mailboxFull) {
        return { reason: "mailbox_full", state: "risky" };
    }

    if (input.acceptAll) {
        return { reason: "accept_all", state: "risky" };
    }

    if (input.noReply) {
        return { reason: "no_reply", state: "risky" };
    }

    if (input.role) {
        return { reason: "role_account", state: "risky" };
    }

    return { reason: "accepted_email", state: "deliverable" };
};

const deriveSmtpState = (input: ScoreInput): StateVerdict => {
    if (isPermanentReject(input)) {
        return { reason: "rejected_email", state: "undeliverable" };
    }

    if (input.smtp?.valid) {
        return deriveAcceptedState(input);
    }

    if (input.mailboxFull) {
        return { reason: "mailbox_full", state: "risky" };
    }

    if (input.smtp?.deferred) {
        return { reason: "greylisted", state: "unknown" };
    }

    return { reason: "unknown", state: "unknown" };
};

const deriveState = (input: ScoreInput): StateVerdict => {
    if (!input.syntaxValid) {
        return { reason: "invalid_syntax", state: "undeliverable" };
    }

    if (input.domain.resolvedVia !== "unchecked" && !input.domain.valid) {
        // A transient DNS failure is inconclusive, not a do-not-send verdict.
        if (input.domain.deferred) {
            return { reason: "dns_error", state: "unknown" };
        }

        return { reason: input.domain.resolvedVia === "none" ? "no_mx_records" : "invalid_domain", state: "undeliverable" };
    }

    if (input.smtp) {
        return deriveSmtpState(input);
    }

    // SMTP not probed — offline checks only.
    if (input.disposable) {
        return { reason: "disposable_mailbox", state: "risky" };
    }

    return { reason: "smtp_not_checked", state: "unknown" };
};

/**
 * Computes a 0–100 quality score and the deliverability state for a report.
 *
 * The state is derived from hard signals (syntax, domain, SMTP verdict); the
 * score layers transparent penalties/bonuses on top so two `risky` addresses can
 * still be ranked against each other.
 * @param input The verification signals (a report without its derived fields).
 * @param weights Optional weight overrides.
 * @returns The score, state, and reason.
 * @example
 * ```ts
 * import { scoreReport } from "@visulima/email-verifier/score";
 *
 * const { score, state } = scoreReport(report);
 * ```
 */
const scoreReport = (input: ScoreInput, weights: Partial<ScoreWeights> = {}): ScoreResult => {
    const w = { ...DEFAULT_WEIGHTS, ...weights };
    const { reason, state } = deriveState(input);

    if (state === "undeliverable") {
        return { reason, score: 0, state };
    }

    let score = 100;

    if (input.smtp?.valid !== true) {
        score -= w.smtpUnverified;
    }

    if (input.deferred) {
        score -= w.deferred;
    }

    if (input.disposable) {
        score -= w.disposable;
    }

    if (input.acceptAll) {
        score -= w.acceptAll;
    }

    if (input.mailboxFull) {
        score -= w.mailboxFull;
    }

    if (input.role) {
        score -= w.role;
    }

    if (input.noReply) {
        score -= w.noReply;
    }

    if (input.free) {
        score -= w.free;
    }

    if (input.character.irregular) {
        score -= w.character;
    }

    if (input.symbol.hasMixedScripts) {
        score -= w.mixedScripts;
    } else if (input.symbol.hasSymbols) {
        score -= w.symbol;
    }

    if (input.didYouMean) {
        score -= w.didYouMean;
    }

    if (input.provider) {
        score += w.knownProvider;
    }

    return { reason, score: clamp(score), state };
};

export type { ScoreInput, ScoreResult, ScoreWeights };
export { DEFAULT_WEIGHTS, scoreReport };
export default scoreReport;
