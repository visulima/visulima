/**
 * @packageDocumentation
 * Type guard to check whether a value is a non‑array object (record).
 */
const isRecord = (x: unknown): x is Record<any, any> => x !== null && typeof x === "object" && !Array.isArray(x);

export default isRecord;
