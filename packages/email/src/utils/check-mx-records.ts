import { resolveMx } from "node:dns/promises";

/**
 * MX record information.
 */
interface MxRecord {
    exchange: string;
    priority: number;
}

/**
 * Result of MX record check.
 */
interface MxCheckResult {
    error?: string;
    records?: MxRecord[];
    valid: boolean;
}

/**
 * Checks MX records for a domain.
 * @param domain The domain to check MX records for.
 * @returns Result containing MX records or error.
 * @example
 * ```ts
 * import { checkMxRecords } from "@visulima/email/utils/check-mx-records";
 *
 * const result = await checkMxRecords("example.com");
 * if (result.valid) {
 *     console.log("MX records:", result.records);
 * }
 * ```
 */
const checkMxRecords = async (domain: string): Promise<MxCheckResult> => {
    try {
        const records = await resolveMx(domain);
        const mxRecords: MxRecord[] = records.map((record) => {
            return {
                exchange: record.exchange,
                priority: record.priority,
            };
        });

        return {
            records: mxRecords.toSorted((a, b) => a.priority - b.priority),
            valid: mxRecords.length > 0,
        };
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : String(error),
            valid: false,
        };
    }
};

export default checkMxRecords;
export type { MxCheckResult, MxRecord };
