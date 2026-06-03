interface RawTlsPolicy {
    summary?: { "total-failure-session-count"?: number; "total-successful-session-count"?: number };
}

interface RawTlsReport {
    "date-range"?: { "end-datetime"?: string; "start-datetime"?: string };
    "organization-name"?: string;
    policies?: RawTlsPolicy[];
    "report-id"?: string;
}

/**
 * A parsed TLS-RPT DNS record (`_smtp._tls.&lt;domain>` TXT record).
 */
export interface TlsRptRecord {
    /**
     * Report destination URIs (`rua`): `mailto:` and/or `https:` endpoints.
     */
    rua: string[];

    /**
     * Whether the record is a syntactically valid `TLSRPTv1` record.
     */
    valid: boolean;

    /**
     * The record version (`TLSRPTv1`).
     */
    version?: string;
}

/**
 * A normalized [TLS-RPT](https://www.rfc-editor.org/rfc/rfc8460) report.
 */
export interface TlsReport {
    /**
     * Report end timestamp (ISO 8601), from `date-range.end-datetime`.
     */
    endDate?: string;

    /**
     * The reporting organization (`organization-name`).
     */
    organizationName?: string;

    /**
     * The raw `policies` array, for provider-specific detail.
     */
    policies: unknown[];

    /**
     * The unique report id (`report-id`).
     */
    reportId?: string;

    /**
     * Report start timestamp (ISO 8601), from `date-range.start-datetime`.
     */
    startDate?: string;

    /**
     * Total failed TLS sessions across all policies.
     */
    totalFailure: number;

    /**
     * Total successful TLS sessions across all policies.
     */
    totalSuccessful: number;
}

/**
 * Parses a TLS-RPT policy record (the TXT record at `_smtp._tls.&lt;domain>`).
 * @param record The raw TXT record value (e.g. `v=TLSRPTv1; rua=mailto:tlsrpt@example.com`).
 * @returns The parsed record. See {@link TlsRptRecord}.
 */
export const parseTlsRptRecord = (record: string): TlsRptRecord => {
    const tags: Record<string, string> = {};

    for (const part of record.split(";")) {
        const index = part.indexOf("=");

        if (index === -1) {
            continue;
        }

        const key = part.slice(0, index).trim().toLowerCase();

        if (key) {
            tags[key] = part.slice(index + 1).trim();
        }
    }

    const rua = (tags.rua ?? "")
        .split(",")
        .map((uri) => uri.trim())
        .filter((uri) => uri.length > 0);

    return {
        rua,
        valid: (tags.v ?? "") === "TLSRPTv1",
        version: tags.v,
    };
};

/**
 * Parses a TLS-RPT JSON report into a normalized summary.
 * @param report The report as a JSON string or already-parsed object.
 * @returns The normalized report. See {@link TlsReport}.
 * @throws {SyntaxError} When a string is provided that is not valid JSON.
 */
export const parseTlsReport = (report: Record<string, unknown> | string): TlsReport => {
    const parsed = (typeof report === "string" ? JSON.parse(report) : report) as RawTlsReport;
    const policies = parsed.policies ?? [];

    let totalSuccessful = 0;
    let totalFailure = 0;

    for (const policy of policies) {
        totalSuccessful += policy.summary?.["total-successful-session-count"] ?? 0;
        totalFailure += policy.summary?.["total-failure-session-count"] ?? 0;
    }

    return {
        endDate: parsed["date-range"]?.["end-datetime"],
        organizationName: parsed["organization-name"],
        policies,
        reportId: parsed["report-id"],
        startDate: parsed["date-range"]?.["start-datetime"],
        totalFailure,
        totalSuccessful,
    };
};
