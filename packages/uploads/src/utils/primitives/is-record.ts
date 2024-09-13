const isRecord = (x: unknown): x is Record<any, any> => x !== null && typeof x === "object" && !Array.isArray(x);

export default isRecord;
