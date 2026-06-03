import { XMLParser } from "fast-xml-parser";

import EmailError from "../errors/email-error";

interface XmlNode {
    [key: string]: unknown;
}

const toArray = (value: unknown): XmlNode[] => {
    if (value === undefined || value === null) {
        return [];
    }

    return (Array.isArray(value) ? value : [value]) as XmlNode[];
};

const asString = (value: unknown): string | undefined => {
    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    return undefined;
};

const asNumber = (value: unknown): number | undefined => {
    const text = asString(value);

    if (text === undefined) {
        return undefined;
    }

    const parsed = Number(text);

    return Number.isNaN(parsed) ? undefined : parsed;
};

const toAuthResults = (node: unknown): DmarcAuthResult[] =>
    toArray(node).map((entry) => {
        return { domain: asString(entry.domain), result: asString(entry.result) };
    });

/**
 * A DKIM/SPF auth result inside a DMARC aggregate record.
 */
interface DmarcAuthResult {
    domain?: string;
    result?: string;
}

/**
 * One `&lt;record>` row of a DMARC aggregate report.
 */
interface DmarcRecordRow {
    /**
     * The per-mechanism auth results.
     */
    authResults: { dkim: DmarcAuthResult[]; spf: DmarcAuthResult[] };

    /**
     * Number of messages this row represents.
     */
    count: number;

    /**
     * The policy disposition applied (`none` / `quarantine` / `reject`).
     */
    disposition?: string;

    /**
     * The DKIM alignment result (`pass` / `fail`).
     */
    dkim?: string;

    /**
     * The `From:` header domain.
     */
    headerFrom?: string;

    /**
     * The source IP that sent the messages.
     */
    sourceIp?: string;

    /**
     * The SPF alignment result (`pass` / `fail`).
     */
    spf?: string;
}

/**
 * A parsed DMARC aggregate (RUA) report.
 */
interface DmarcAggregateReport {
    /**
     * Report window start (`date_range.begin`, unix seconds as a string).
     */
    dateRangeBegin?: string;

    /**
     * Report window end (`date_range.end`, unix seconds as a string).
     */
    dateRangeEnd?: string;

    /**
     * The reporter's contact email.
     */
    email?: string;

    /**
     * The reporting organization.
     */
    organizationName?: string;

    /**
     * The published policy the report was evaluated against.
     */
    policyPublished?: { adkim?: string; aspf?: string; domain?: string; p?: string; pct?: number; sp?: string };

    /**
     * The per-source rows.
     */
    records: DmarcRecordRow[];

    /**
     * The unique report id.
     */
    reportId?: string;
}

/**
 * Parses a DMARC aggregate (RUA) report XML document into a structured object.
 *
 * Reports arrive gzipped/zipped — decompress to the XML string first. `fast-xml-parser` is an optional
 * peer dependency (`pnpm add fast-xml-parser`), loaded only via this `./deliverability/dmarc-report`
 * entry point so the rest of the deliverability tooling stays dependency-free.
 * @param xml The DMARC aggregate report XML.
 * @returns The parsed report. See {@link DmarcAggregateReport}.
 * @throws {EmailError} When `fast-xml-parser` is not installed or the XML cannot be parsed.
 */
const parseDmarcReport = (xml: string): DmarcAggregateReport => {
    let parsedXml: XmlNode;

    try {
        parsedXml = new XMLParser({ ignoreAttributes: true, parseTagValue: false }).parse(xml) as XmlNode;
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError("deliverability", "fast-xml-parser is not installed. Please install it: pnpm add fast-xml-parser", { cause: error });
        }

        throw new EmailError("deliverability", `Failed to parse DMARC report: ${(error as Error).message}`, { cause: error });
    }

    const feedback = (parsedXml.feedback ?? {}) as XmlNode;
    const meta = (feedback.report_metadata ?? {}) as XmlNode;
    const dateRange = (meta.date_range ?? {}) as XmlNode;
    const policy = (feedback.policy_published ?? {}) as XmlNode;

    const records = toArray(feedback.record).map((record): DmarcRecordRow => {
        const row = (record.row ?? {}) as XmlNode;
        const evaluated = (row.policy_evaluated ?? {}) as XmlNode;
        const identifiers = (record.identifiers ?? {}) as XmlNode;
        const auth = (record.auth_results ?? {}) as XmlNode;

        return {
            authResults: { dkim: toAuthResults(auth.dkim), spf: toAuthResults(auth.spf) },
            count: asNumber(row.count) ?? 0,
            disposition: asString(evaluated.disposition),
            dkim: asString(evaluated.dkim),
            headerFrom: asString(identifiers.header_from),
            sourceIp: asString(row.source_ip),
            spf: asString(evaluated.spf),
        };
    });

    return {
        dateRangeBegin: asString(dateRange.begin),
        dateRangeEnd: asString(dateRange.end),
        email: asString(meta.email),
        organizationName: asString(meta.org_name),
        policyPublished: {
            adkim: asString(policy.adkim),
            aspf: asString(policy.aspf),
            domain: asString(policy.domain),
            p: asString(policy.p),
            pct: asNumber(policy.pct),
            sp: asString(policy.sp),
        },
        records,
        reportId: asString(meta.report_id),
    };
};

export type { DmarcAggregateReport, DmarcAuthResult, DmarcRecordRow };
export { parseDmarcReport };
