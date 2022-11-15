const primitiveTypes = new Set(["string", "boolean", "number"]);

const isPrimitive = (value: any): boolean => primitiveTypes.has(typeof value);

export default isPrimitive;
