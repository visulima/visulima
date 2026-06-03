const splitUris = (value: string | undefined): string[] | undefined => {
    if (!value) {
        return undefined;
    }

    return value
        .split(",")
        .map((uri) => uri.trim())
        .filter((uri) => uri.length > 0);
};

const alignment = (value: string | undefined): "r" | "s" | undefined => {
    if (value === "s") {
        return "s";
    }

    if (value === "r") {
        return "r";
    }

    return undefined;
};

const validPolicy = (value: string | undefined): "none" | "quarantine" | "reject" | undefined => {
    if (value === "none" || value === "quarantine" || value === "reject") {
        return value;
    }

    return undefined;
};

/**
 * A parsed DMARC DNS policy record (the `_dmarc.&lt;domain>` TXT record).
 */
export interface DmarcRecord {
    /**
     * DKIM identifier alignment: `r` (relaxed, default) or `s` (strict).
     */
    adkim?: "r" | "s";

    /**
     * SPF identifier alignment: `r` (relaxed, default) or `s` (strict).
     */
    aspf?: "r" | "s";

    /**
     * Failure reporting options (`fo`): `0`, `1`, `d`, `s`, or a colon-joined combination.
     */
    fo?: string;

    /**
     * Percentage of messages the policy applies to (`pct`, 0–100).
     */
    percent?: number;

    /**
     * Requested policy (`p`): `none`, `quarantine`, or `reject`.
     */
    policy?: "none" | "quarantine" | "reject";

    /**
     * Aggregate report URIs (`rua`).
     */
    rua?: string[];

    /**
     * Failure (forensic) report URIs (`ruf`).
     */
    ruf?: string[];

    /**
     * Subdomain policy (`sp`).
     */
    subdomainPolicy?: "none" | "quarantine" | "reject";

    /**
     * All raw tag/value pairs, keyed by tag.
     */
    tags: Record<string, string>;

    /**
     * Whether the record is a syntactically valid DMARC1 record (starts with `v=DMARC1`).
     */
    valid: boolean;
}

/**
 * Parses a DMARC policy record (the TXT record at `_dmarc.&lt;domain>`).
 * @param record The raw TXT record value (e.g. `v=DMARC1; p=reject; rua=mailto:agg@example.com`).
 * @returns The parsed record. See {@link DmarcRecord}.
 */
export const parseDmarcRecord = (record: string): DmarcRecord => {
    const tags: Record<string, string> = {};

    // A valid DMARC record must begin with the version tag (RFC 7489 §6.3): "v=DMARC1".
    const firstTag = record
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.length > 0);

    for (const part of record.split(";")) {
        const index = part.indexOf("=");

        if (index === -1) {
            continue;
        }

        const key = part.slice(0, index).trim().toLowerCase();
        const value = part.slice(index + 1).trim();

        if (key) {
            tags[key] = value;
        }
    }

    const percentRaw = tags.pct === undefined ? undefined : Number.parseInt(tags.pct, 10);

    return {
        adkim: alignment(tags.adkim),
        aspf: alignment(tags.aspf),
        fo: tags.fo,
        percent: percentRaw === undefined || Number.isNaN(percentRaw) ? undefined : percentRaw,
        policy: validPolicy(tags.p),
        rua: splitUris(tags.rua),
        ruf: splitUris(tags.ruf),
        subdomainPolicy: validPolicy(tags.sp),
        tags,
        valid: firstTag?.toLowerCase() === "v=dmarc1",
    };
};
