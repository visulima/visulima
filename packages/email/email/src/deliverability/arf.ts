const FEEDBACK_REPORT_MARKER = "message/feedback-report";

/**
 * Extracts the key/value lines from the `message/feedback-report` section of an ARF email.
 * @param raw The raw ARF email text (full MIME message or just the report part).
 * @returns The parsed fields keyed by lower-cased field name.
 */
const parseFields = (raw: string): Record<string, string> => {
    const normalized = raw.replaceAll("\r\n", "\n");

    let section = normalized;
    // Content types are case-insensitive (RFC 2045), so match the marker case-insensitively.
    const markerIndex = normalized.toLowerCase().indexOf(FEEDBACK_REPORT_MARKER);

    if (markerIndex !== -1) {
        // Skip past the content-type line and the blank line that ends the part headers.
        const afterMarker = normalized.slice(markerIndex);
        const blankLineIndex = afterMarker.indexOf("\n\n");

        section = blankLineIndex === -1 ? afterMarker : afterMarker.slice(blankLineIndex + 2);
    }

    const fields: Record<string, string> = {};

    for (const line of section.split("\n")) {
        if (line.trim() === "") {
            // Stop at the blank line that terminates the feedback-report body.
            if (Object.keys(fields).length > 0) {
                break;
            }

            continue;
        }

        const colonIndex = line.indexOf(":");

        if (colonIndex === -1) {
            continue;
        }

        const key = line.slice(0, colonIndex).trim().toLowerCase();
        const value = line.slice(colonIndex + 1).trim();

        if (key) {
            fields[key] = value;
        }
    }

    return fields;
};

/**
 * A parsed [ARF](https://www.rfc-editor.org/rfc/rfc5965) (Abuse Reporting Format) feedback report,
 * as delivered by mailbox-provider feedback loops (FBLs) on spam complaints.
 */
export interface ArfReport {
    /**
     * When the offending message arrived, if reported.
     */
    arrivalDate?: string;

    /**
     * The type of feedback — `abuse` for spam complaints, `auth-failure`, `fraud`, etc.
     */
    feedbackType?: string;

    /**
     * All parsed fields from the `message/feedback-report` part, lower-cased keys.
     */
    fields: Record<string, string>;

    /**
     * The envelope sender of the original message, if reported.
     */
    originalMailFrom?: string;

    /**
     * The recipient(s) that complained — the address(es) to suppress.
     */
    originalRcptTo?: string;

    /**
     * The domain the report concerns.
     */
    reportedDomain?: string;

    /**
     * The source IP of the original message, if reported.
     */
    sourceIp?: string;
}

/**
 * Parses an ARF feedback-loop complaint report into a structured object.
 *
 * Pass either the full raw ARF email or just its `message/feedback-report` part. Use
 * {@link ArfReport.originalRcptTo} to drive suppression of complaining recipients.
 * @param raw The raw ARF email text.
 * @returns The parsed report. See {@link ArfReport}.
 */
export const parseArfReport = (raw: string): ArfReport => {
    const fields = parseFields(raw);

    return {
        arrivalDate: fields["arrival-date"],
        feedbackType: fields["feedback-type"],
        fields,
        originalMailFrom: fields["original-mail-from"],
        originalRcptTo: fields["original-rcpt-to"],
        reportedDomain: fields["reported-domain"],
        sourceIp: fields["source-ip"],
    };
};
