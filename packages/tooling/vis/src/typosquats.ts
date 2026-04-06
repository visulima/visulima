/**
 * Typosquat detection for package names.
 *
 * Uses a curated blocklist of known typosquats (data/typosquats.json) and
 * runtime heuristics (character substitution, transposition, omission) to
 * warn users before they install a potentially malicious package.
 */

import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

import { red, yellow } from "@visulima/colorize";

import { warn } from "./output";

// ── Blocklist loading ───────────────────────────────────────────────

type Blocklist = Record<string, string[]>;

let cachedBlocklist: Blocklist | undefined;
let cachedReverseLookup: Map<string, string> | undefined;

const loadBlocklist = (): Blocklist => {
    if (cachedBlocklist) {
        return cachedBlocklist;
    }

    const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), "../data/typosquats.json");

    cachedBlocklist = JSON.parse(readFileSync(dataPath, "utf8")) as Blocklist;

    return cachedBlocklist;
};

/**
 * Builds a reverse lookup: typosquat name → legitimate package name.
 * This is the primary check — O(1) per package name.
 */
const getReverseLookup = (): Map<string, string> => {
    if (cachedReverseLookup) {
        return cachedReverseLookup;
    }

    const blocklist = loadBlocklist();

    cachedReverseLookup = new Map<string, string>();

    for (const [legitimate, typosquats] of Object.entries(blocklist)) {
        for (const typo of typosquats) {
            cachedReverseLookup.set(typo, legitimate);
        }
    }

    return cachedReverseLookup;
};

// ── Heuristic similarity detection ─────────────────────────────────

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

/**
 * Generates typosquat variants of a package name using common attack patterns:
 * - Character omission (dropping one character)
 * - Adjacent character transposition (swapping neighbors)
 * - Character duplication (repeating one character)
 * - Homoglyph / keyboard substitution
 * - Separator manipulation (dash/dot/underscore swaps)
 * - Common suffixes (-js, -node)
 */
const generateVariants = (name: string): Set<string> => {
    const variants = new Set<string>();

    if (name.length < 3) {
        return variants;
    }

    // Character omission
    for (let i = 0; i < name.length; i++) {
        if (name[i] === "-" || name[i] === ".") {
            continue;
        }

        variants.add(name.slice(0, i) + name.slice(i + 1));
    }

    // Adjacent transposition
    for (let i = 0; i < name.length - 1; i++) {
        if (name[i] === name[i + 1]) {
            continue;
        }

        const chars = name.split("");

        [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
        variants.add(chars.join(""));
    }

    // Character duplication
    for (let i = 0; i < name.length; i++) {
        if (name[i] === "-" || name[i] === ".") {
            continue;
        }

        variants.add(name.slice(0, i) + name[i] + name.slice(i));
    }

    // Homoglyph substitution
    for (let i = 0; i < name.length; i++) {
        const ch = name[i].toLowerCase();

        if (SUBSTITUTIONS[ch]) {
            for (const replacement of SUBSTITUTIONS[ch]) {
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

// ── Public API ──────────────────────────────────────────────────────

export interface TyposquatMatch {
    /** The package name that was checked. */
    input: string;
    /** The legitimate package this appears to be a typosquat of. */
    legitimate: string;
    /** How the match was detected: "blocklist" (exact match in JSON) or "heuristic" (generated variant). */
    method: "blocklist" | "heuristic";
}

/**
 * Check a single package name against the typosquat blocklist.
 * Returns a match if the name is a known typosquat, or `undefined` if it's safe.
 */
export const checkTyposquat = (packageName: string): TyposquatMatch | undefined => {
    // Strip scope for the check (e.g. "@types/react" → "react")
    const bare = packageName.startsWith("@") ? packageName.split("/")[1] ?? packageName : packageName;

    // 1. Direct blocklist lookup (fast path)
    const reverseLookup = getReverseLookup();
    const blocklisted = reverseLookup.get(bare);

    if (blocklisted) {
        return { input: packageName, legitimate: blocklisted, method: "blocklist" };
    }

    // 2. Heuristic: check if this name is a generated variant of any known package
    const blocklist = loadBlocklist();

    for (const legitimate of Object.keys(blocklist)) {
        const variants = generateVariants(legitimate);

        if (variants.has(bare)) {
            return { input: packageName, legitimate, method: "heuristic" };
        }
    }

    return undefined;
};

/**
 * Check multiple package names at once.
 * Returns an array of matches (empty if all names are safe).
 */
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

/**
 * Display typosquat warnings and prompt the user.
 *
 * The user gets three choices:
 * - **S** (suggested): replace the typosquat names with the correct packages and continue
 * - **y** (yes): continue with the original (potentially dangerous) names
 * - **N** (no, default): abort the operation
 *
 * In non-interactive mode the operation is always aborted.
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

    const ask = (question: string): Promise<string> =>
        new Promise((resolve) => {
            rl.question(question, (a) => {
                resolve(a.trim().toLowerCase());
            });
        });

    const answer = await ask(
        `Use suggested package${matches.length === 1 ? "" : "s"} instead? [S]uggested / [y]es, keep original / [N]o, abort (default: N) `,
    );

    rl.close();

    if (answer === "s" || answer === "suggested") {
        // Build a replacement map: typosquat → legitimate
        const replacements = new Map<string, string>();

        for (const match of matches) {
            replacements.set(match.input, match.legitimate);
        }

        const corrected = packageNames.map((name) => replacements.get(name) ?? name);

        return { ok: true, packages: corrected };
    }

    if (answer === "y" || answer === "yes") {
        return { ok: true, packages: packageNames };
    }

    return { ok: false, packages: packageNames };
};

export { generateVariants };
export type { Blocklist };
