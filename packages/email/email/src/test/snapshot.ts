import type { MockEmailEntry } from "../providers/mock/types";
import type { EmailAddress, EmailOptions } from "../types";

const formatAddress = (address: EmailAddress): string => {
    if (address.name) {
        return `${address.name} <${address.email}>`;
    }

    return address.email;
};

const formatList = (value: EmailAddress | EmailAddress[] | undefined): string[] | undefined => {
    if (value === undefined) {
        return undefined;
    }

    return (Array.isArray(value) ? value : [value]).map((address) => formatAddress(address));
};

/**
 * A stable, snapshot-friendly view of a sent message — volatile fields (message id, timestamp) are
 * omitted so the snapshot doesn't churn between runs.
 */
export interface EmailSnapshot {
    attachments?: { contentType?: string; filename: string }[];
    bcc?: string[];
    cc?: string[];
    from: string;
    headers?: Record<string, string>;
    html?: string;
    replyTo?: string;
    subject: string;
    text?: string;
    to: string[];
}

/**
 * Normalizes a captured message (a `createTestEmail` outbox entry or raw {@link EmailOptions}) into a
 * deterministic {@link EmailSnapshot} for use with Vitest/Jest `toMatchSnapshot()`.
 * @param source A mock-provider outbox entry or an `EmailOptions` object.
 * @returns The snapshot view.
 * @example
 * ```ts
 * expect(toEmailSnapshot(email.sent()[0])).toMatchSnapshot();
 * ```
 */
export const toEmailSnapshot = (source: EmailOptions | MockEmailEntry): EmailSnapshot => {
    const options = "options" in source ? source.options : source;

    const snapshot: EmailSnapshot = {
        from: formatAddress(options.from),
        subject: options.subject,
        to: formatList(options.to) ?? [],
    };

    const cc = formatList(options.cc);
    const bcc = formatList(options.bcc);

    if (cc) {
        snapshot.cc = cc;
    }

    if (bcc) {
        snapshot.bcc = bcc;
    }

    if (options.replyTo) {
        snapshot.replyTo = formatAddress(options.replyTo);
    }

    if (options.text !== undefined) {
        snapshot.text = options.text;
    }

    if (options.html !== undefined) {
        snapshot.html = options.html;
    }

    if (options.attachments && options.attachments.length > 0) {
        snapshot.attachments = options.attachments.map((attachment) => {
            return { contentType: attachment.contentType, filename: attachment.filename };
        });
    }

    return snapshot;
};
