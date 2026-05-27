/**
 * Identifier for the upload protocol the fingerprint scopes to.
 * Two uploads of the same file to the same endpoint must hash to
 * different values if they use different protocols, so each adapter
 * can only ever resume its own state.
 */
export type FingerprintProtocol = "chunked-rest" | "tus";

export interface FingerprintInput {
    endpoint: string;
    file: File;
    protocol: FingerprintProtocol;
}

export type FingerprintFn = (input: FingerprintInput) => Promise<string> | string;

/**
 * Default fingerprint format — matches tus-js-client's `${name}-${size}-${type}-${lastModified}`
 * shape, prefixed with the protocol + endpoint so the same file uploaded to two different
 * servers (or via two different protocols) does not collide in shared storage.
 *
 * User-controlled string fields (endpoint, file.name, file.type) are percent-encoded so a `::`
 * embedded in any of them cannot collide with the `::` delimiter.
 */
export const defaultFingerprint: FingerprintFn = ({ endpoint, file, protocol }) =>
    `${protocol}::${encodeURIComponent(endpoint)}::${encodeURIComponent(file.name)}::${String(file.size)}::${encodeURIComponent(file.type)}::${String(file.lastModified)}`;
