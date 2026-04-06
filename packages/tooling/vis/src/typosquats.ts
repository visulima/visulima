/**
 * Typosquat detection for package names.
 *
 * Uses a curated blocklist of known typosquats (data/typosquats.json) and
 * runtime heuristics (character substitution, transposition, omission) to
 * warn users before they install a potentially malicious package.
 */

import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { red, yellow } from "@visulima/colorize";

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
 * Separators (`-` and `.`) are preserved during omission and duplication passes.
 * Names shorter than 3 characters return an empty set.
 *
 * @param name - The package name to generate variants for.
 * @returns A set of unique variant strings (never includes the original name).
 */
export const generateVariants = (name: string): Set<string> => {
    const variants = new Set<string>();

    if (name.length < 3) {
        return variants;
    }

    for (let i = 0; i < name.length; i++) {
        const isSeparator = name[i] === "-" || name[i] === ".";

        // Character omission (skip separators)
        if (!isSeparator) {
            variants.add(name.slice(0, i) + name.slice(i + 1));
        }

        // Character duplication (skip separators)
        if (!isSeparator) {
            variants.add(name.slice(0, i) + name[i] + name.slice(i));
        }

        // Adjacent transposition
        if (i < name.length - 1 && name[i] !== name[i + 1]) {
            const chars = name.split("");

            [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
            variants.add(chars.join(""));
        }

        // Homoglyph substitution
        const ch = name[i].toLowerCase();
        const subs = SUBSTITUTIONS[ch];

        if (subs) {
            for (const replacement of subs) {
                variants.add(name.slice(0, i) + replacement + name.slice(i + 1));
            }
        }
    }

    // Separator manipulation
    if (name.includes("-")) {
        variants.add(name.replace(/-/g, ""));
        variants.add(name.replace(/-/g, "."));
        variants.add(name.replace(/-/g, "_"));
    } else if (name.length > 5) {
        for (let i = 2; i < name.length - 2; i++) {
            variants.add(name.slice(0, i) + "-" + name.slice(i));
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
        const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), "../data/typosquats.json");

        cachedBlocklist = JSON.parse(readFileSync(dataPath, "utf8")) as Blocklist;
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
const bareName = (packageName: string): string =>
    packageName.startsWith("@") ? packageName.split("/")[1] ?? packageName : packageName;

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
export const checkTyposquats = (packageNames: string[]): TyposquatMatch[] => {
    const matches: TyposquatMatch[] = [];

    for (const name of packageNames) {
        const match = checkTyposquat(name);

        if (match) {
            matches.push(match);
        }
    }

    return matches;
};

// ── Interactive prompt ─────────────────────────────────────────────

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
export const runTyposquatCheck = async (packageNames: string[]): Promise<TyposquatCheckResult> => {
    const matches = checkTyposquats(packageNames);

    if (matches.length === 0) {
        return { ok: true, packages: packageNames };
    }

    warn("");
    warn(red(`Possible typosquat${matches.length === 1 ? "" : "s"} detected:`));

    for (const match of matches) {
        const method = match.method === "blocklist" ? "known typosquat" : "similar name";

        warn(`  ${yellow("\u26A0")} ${red(match.input)} \u2014 did you mean ${yellow(match.legitimate)}? (${method})`);
    }

    warn("");

    // Non-interactive: always block
    if (!process.stdin.isTTY) {
        warn("Aborting: potential typosquat detected in non-interactive mode. Use --no-typosquat-check to skip.");

        return { ok: false, packages: packageNames };
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });

    const answer = await new Promise<string>((resolve) => {
        rl.question(
            `Use suggested package${matches.length === 1 ? "" : "s"} instead? [S]uggested / [y]es, keep original / [N]o, abort (default: N) `,
            (a) => {
                resolve(a.trim().toLowerCase());
            },
        );
    });

    rl.close();

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
