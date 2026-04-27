/**
 * Typosquat detection for package names.
 *
 * Uses a curated blocklist of known typosquats (data/typosquats.json) and
 * runtime heuristics (character substitution, transposition, omission) to
 * warn users before they install a potentially malicious package.
 */

import { createInterface } from "node:readline";

import { red, yellow } from "@visulima/colorize";
import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import blocklistData from "../data/typosquats.json" with { type: "json" };
import { warn } from "./output";

// ── Types ───────────────────────────────────────────────────────────

export type Blocklist = Record<string, string[]>;

export interface TyposquatMatch {
    /** The package name that was checked. */
    input: string;
    /** The legitimate package this appears to be a typosquat of. */
    legitimate: string;
    /** How the match was detected: "blocklist" (exact match in JSON) or "heuristic" (generated variant). */
    method: "blocklist" | "heuristic";
}

export interface TyposquatCheckResult {
    /** Whether the operation should proceed. */
    ok: boolean;

    /**
     * The (possibly corrected) package names to use.
     * When the user chooses "use suggested name", the typosquat names are
     * replaced with their legitimate counterparts.
     */
    packages: string[];
}

// ── Homoglyph / keyboard-proximity substitutions ────────────────────

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

// ── Variant generation ─────────────────────────────────────────────

/**
 * Generates typosquat variants of a package name using common attack patterns:
 * - Character omission (dropping one character)
 * - Adjacent character transposition (swapping neighbors)
 * - Character duplication (repeating one character)
 * - Homoglyph / keyboard substitution
 * - Separator manipulation (dash/dot/underscore swaps)
 * - Common suffixes (-js, -node)
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
        const isSeparator = name[i] === "-" || name[i] === "." || name[i] === "_";

        // Character omission (skip separators)
        if (!isSeparator) {
            variants.add(name.slice(0, i) + name.slice(i + 1));
        }

        // Character duplication (skip separators)
        if (!isSeparator) {
            variants.add(name.slice(0, i) + name[i] + name.slice(i));
        }

        // Adjacent transposition (skip when either char is a separator)
        if (i < name.length - 1 && name[i] !== name[i + 1]) {
            const nextIsSeparator = name[i + 1] === "-" || name[i + 1] === "." || name[i + 1] === "_";

            if (!isSeparator && !nextIsSeparator) {
                const chars = name.split("");

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

    variants.delete(name);

    return variants;
};

// ── Blocklist loading ───────────────────────────────────────────────

let cachedBlocklist: Blocklist | undefined;
let cachedReverseLookup: Map<string, string> | undefined;

const loadBlocklist = (): Blocklist => {
    if (!cachedBlocklist) {
        cachedBlocklist = blocklistData as Blocklist;
    }

    return cachedBlocklist;
};

/** Reverse lookup: typosquat name -> legitimate package name (O(1) per check). */
const getReverseLookup = (): Map<string, string> => {
    if (!cachedReverseLookup) {
        cachedReverseLookup = new Map<string, string>();

        for (const [legitimate, typosquats] of Object.entries(loadBlocklist())) {
            for (const typo of typosquats) {
                cachedReverseLookup.set(typo, legitimate);
            }
        }
    }

    return cachedReverseLookup;
};

// ── Detection ──────────────────────────────────────────────────────

/** Strip scope from a package name (e.g. "@scope/foo" -> "foo"). */
const bareName = (packageName: string): string => (packageName.startsWith("@") ? (packageName.split("/")[1] ?? packageName) : packageName);

/**
 * Check a single package name against the typosquat blocklist.
 * Returns a match if the name is a known typosquat, or `undefined` if safe.
 */
export const checkTyposquat = (packageName: string): TyposquatMatch | undefined => {
    const bare = bareName(packageName);

    // 1. Direct blocklist lookup (fast path)
    const blocklisted = getReverseLookup().get(bare);

    if (blocklisted) {
        return { input: packageName, legitimate: blocklisted, method: "blocklist" };
    }

    // 2. Heuristic: check if this name is a generated variant of any known package
    for (const legitimate of Object.keys(loadBlocklist())) {
        if (generateVariants(legitimate).has(bare)) {
            return { input: packageName, legitimate, method: "heuristic" };
        }
    }

    return undefined;
};

/** Check multiple package names. Returns only the matches (empty if all safe). */
export const checkTyposquats = (packageNames: string[], allowlist?: string[]): TyposquatMatch[] => {
    const allowed = allowlist ? new Set(allowlist) : undefined;
    const matches: TyposquatMatch[] = [];

    for (const name of packageNames) {
        if (allowed?.has(name)) {
            continue;
        }

        const match = checkTyposquat(name);

        if (match) {
            matches.push(match);
        }
    }

    return matches;
};

