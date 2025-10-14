const primitiveTypes = new Set(["boolean", "number", "string"]);

const isPrimitive = (value: unknown): boolean => primitiveTypes.has(typeof value);

export default isPrimitive;
