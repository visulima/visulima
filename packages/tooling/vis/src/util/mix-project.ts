/**
 * Reads an Elixir `mix.exs` the way vis needs it: the `project/0` keyword list, read
 * by pattern, not evaluated. Mix code can compute any of these values, so every key
 * vis reads must be a literal, or the read fails with `MixProjectError`.
 *
 * - `app:` is the OTP app atom and names the package unless `package: [name: "…"]` does.
 * - `version:` is a string literal, or `\@version` with a literal `\@version "…"` attribute.
 *   A `project/0` without a `version:` key is an aggregate, reported as `version: undefined`.
 * - `apps_path:` marks an umbrella. Its members are the `&lt;apps_path>/*` directories that hold a `mix.exs`.
 * - `{:app, in_umbrella: true}` and `{:app, path: "…"}` entries are returned as `localDeps` (atoms).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export class MixProjectError extends Error {
    public readonly file: string;

    public constructor(file: string, message: string) {
        super(message);
        this.name = "MixProjectError";
        this.file = file;
    }
}

export interface MixVersion {
    /** `attribute`: `version:` names the module attribute, with the value in `\@version "…"`. `literal`: `version: "…"`. */
    kind: "attribute" | "literal";
    /** 1-based line of the literal, in the mix.exs. */
    line: number;
    value: string;
}

export interface MixProject {
    /** The `app:` atom, without the colon. */
    app: string | undefined;
    /** The literal `apps_path:` value, when the project is an umbrella. */
    appsPath: string | undefined;
    isUmbrella: boolean;
    /** Atoms of `in_umbrella: true` and `path:` dependencies. */
    localDeps: string[];
    /** The `package: [name: "…"]` string, when present. */
    packageName: string | undefined;
    /** The version, or undefined for an aggregate with no `version:` key. */
    version: MixVersion | undefined;
}

const lineOf = (raw: string, index: number): number => raw.slice(0, index).split("\n").length;

/** Index of the `]` that closes the `[` at `open`, or the text length when it is never closed. */
const closingBracket = (text: string, open: number): number => {
    let depth = 0;

    for (let index = open; index < text.length; index++) {
        if (text[index] === "[") {
            depth++;
        } else if (text[index] === "]") {
            depth--;

            if (depth === 0) {
                return index;
            }
        }
    }

    return text.length;
};

/** Interpolation (`#{…}`) makes a string Mix evaluates, so it is not a literal vis can read. */
const isPlainText = (text: string): boolean => !text.includes("#{");

/** Parses `raw` as a mix.exs. `file` is only used in error messages. */
export const parseMixProject = (raw: string, file: string): MixProject => {
    const head = /^[ \t]*def project\b[^\n]*\n/m.exec(raw);

    if (head === null) {
        throw new MixProjectError(file, `${file} has no def project/0 that vis can read.`);
    }

    const bodyStart = head.index + head[0].length;
    const rest = raw.slice(bodyStart);
    const nextDef = /^[ \t]*defp?\s/m.exec(rest);
    const body = nextDef === null ? rest : rest.slice(0, nextDef.index);
    const isUmbrella = /\bapps_path:/.test(body);

    let appsPath: string | undefined;

    if (isUmbrella) {
        const literal = /\bapps_path:\s*"([^"]*)"/.exec(body);

        if (literal === null || !isPlainText(literal[1]!)) {
            throw new MixProjectError(file, `${file} sets apps_path to something other than a plain string literal. vis reads only apps_path: "apps".`);
        }

        [, appsPath] = literal;
    }

    const appMatch = /\bapp:\s*:([a-z_]\w*)/.exec(body);

    let packageName: string | undefined;

    if (/\bpackage:/.test(body)) {
        const packageOpen = /\bpackage:\s*\[/.exec(body);

        if (packageOpen === null) {
            throw new MixProjectError(file, `${file} sets package to an expression. vis reads only a package: [name: "…"] keyword list.`);
        }

        const openIndex = packageOpen.index + packageOpen[0].length - 1;
        const segment = body.slice(openIndex, closingBracket(body, openIndex) + 1);
        const nameLiteral = /\bname:\s*"([^"]*)"/.exec(segment);

        if (/\bname:/.test(segment) && (nameLiteral === null || !isPlainText(nameLiteral[1]!))) {
            throw new MixProjectError(file, `${file} sets package name to something other than a plain string literal. vis reads only name: "…".`);
        }

        packageName = nameLiteral?.[1];
    }

    const versionKeys = [...body.matchAll(/\bversion:[ \t]*([^\n,\]]*)/g)];

    if (versionKeys.length > 1) {
        throw new MixProjectError(file, `${file} declares version ${versionKeys.length} times in project/0. vis cannot tell which one applies.`);
    }

    const [key] = versionKeys;
    let version: MixVersion | undefined;

    if (key !== undefined) {
        const value = (key[1] ?? "").trim();
        const keyLine = lineOf(raw, bodyStart + key.index);
        const literal = /^"([^"]*)"$/.exec(value);

        if (literal !== null && isPlainText(literal[1]!)) {
            version = { kind: "literal", line: keyLine, value: literal[1]! };
        } else if (value === "@version") {
            const attributes = [...raw.matchAll(/^[ \t]*@version[ \t]+"([^"]*)"[ \t]*$/gm)];
            const [attribute] = attributes;

            if (attributes.length !== 1 || attribute === undefined || !isPlainText(attribute[1]!)) {
                throw new MixProjectError(file, `${file} uses version: @version but has ${attributes.length} plain @version "…" attributes. vis needs exactly one.`);
            }

            version = { kind: "attribute", line: lineOf(raw, attribute.index), value: attribute[1]! };
        } else {
            throw new MixProjectError(file, `${file} sets version to something other than a plain "…" literal or @version on line ${keyLine}. vis reads only those.`);
        }
    }

    const localDeps = [...raw.matchAll(/\{:([a-z_]\w*),\s*(?:in_umbrella:\s*true|path:\s*"[^"]*")/g)].map((match) => match[1]!);

    return { app: appMatch?.[1], appsPath, isUmbrella, localDeps: [...new Set(localDeps)], packageName, version };
};

/** Reads and parses `&lt;dir>/mix.exs`, or undefined when there is none. */
export const readMixProject = (dir: string): { file: string; project: MixProject; raw: string } | undefined => {
    const file = join(dir, "mix.exs");

    if (!existsSync(file)) {
        return undefined;
    }

    const raw = readFileSync(file, "utf8");

    return { file, project: parseMixProject(raw, file), raw };
};

/** Absolute directories of the umbrella members of `root` (`&lt;apps_path>/*` holding a mix.exs), sorted. */
export const listUmbrellaMembers = (root: string, appsPath: string): string[] => {
    const parent = join(root, appsPath);

    if (!existsSync(parent)) {
        return [];
    }

    return readdirSync(parent, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && existsSync(join(parent, entry.name, "mix.exs")))
        .map((entry) => join(parent, entry.name))
        .sort();
};
