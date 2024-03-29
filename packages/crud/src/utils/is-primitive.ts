const primitiveTypes = new Set(["string", "boolean", "number"]);

const isPrimitive = (value: unknown): boolean => primitiveTypes.has(typeof value);

export default isPrimitive;
