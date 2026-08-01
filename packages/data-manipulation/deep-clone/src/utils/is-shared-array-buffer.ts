/**
 * Capability-detecting `SharedArrayBuffer` check.
 *
 * `SharedArrayBuffer` is not exposed in every runtime: browsers only define it on
 * cross-origin-isolated pages, and edge runtimes may omit it entirely. A bare
 * `value instanceof SharedArrayBuffer` therefore throws — `ReferenceError` where
 * the global is absent outright, `TypeError: Right-hand side of 'instanceof' is
 * not an object` where a shim leaves it defined-but-undefined. Because the check
 * sits on the typed-array and `DataView` paths, either one would break cloning
 * any binary value at all, rather than only the shared ones it is meant to reject.
 * @param value The value to test.
 * @returns `true` only when the runtime exposes `SharedArrayBuffer` and `value` is one.
 */
const isSharedArrayBuffer = (value: unknown): value is SharedArrayBuffer => typeof SharedArrayBuffer === "function" && value instanceof SharedArrayBuffer;

export default isSharedArrayBuffer;
