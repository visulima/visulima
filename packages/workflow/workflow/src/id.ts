/**
 * Generate a namespaced, collision-resistant run id using Web Crypto
 * (`crypto.randomUUID`), so the engine stays edge-safe with no `node:*` import.
 * @param namespace A short prefix, typically the workflow id.
 * @returns A new run id like `welcome-email:3f1c…`.
 */
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- Web Crypto global is intentional: keeps the engine edge-safe with no node:crypto import
const generateRunId = (namespace: string): string => `${namespace}:${globalThis.crypto.randomUUID()}`;

export default generateRunId;
