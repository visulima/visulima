import { Socket } from "node:net";

import { splitAddress } from "../internal/address";
import type { Cache } from "../internal/cache";
import type { MxCheckResult, MxRecord } from "./mx";
import { checkMxRecords } from "./mx";

/**
 * Options for SMTP verification.
 */
interface SmtpVerificationOptions {
    /** Cache for the underlying MX lookup. */
    cache?: Cache<MxCheckResult>;

    /**
     * Number of random, almost-certainly-nonexistent addresses to probe for
     * catch-all detection. More probes reduce false positives from
     * deferred-rejection servers. Set to 0 to disable.
     * @default 1
     */
    catchAllProbes?: number;

    /**
     * MAIL FROM address used during the probe; defaults to `verify@` followed by
     * the HELO host.
     */
    fromEmail?: string;

    /**
     * HELO/EHLO hostname presented to the remote server.
     * @default the address domain
     */
    heloHost?: string;

    /**
     * Pre-resolved MX records to probe, in priority order. When provided, the
     * probe skips its own DNS lookup — the orchestrator passes the records it
     * already resolved so the domain is not queried twice.
     */
    mxRecords?: MxRecord[];
    port?: number;

    /**
     * Number of times to retry the whole probe on a temporary (greylist) failure.
     * @default 1
     */
    retries?: number;

    /**
     * Delay in milliseconds between greylist retries.
     * @default 5000
     */
    retryDelay?: number;
    /** Cache for SMTP results. */
    smtpCache?: Cache<SmtpVerificationResult>;
    timeout?: number;
    ttl?: number;
}

/**
 * Detailed result of an SMTP verification attempt.
 */
interface SmtpVerificationResult {
    /** True when the server accepts a random, nonexistent recipient (catch-all). */
    acceptAll?: boolean;
    /** The numeric SMTP status code for the real RCPT TO. */
    code?: number;
    /** True when the result is inconclusive due to a temporary failure (greylisting). */
    deferred?: boolean;
    /** Final enhanced status code for the real RCPT (e.g. "5.1.1"), if present. */
    enhancedCode?: string;
    error?: string;
    /** True when the mailbox exists but is over quota (452/552 / 4.2.2). */
    mailboxFull?: boolean;
    mxRecords?: MxRecord[];
    smtpResponse?: string;
    /** True when the real RCPT TO was accepted (250). */
    valid: boolean;
}

interface SmtpReply {
    code: number;
    enhanced?: string;
    text: string;
}

// Any C0/C1 control character (notably CR/LF). A value containing one of these
// must never be written into an SMTP command line, since an embedded CRLF would
// smuggle a second command (SMTP command injection).
// eslint-disable-next-line no-control-regex -- intentionally matching control chars to reject them
const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/;

const ENHANCED_CODE_REGEX = /\b([245]\.\d{1,3}\.\d{1,3})\b/;
// A final reply line is a 3-digit code followed by a space (or end of line), as
// opposed to a continuation line whose code is followed by a hyphen. Accepting
// end-of-line tolerates non-compliant servers that omit the trailing space.
const FINAL_LINE_REGEX = /^(\d{3})(?: |$)/;
const LINE_SPLIT_REGEX = /\r?\n/;

// eslint-disable-next-line no-secrets/no-secrets -- the lowercase alphabet + digits is a character pool, not a credential
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

const randomLocalPart = (length = 20): string => {
    let out = "";

    for (let index = 0; index < length; index += 1) {
        // eslint-disable-next-line sonarjs/pseudo-random -- non-cryptographic: a throwaway local-part for catch-all probing
        out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)] ?? "";
    }

    return out;
};

