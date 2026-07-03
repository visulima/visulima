/**
 * Zero-dependency implementation of the Package URL (PURL) spec, scoped
 * to the `pkg:npm/…` type — the only scheme CycloneDX 1.7 needs for
 * npm-ecosystem SBOMs.
 *
 * Reference: https://github.com/package-url/purl-spec/blob/master/PURL-TYPES.rst#npm
 *
 * Rules we implement:
 *
 * 1. The `name` segment is **lowercased** for `pkg:npm` (npm package
 *    names are already case-insensitive in the registry).
 * 2. Scope is carried as a PURL **namespace** (`pkg:npm/@scope/name`)
 *    with the `@` percent-encoded per RFC 3986 (→ `%40`).
 * 3. `name`, `namespace`, and `version` segments are percent-encoded
 *    using the "unreserved characters + colon/slash inside version"
 *    ruleset — we keep this small and conservative (encode anything
 *    outside `[A-Za-z0-9._~-]`).
 */

/**
 * Percent-encode the subset of ASCII we need for PURL segments. npm
 * package names and version strings are ASCII-only per the registry
 * spec, so we never need the multi-byte UTF-8 path.
 */
const encodeSegment = (input: string): string =>
    input.replaceAll(/[^\w.~-]/g, (char) => {
        const codePoint = char.codePointAt(0) ?? 0;

        return `%${codePoint.toString(16).toUpperCase().padStart(2, "0")}`;
    });

/**
 * Builds a `pkg:npm/…` Package URL from an npm package name + version.
 * @param packageName The npm package name, scoped or unscoped.
 * @param version The resolved exact version.
 * @returns A well-formed PURL string.
 */
export const toNpmPurl = (packageName: string, version: string): string => {
    const lowered = packageName.toLowerCase();

    if (lowered.startsWith("@")) {
        const slashIndex = lowered.indexOf("/");

        if (slashIndex > 0) {
            const namespace = lowered.slice(0, slashIndex);
            const name = lowered.slice(slashIndex + 1);

            return `pkg:npm/${encodeSegment(namespace)}/${encodeSegment(name)}@${encodeSegment(version)}`;
        }
    }

    return `pkg:npm/${encodeSegment(lowered)}@${encodeSegment(version)}`;
};