// ── Shared helpers ─────────────────────────────────────────────────

/** Print typosquat warnings to stderr. */
const printTyposquatWarnings = (matches: TyposquatMatch[], context: string): void => {
    warn("");
    warn(red(`Possible typosquat${matches.length === 1 ? "" : "s"} ${context}:`));

    for (const match of matches) {
        const method = match.method === "blocklist" ? "known typosquat" : "similar name";

        warn(`  ${yellow("\u26A0")} ${red(match.input)} \u2014 did you mean ${yellow(match.legitimate)}? (${method})`);
    }

    warn("");
};

/** Prompt user with a question. Returns the lowercased, trimmed answer. Aborts in non-TTY. */
const askConfirmation = async (question: string): Promise<string | undefined> => {
    if (!process.stdin.isTTY) {
        warn("Aborting: potential typosquat detected in non-interactive mode. Use --no-typosquat-check to skip.");

        return undefined;
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });

    const answer = await new Promise<string>((resolve) => {
        rl.question(question, (a) => {
            resolve(a.trim().toLowerCase());
        });
    });

    rl.close();

    return answer;
};

// ── Interactive prompt (for `add`) ─────────────────────────────────

/**
 * Display typosquat warnings and prompt the user.
 *
 * Choices:
 * - **S** (suggested): replace the typosquat names with the correct packages and continue
 * - **y** (yes): continue with the original (potentially dangerous) names
 * - **N** (no, default): abort the operation
 *
 * Non-interactive mode always aborts.
 */
export const runTyposquatCheck = async (packageNames: string[], allowlist?: string[]): Promise<TyposquatCheckResult> => {
    const matches = checkTyposquats(packageNames, allowlist);

    if (matches.length === 0) {
        return { ok: true, packages: packageNames };
    }

    printTyposquatWarnings(matches, "detected");

    const answer = await askConfirmation(
        `Use suggested package${matches.length === 1 ? "" : "s"} instead? [S]uggested / [y]es, keep original / [N]o, abort (default: N) `,
    );

    if (answer === undefined) {
        return { ok: false, packages: packageNames };
    }

    if (answer === "s" || answer === "suggested") {
        const replacements = new Map(matches.map((m) => [m.input, m.legitimate]));
        const corrected = packageNames.map((name) => replacements.get(name) ?? name);

        return { ok: true, packages: corrected };
    }

    if (answer === "y" || answer === "yes") {
        return { ok: true, packages: packageNames };
    }

    return { ok: false, packages: packageNames };
};

// ── package.json scanning (for `install` / `update`) ───────────────

/**
 * Extract the package name from an alias specifier like "npm:reaact@^18".
 * Returns `undefined` if the value is not an alias.
 */
const ALIAS_RE = /^(?:npm|pnpm|yarn):(.+?)(?:@.*)?$/;

const parseAliasTarget = (value: string): string | undefined => {
    const match = ALIAS_RE.exec(value);

    return match?.[1];
};

/**
 * Reads unique dependency names from a package.json file.
 * Scans dependencies, devDependencies, optionalDependencies, and peerDependencies.
 * Also extracts alias targets (e.g. "npm:reaact@^18" → "reaact").
 */
const readDepsFromPackageJson = (packageJsonPath: string): string[] => {
    if (!isAccessibleSync(packageJsonPath)) {
        return [];
    }

    const pkg = readJsonSync(packageJsonPath) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
    };

    const allDeps: Record<string, string> = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.optionalDependencies,
        ...pkg.peerDependencies,
    };

    const names = new Set<string>();

    for (const [key, value] of Object.entries(allDeps)) {
        names.add(key);

        const aliasTarget = parseAliasTarget(value);

        if (aliasTarget) {
            names.add(aliasTarget);
        }
    }

    return [...names];
};

/**
 * Scan package.json dependencies for potential typosquats.
 *
 * Unlike `runTyposquatCheck` (used by `add`), this cannot replace names because
 * they live in package.json. It warns the user and asks whether to proceed.
 *
 * In non-interactive mode, always aborts.
 * @returns `true` to proceed, `false` to abort.
 */
export const scanDepsForTyposquats = async (cwd: string, allowlist?: string[]): Promise<boolean> => {
    const packageJsonPath = join(cwd, "package.json");
    const depNames = readDepsFromPackageJson(packageJsonPath);

    if (depNames.length === 0) {
        return true;
    }

    const matches = checkTyposquats(depNames, allowlist);

    if (matches.length === 0) {
        return true;
    }

    printTyposquatWarnings(matches, "in package.json dependencies");
    warn("Fix the package name in package.json before proceeding.");

    const answer = await askConfirmation("Continue anyway? [y/N] ");

    return answer === "y" || answer === "yes";
};