const wait = async (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

/**
 * A minimal sequential SMTP client over a raw socket.
 *
 * Buffers incoming data and exposes `readReply()`/`command()` that resolve on a
 * complete (possibly multi-line) SMTP reply — a line whose 3-digit code is
 * followed by a space rather than a hyphen.
 */
class SmtpConnection {
    public transcript = "";

    private buffer = "";

    private readonly completed: SmtpReply[] = [];

    private failure: Error | undefined;

    private finished = false;

    private readonly socket: Socket;

    private waiter: { reject: (error: Error) => void; resolve: (reply: SmtpReply) => void } | undefined;

    public constructor(socket: Socket) {
        this.socket = socket;

        socket.on("data", (data: Buffer) => {
            this.transcript += data.toString();
            this.buffer += data.toString();
            this.drain();
        });

        const onEnd = (error?: Error): void => {
            this.finished = true;
            this.failure = error ?? new Error("Connection closed by server");

            if (this.completed.length === 0 && this.waiter) {
                this.waiter.reject(this.failure);
                this.waiter = undefined;
            }
        };

        socket.on("error", onEnd);
        socket.on("close", () => {
            onEnd();
        });
        // The connect-phase inactivity timer (set via socket.setTimeout) stays
        // armed for the whole dialogue. If the peer stalls mid-conversation
        // (tarpit), settle the pending waiter instead of hanging forever.
        socket.on("timeout", () => {
            onEnd(new Error("SMTP socket timeout"));
            socket.destroy();
        });
    }

    public async command(line: string): Promise<SmtpReply> {
        this.transcript += `${line}\r\n`;
        this.socket.write(`${line}\r\n`);

        return this.readReply();
    }

    public close(): void {
        try {
            this.socket.write("QUIT\r\n");
        } catch {
            // ignore — best effort
        }

        this.socket.removeAllListeners();
        this.socket.destroy();
    }

    public async readReply(): Promise<SmtpReply> {
        if (this.completed.length > 0) {
            return this.completed.shift() as SmtpReply;
        }

        if (this.finished) {
            throw this.failure ?? new Error("Connection closed");
        }

        return new Promise<SmtpReply>((resolve, reject) => {
            this.waiter = { reject, resolve };
        });
    }

    private drain(): void {
        const lines = this.buffer.split(LINE_SPLIT_REGEX);

        // Keep the trailing partial line in the buffer.
        this.buffer = lines.pop() ?? "";

        let group: string[] = [];

        for (const line of lines) {
            group.push(line);

            const match = FINAL_LINE_REGEX.exec(line);

            if (match) {
                const text = group.join("\n");
                const enhanced = ENHANCED_CODE_REGEX.exec(text)?.[1];

                this.completed.push({ code: Number.parseInt(match[1] as string, 10), enhanced, text });
                group = [];
            }
        }

        // Re-buffer any leading partial group (multi-line reply split across packets).
        if (group.length > 0) {
            this.buffer = `${group.join("\n")}\n${this.buffer}`;
        }

        if (this.waiter && this.completed.length > 0) {
            const { resolve } = this.waiter;

            this.waiter = undefined;
            resolve(this.completed.shift() as SmtpReply);
        }
    }
}

const classifyRcpt = (reply: SmtpReply): Pick<SmtpVerificationResult, "code" | "deferred" | "enhancedCode" | "mailboxFull" | "valid"> => {
    const { code, enhanced } = reply;

    if (code >= 200 && code < 300) {
        return { code, enhancedCode: enhanced, valid: true };
    }

    // Over-quota / mailbox full: 452 (temp) or 552 (perm), enhanced 4.2.2 / 5.2.2.
    if (code === 452 || code === 552 || enhanced === "4.2.2" || enhanced === "5.2.2") {
        return { code, deferred: code === 452, enhancedCode: enhanced, mailboxFull: true, valid: false };
    }

    // Temporary failures — greylisting, rate limits — are inconclusive.
    if (code >= 400 && code < 500) {
        return { code, deferred: true, enhancedCode: enhanced, valid: false };
    }

    // 5xx permanent rejections: the mailbox does not exist.
    return { code, enhancedCode: enhanced, valid: false };
};

const connect = async (host: string, port: number, timeout: number): Promise<SmtpConnection> =>
    new Promise<SmtpConnection>((resolve, reject) => {
        const socket = new Socket();

        socket.setTimeout(timeout);

        const onFail = (error: Error): void => {
            socket.removeAllListeners();
            socket.destroy();
            reject(error);
        };

        const onTimeout = (): void => {
            onFail(new Error("SMTP connection timeout"));
        };

        socket.once("error", onFail);
        socket.once("timeout", onTimeout);
        socket.connect(port, host, () => {
            // Detach BOTH connect-phase handlers before handing the live socket
            // to SmtpConnection — otherwise the lingering timeout listener would
            // call removeAllListeners() mid-dialogue and strip the connection's
            // own handlers, leaving readReply() pending forever.
            socket.removeListener("error", onFail);
            socket.removeListener("timeout", onTimeout);
            resolve(new SmtpConnection(socket));
        });
    });

/**
 * Internal probe result that additionally records whether a `deferred` outcome
 * came from a pre-RCPT connection-level refusal (greeting/HELO/MAIL FROM). Such
 * a refusal is about this host, not the mailbox, so `probeRecords` keeps trying
 * lower-priority MX hosts instead of accepting it as the final answer.
 */
interface ProbeResult extends SmtpVerificationResult {
    connectionLevel?: boolean;
}

const probeOnce = async (email: string, domain: string, mxRecord: MxRecord, options: SmtpVerificationOptions): Promise<ProbeResult> => {
    const { catchAllProbes = 1, port = 25, timeout = 5000 } = options;
    const heloHost = options.heloHost ?? domain;
    const fromEmail = options.fromEmail ?? `verify@${heloHost}`;

    let connection: SmtpConnection | undefined;

    try {
        connection = await connect(mxRecord.exchange, port, timeout);

        const greeting = await connection.readReply();

        if (greeting.code !== 220) {
            // A non-220 greeting (e.g. 554 IP-blocked, 421 tarpit) is a
            // connection-level refusal, never a verdict on the mailbox — surface
            // it as inconclusive rather than letting a 5xx read as undeliverable.
            return { connectionLevel: true, deferred: true, error: `Unexpected greeting: ${greeting.text}`, valid: false };
        }

        let ehlo = await connection.command(`EHLO ${heloHost}`);

        if (ehlo.code !== 250) {
            ehlo = await connection.command(`HELO ${heloHost}`);

            if (ehlo.code !== 250) {
                // HELO/EHLO refusal is a connection-level policy decision, not a
                // mailbox verdict — inconclusive.
                return { connectionLevel: true, deferred: true, error: `HELO rejected: ${ehlo.text}`, valid: false };
            }
        }

        const mailFrom = await connection.command(`MAIL FROM:<${fromEmail}>`);

        if (mailFrom.code !== 250) {
            // A rejected sender is a policy decision about us, not about the
            // recipient mailbox — inconclusive.
            return { connectionLevel: true, deferred: true, error: `MAIL FROM rejected: ${mailFrom.text}`, valid: false };
        }

        const rcptReply = await connection.command(`RCPT TO:<${email}>`);
        const classified = classifyRcpt(rcptReply);

        let acceptAll: boolean | undefined;

        // Only probe for catch-all when the real address was accepted — a server
        // that rejects the real address is by definition not accept-all.
        if (classified.valid && catchAllProbes > 0) {
            acceptAll = true;

            for (let index = 0; index < catchAllProbes; index += 1) {
                // eslint-disable-next-line no-await-in-loop
                const probe = await connection.command(`RCPT TO:<${randomLocalPart()}@${domain}>`);

                if (probe.code < 200 || probe.code >= 300) {
                    acceptAll = false;
                    break;
                }
            }
        }

        return { ...classified, acceptAll, smtpResponse: connection.transcript };
    } finally {
        connection?.close();
    }
};

/**
 * Probes each MX host in priority order until one yields a definitive answer.
 *
 * A connection-level failure (refused, timed out, tarpitted) on one host falls
 * through to the next; an SMTP-level reply (accept, reject, greylist) is returned
 * immediately since it is already a verdict. If every host fails to connect, the
 * result is inconclusive (`deferred`).
 * @param address The normalized address being verified.
 * @param domain The address domain (HELO default + catch-all probe domain).
 * @param records The MX records to try, in priority order.
 * @param options Verification options.
 * @returns The first definitive SMTP result, or a deferred result if all hosts fail.
 */
const probeRecords = async (address: string, domain: string, records: MxRecord[], options: SmtpVerificationOptions): Promise<SmtpVerificationResult> => {
    let lastError = "SMTP verification did not complete";
    let connectionRefusal: ProbeResult | undefined;

    for (const record of records) {
        let result: ProbeResult;

        try {
            // eslint-disable-next-line no-await-in-loop
            result = await probeOnce(address, domain, record, options);
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
            continue;
        }

        // A pre-RCPT connection-level refusal (blocked greeting/HELO/MAIL FROM)
        // is a verdict about this host, not the mailbox — remember it as a
        // fallback and try the next MX, which may answer.
        if (result.connectionLevel) {
            connectionRefusal = result;
            continue;
        }

        return result;
    }

    if (connectionRefusal) {
        const { connectionLevel, ...rest } = connectionRefusal;

        return rest;
    }

    return { deferred: true, error: lastError, valid: false };
};

/**
 * Validates caller-supplied SMTP command arguments for control characters.
 * @param options The verification options.
 * @returns An error result if `heloHost`/`fromEmail` contains a control char, else `undefined`.
 */
const findCommandInjection = (options: SmtpVerificationOptions): SmtpVerificationResult | undefined => {
    if (options.heloHost !== undefined && CONTROL_CHAR_REGEX.test(options.heloHost)) {
        return { error: "Invalid heloHost: control characters are not allowed", valid: false };
    }

    if (options.fromEmail !== undefined && CONTROL_CHAR_REGEX.test(options.fromEmail)) {
        return { error: "Invalid fromEmail: control characters are not allowed", valid: false };
    }

    return undefined;
};

/**
 * Verifies an email address over SMTP without sending a message.
 *
 * Performs the full handshake (greeting → EHLO/HELO → MAIL FROM → RCPT TO),
 * then — when the real recipient is accepted — issues additional RCPT TO probes
 * for random addresses to detect catch-all (accept-all) servers. Temporary
 * (4xx) failures are surfaced as `deferred` and retried up to `retries` times to
 * survive greylisting, and over-quota responses set `mailboxFull`.
 *
 * Note: many networks block outbound port 25 and many servers refuse or tarpit
 * verification probes, so treat a `deferred`/errored result as inconclusive
 * rather than undeliverable.
 * @param email The email address to verify.
 * @param options Verification options.
 * @returns The detailed SMTP verification result.
 * @example
 * ```ts
 * import { verifySmtp } from "@visulima/email-verifier/checks/smtp";
 *
 * const result = await verifySmtp("user@example.com", { catchAllProbes: 2 });
 * if (result.valid && !result.acceptAll) {
 *     console.log("Mailbox exists");
 * }
 * ```
 */
// In-flight probes keyed by cache key. Concurrent verifications of the same
// mailbox (e.g. a list with repeated addresses driven by Promise.all) share the
// first caller's socket dialogue instead of each opening their own — which also
// reduces the chance the remote MTA rate-limits or greylists the prober. Cleared
// in `finally` before the definitive result is cached.
const inflight = new Map<string, Promise<SmtpVerificationResult>>();

const verifySmtp = async (email: string, options: SmtpVerificationOptions = {}): Promise<SmtpVerificationResult> => {
    const parts = splitAddress(email);

    if (!parts) {
        return { error: "Invalid email format", valid: false };
    }

    const { domain } = parts;

    // Reject control characters (notably CR/LF) in caller-supplied command
    // arguments before they are written into EHLO/HELO/MAIL FROM, so a crafted
    // value cannot smuggle a second SMTP command (command injection). The
    // recipient address is already control-char-free via splitAddress.
    const injectionError = findCommandInjection(options);

    if (injectionError) {
        return injectionError;
    }

    const { retries = 1, retryDelay = 5000, ttl = 3_600_000 } = options;
    // The cache key must include every option that can change the verdict —
    // otherwise a later call with different probing/HELO/MX inputs could read a
    // result computed under different conditions.
    const cacheKey = [
        "smtp",
        parts.address,
        options.fromEmail ?? "",
        String(options.port ?? 25),
        options.heloHost ?? "",
        String(options.catchAllProbes ?? 1),
        (options.mxRecords ?? []).map((record) => record.exchange).join(","),
    ].join("|");

    if (options.smtpCache) {
        const cached = await options.smtpCache.get(cacheKey);

        if (cached !== undefined) {
            return cached;
        }
    }

    const existing = inflight.get(cacheKey);

    if (existing) {
        return existing;
    }

    const pending = (async (): Promise<SmtpVerificationResult> => {
        let records = options.mxRecords;

        if (!records || records.length === 0) {
            const mxCheck = await checkMxRecords(domain, { cache: options.cache, fallbackToAddress: false });

            if (!mxCheck.valid || !mxCheck.records || mxCheck.records.length === 0) {
                return { error: mxCheck.error ?? "No MX records found", mxRecords: mxCheck.records, valid: false };
            }

            records = mxCheck.records;
        }

        let result: SmtpVerificationResult = { error: "SMTP verification did not complete", valid: false };

        for (let attempt = 0; attempt <= retries; attempt += 1) {
            // eslint-disable-next-line no-await-in-loop
            result = await probeRecords(parts.address, domain, records, options);

            if (!result.deferred || attempt === retries) {
                break;
            }

            // eslint-disable-next-line no-await-in-loop
            await wait(retryDelay);
        }

        result = { ...result, mxRecords: records };

        // Only cache definitive verdicts. A `deferred` result (greylisting, 4xx,
        // timeout, connection-level refusal) is transient and inconclusive, so
        // caching it for the full TTL would pin a wrong/stale answer.
        if (options.smtpCache && !result.deferred) {
            await options.smtpCache.set(cacheKey, result, ttl);
        }

        return result;
    })();

    inflight.set(cacheKey, pending);

    try {
        return await pending;
    } finally {
        inflight.delete(cacheKey);
    }
};

export type { SmtpVerificationOptions, SmtpVerificationResult };
export { verifySmtp };
export default verifySmtp;
