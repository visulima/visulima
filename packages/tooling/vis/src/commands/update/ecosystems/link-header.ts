/**
 * Minimal RFC 5988 Link header parser. We only need the `rel="next"`
 * URL to drive pagination across GitHub's REST API and Docker Registry
 * v2 tag listings — bringing in a full parser would be overkill.
 *
 * Returns the URL for each known `rel`. Unknown rels are dropped. A
 * `null` or empty input yields an empty object.
 */
export interface ParsedLinks {
    readonly next?: string;
    readonly previous?: string;
    readonly last?: string;
    readonly first?: string;
}

export const parseLinkHeader = (header: string | null | undefined): ParsedLinks => {
    if (!header) {
        return {};
    }

    const out: { next?: string; previous?: string; last?: string; first?: string } = {};

    for (const entry of header.split(",")) {
        const match = /^\s*<([^>]+)>\s*;\s*(.+)$/.exec(entry);

        if (!match) {
            continue;
        }

        const url = match[1] ?? "";
        const params = match[2] ?? "";
        const relMatch = /rel\s*=\s*"?([^";\s]+)"?/i.exec(params);
        const rel = relMatch?.[1]?.toLowerCase();

        if (rel === "next") {
            out.next = url;
        } else if (rel === "prev" || rel === "previous") {
            out.previous = url;
        } else if (rel === "last") {
            out.last = url;
        } else if (rel === "first") {
            out.first = url;
        }
    }

    return out;
};
