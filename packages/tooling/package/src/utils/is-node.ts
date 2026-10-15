const isNode: boolean = typeof process < "u" && typeof process.stdout < "u" && !globalThis.window;

export default isNode;
