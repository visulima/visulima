const MTA_STS_MODES = new Set<string>(["enforce", "none", "testing"]);

/**
 * A parsed [MTA-STS](https://www.rfc-editor.org/rfc/rfc8461) policy
 * (`https://mta-sts.&lt;domain>/.well-known/mta-sts.txt`).
 */
export interface MtaStsPolicy {
    /**
     * Maximum policy lifetime in seconds (`max_age`).
     */
    maxAge?: number;

    /**
     * Enforcement mode: `enforce`, `testing`, or `none`.
     */
    mode?: "enforce" | "none" | "testing";

    /**
     * Allowed MX host patterns (may include a leading `*.` wildcard).
     */
    mx: string[];

    /**
     * Whether the policy is a syntactically valid `STSv1` policy.
     */
    valid: boolean;

    /**
     * The policy version (`STSv1`).
     */
    version?: string;
}

/**
 * Parses an MTA-STS policy file.
 * @param policy The raw policy text.
 * @returns The parsed policy. See {@link MtaStsPolicy}.
 */
export const parseMtaStsPolicy = (policy: string): MtaStsPolicy => {
    const mx: string[] = [];
    let version: string | undefined;
    let mode: MtaStsPolicy["mode"];
    let maxAge: number | undefined;

    for (const line of policy.replaceAll("\r\n", "\n").split("\n")) {
        const index = line.indexOf(":");

        if (index === -1) {
            continue;
        }

        const key = line.slice(0, index).trim().toLowerCase();
        const value = line.slice(index + 1).trim();

        if (key === "version") {
            version = value;
        } else if (key === "mode" && (value === "enforce" || value === "testing" || value === "none")) {
            mode = value;
        } else if (key === "max_age") {
            const parsed = Number.parseInt(value, 10);

            maxAge = Number.isNaN(parsed) ? undefined : parsed;
        } else if (key === "mx" && value.length > 0) {
            mx.push(value);
        }
    }

    return {
        maxAge,
        mode,
        mx,
        valid: version === "STSv1" && mode !== undefined && maxAge !== undefined,
        version,
    };
};

/**
 * Input for {@link buildMtaStsPolicy}.
 */
export interface MtaStsPolicyInput {
    /**
     * Maximum policy lifetime in seconds (`max_age`), e.g. `604800` (one week).
     */
    maxAge: number;

    /**
     * Enforcement mode.
     */
    mode: "enforce" | "none" | "testing";

    /**
     * Allowed MX host patterns (a leading `*.` wildcard is permitted).
     */
    mx: string[];
}

/**
 * Generates an MTA-STS policy file to serve at `https://mta-sts.&lt;domain>/.well-known/mta-sts.txt`.
 * @param input The policy contents. See {@link MtaStsPolicyInput}.
 * @returns The policy file text (CRLF-terminated lines, per RFC 8461).
 */
export const buildMtaStsPolicy = (input: MtaStsPolicyInput): string => {
    if (!MTA_STS_MODES.has(input.mode)) {
        throw new TypeError("buildMtaStsPolicy: `mode` must be one of \"enforce\", \"testing\", or \"none\"");
    }

    if (!Number.isInteger(input.maxAge) || input.maxAge < 0) {
        throw new TypeError("buildMtaStsPolicy: `maxAge` must be a non-negative integer");
    }

    const mx = input.mx.map((host) => host.trim());

    if (mx.length === 0 || mx.some((host) => host.length === 0)) {
        throw new TypeError("buildMtaStsPolicy: `mx` must contain at least one non-empty host");
    }

    const lines = ["version: STSv1", `mode: ${input.mode}`, ...mx.map((host) => `mx: ${host}`), `max_age: ${String(input.maxAge)}`];

    return `${lines.join("\r\n")}\r\n`;
};
