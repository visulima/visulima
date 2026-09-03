/**
 * Pure typosquat-variant generation.
 *
 * Kept free of workspace imports so `scripts/sync-blocklist.ts` can run it
 * straight from source on a bare `pnpm install`, without every workspace
 * dependency of `typosquats.ts` having been built first.
 */

const SUBSTITUTIONS: Record<string, string[]> = {
    a: ["4", "e"],
    b: ["d"],
    d: ["b"],
    e: ["3", "a"],
    g: ["9", "q"],
    i: ["1", "l"],
    l: ["1", "i"],
    m: ["n"],
    n: ["m"],
    o: ["0"],
    s: ["5", "z"],
    t: ["7"],
    u: ["v"],
    v: ["u"],
};

// Suffixes commonly appended by brand-jacks of scoped packages.
// e.g. `@tanstack/start` → `tanstack-app`, `start-tanstack-app`.
const SCOPED_BRAND_SUFFIXES = ["app", "cli", "core", "kit", "lib", "pkg", "sdk"];

/**
 * Generates typosquat variants of a package name using common attack patterns:
 * - Character omission (dropping one character)
 * - Adjacent character transposition (swapping neighbors)
 * - Character duplication (repeating one character)
 * - Homoglyph / keyboard substitution
 * - Separator manipulation (dash/dot/underscore swaps)
 * - Common suffixes (-js, -node) for unscoped names
 * - Scoped-package brand-jacks (`@scope/name` → `scope`, `scope-name`,
 *   `name-scope`, `scope-app`, `name-scope-app`, …)
 *
 * Separators (`-`, `.`, `_`) are preserved during omission and duplication passes.
 * Transposition is skipped when either character is a separator.
 * Names shorter than 3 characters return an empty set.
 * @param name The package name to generate variants for.
 * @returns A set of unique variant strings (never includes the original name).
 */
export const generateVariants = (name: string): Set<string> => {
    const variants = new Set<string>();

    if (name.length < 3) {
        return variants;
    }

    for (let i = 0; i < name.length; i++) {
        const char = name[i] as string;
        const isSeparator = char === "-" || char === "." || char === "_";

        // Character omission (skip separators)
        if (!isSeparator) {
            variants.add(name.slice(0, i) + name.slice(i + 1));
        }

        // Character duplication (skip separators)
        if (!isSeparator) {
            variants.add(name.slice(0, i) + char + name.slice(i));
        }

        // Adjacent transposition (skip when either char is a separator)
        if (i < name.length - 1 && name[i] !== name[i + 1]) {
            const nextIsSeparator = name[i + 1] === "-" || name[i + 1] === "." || name[i + 1] === "_";

            if (!isSeparator && !nextIsSeparator) {
                // eslint-disable-next-line @typescript-eslint/no-misused-spread -- typosquat domain is ASCII identifiers; UTF-16 code units are correct for character-level transposition
                const chars = [...name];

                [chars[i], chars[i + 1]] = [chars[i + 1] as string, chars[i] as string];
                variants.add(chars.join(""));
            }
        }

        // Homoglyph substitution
        const ch = (name[i] as string).toLowerCase();
        const subs = SUBSTITUTIONS[ch];

        if (subs) {
            for (const replacement of subs) {
                variants.add(name.slice(0, i) + replacement + name.slice(i + 1));
            }
        }
    }

    // Separator manipulation: replace all separators with each alternative
    const SEP_RE = /[-._]/g;
    const hasSeparator = SEP_RE.test(name);

    if (hasSeparator) {
        variants.add(name.replaceAll(SEP_RE, "")); // remove all
        variants.add(name.replaceAll(SEP_RE, "-")); // all hyphens
        variants.add(name.replaceAll(SEP_RE, ".")); // all dots
        variants.add(name.replaceAll(SEP_RE, "_")); // all underscores
    } else if (name.length > 5) {
        for (let i = 2; i < name.length - 2; i++) {
            variants.add(`${name.slice(0, i)}-${name.slice(i)}`);
            variants.add(`${name.slice(0, i)}.${name.slice(i)}`);
            variants.add(`${name.slice(0, i)}_${name.slice(i)}`);
        }
    }

    // Common suffixes
    if (!name.startsWith("@")) {
        variants.add(`${name}-js`);
        variants.add(`${name}js`);
        variants.add(`${name}-node`);
    }

    // Scoped-package brand-jacks: `@scope/sub` → `scope`, `scope-sub`,
    // `sub-scope`, `scope-app`, `sub-scope-app`, …
    // The `sub` part alone is intentionally omitted — it is often too generic
    // (e.g. `start`, `core`) and would cause heuristic false positives.
    if (name.startsWith("@")) {
        const slash = name.indexOf("/");

        if (slash > 1 && slash < name.length - 1) {
            const scope = name.slice(1, slash);
            const sub = name.slice(slash + 1);

            if (scope.length >= 3) {
                variants.add(scope);
            }

            for (const sep of ["", "-", ".", "_"]) {
                variants.add(`${scope}${sep}${sub}`);
                variants.add(`${sub}${sep}${scope}`);
            }

            for (const suffix of SCOPED_BRAND_SUFFIXES) {
                variants.add(`${scope}-${suffix}`);
                variants.add(`${sub}-${scope}-${suffix}`);
                variants.add(`${suffix}-${scope}-${sub}`);
            }
        }
    }

    variants.delete(name);

    return variants;
};
