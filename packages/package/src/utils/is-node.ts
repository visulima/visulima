const isNode: boolean = typeof process < "u" && typeof process.stdout < "u" && !process.versions.deno && !globalThis.window;

export default isNode;
