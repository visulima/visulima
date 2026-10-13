/**
 * Organization templates: `vis create &lt;scope>` and `vis create &lt;scope>:&lt;name>`.
 *
 * The `&lt;scope>/create` package may declare a `createConfig.templates` manifest (an array or a
 * map of `{ name, description, source }` entries). The manifest is untrusted
 * remote data: it is validated strictly and every accepted entry is only routed
 * to the existing template executors. Nothing from it is executed directly.
 *
 * Without a manifest, a bare scope runs `&lt;scope>/create` as an ordinary create-* package.
 */

import { bold, cyan, dim } from "@visulima/colorize";

import { VisUserError } from "../../errors/vis-user-error";
import { pail } from "../../io/logger";
import { getRegistryForPackage, loadNpmrc } from "../../util/catalog";
import { resolveGitSource } from "../../util/git-source";
import { runTemplatePicker } from "./prompts";
import type { TemplateConfig } from "./templates/types";

export const MAX_ORG_TEMPLATES = 50;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_SOURCE_LENGTH = 300;
const MAX_MANIFEST_CHARS = 256 * 1024;
const REGISTRY_TIMEOUT_MS = 10_000;

/** Template names: lowercase, no separators or `:` (keeps `vis:` and provider prefixes out), no leading `_`, `-` or `.`. */
const TEMPLATE_NAME = /^[a-z0-9][a-z0-9._-]*$/;
/** Bare `@org` or `@org:name`. */
const ORG_INPUT = /^@([a-z0-9][a-z0-9._~-]*)(?::([a-z0-9][a-z0-9._-]*))?$/;
const NPM_PACKAGE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
/** One path segment inside a package: no `.`/`..`, no leading dot, no separators other than `/`. */
const PATH_SEGMENT = /^\w[\w.-]*$/;
/** Git sources must resolve to one of the known providers (raw `git:` clones and http tarballs are refused). */
const GIT_PROVIDER = /^(?:github|gh|gitlab|bitbucket|sourcehut):/;

export type OrgTemplateSource = { kind: "bundled"; path: string } | { kind: "git"; url: string } | { kind: "npm"; package: string };

export interface OrgTemplate {
    description: string;
    name: string;
    source: OrgTemplateSource;
}

export interface OrgManifest {
    /** `https` tarball URL of the `@org/create` version that carried the manifest (used for bundled templates). */
    tarball?: string;
    templates: OrgTemplate[];
}

export interface OrgChoice {
    config: TemplateConfig;
    /** Template name, used as the default project name. */
    name?: string;
}

const invalid = (message: string): VisUserError => new VisUserError(`Invalid organization template manifest: ${message}`);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * True when the input names an organization scope (`@org` or `@org:name`).
 * @param input Raw template input.
 * @returns Whether the input should go through the organization flow.
 */
export const isOrgInput = (input: string): boolean => ORG_INPUT.test(input);

const parseDescription = (raw: unknown): string => {
    if (typeof raw !== "string") {
        throw invalid("every template needs a string description");
    }

    // Terminal control characters (ESC, C1 range, ...) must not reach the picker or the list output.
    const description = raw.replaceAll(/\p{Cc}/gu, "").trim();

    if (description.length === 0 || description.length > MAX_DESCRIPTION_LENGTH) {
        throw invalid(`descriptions must be 1-${MAX_DESCRIPTION_LENGTH} characters`);
    }

    return description;
};

const parsePathSource = (raw: unknown): string => {
    if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_SOURCE_LENGTH) {
        throw invalid("bundled source path must be a non-empty string");
    }

    const segments = raw.split("/");

    if (!segments.every((segment) => PATH_SEGMENT.test(segment))) {
        throw invalid(`bundled source path "${raw}" must be relative and contain only plain segments`);
    }

    return segments.join("/");
};

const parseSource = (raw: unknown): OrgTemplateSource => {
    if (!isRecord(raw)) {
        throw invalid("every template needs a source object");
    }

    switch (raw.kind) {
        case "bundled": {
            return { kind: "bundled", path: parsePathSource(raw.path) };
        }
        case "git": {
            const { url } = raw;

            if (typeof url !== "string" || url.length > MAX_SOURCE_LENGTH || /\s/.test(url) || url.startsWith("-")) {
                throw invalid("git source url is malformed");
            }

            const resolved = resolveGitSource(url);

            // A `gitlab://host/...` source would send the user's GitLab token to a host the manifest picked.
            if (!GIT_PROVIDER.test(resolved.source) || resolved.gitlabUrl !== undefined) {
                throw invalid(`git source "${url}" must use github, gitlab, bitbucket or sourcehut on the default host`);
            }

            return { kind: "git", url };
        }
        case "npm": {
            const { package: pkg } = raw;

            if (typeof pkg !== "string" || pkg.length > MAX_SOURCE_LENGTH || !NPM_PACKAGE.test(pkg)) {
                throw invalid("npm source must be a plain package name (no version, no flags)");
            }

            return { kind: "npm", package: pkg };
        }
        default: {
            throw invalid(`unknown source kind "${String(raw.kind)}" (expected npm, git or bundled)`);
        }
    }
};

/**
 * Validate a `createConfig.templates` value. Accepts the array form (`[{ name, description, source }]`)
 * and the map form (`{ name: { description, source } }`). Any invalid entry rejects the whole manifest.
 * @param raw The untrusted `templates` value from the package manifest.
 * @returns The validated template entries.
 * @throws {VisUserError} When the manifest is malformed.
 */
export const parseOrgTemplates = (raw: unknown): OrgTemplate[] => {
    let entries: [unknown, unknown][];

    if (Array.isArray(raw)) {
        if (raw.length > MAX_ORG_TEMPLATES) {
            throw invalid(`at most ${MAX_ORG_TEMPLATES} templates are allowed`);
        }

        entries = raw.map((value) => [isRecord(value) ? value.name : undefined, value]);
    } else if (isRecord(raw)) {
        if (Object.keys(raw).length > MAX_ORG_TEMPLATES) {
            throw invalid(`at most ${MAX_ORG_TEMPLATES} templates are allowed`);
        }

        entries = Object.entries(raw);
    } else {
        throw invalid("templates must be an array or an object");
    }

    const seen = new Set<string>();

    return entries.map(([name, value]) => {
        if (typeof name !== "string" || name.length > MAX_NAME_LENGTH || !TEMPLATE_NAME.test(name)) {
            throw invalid(`template name ${JSON.stringify(name)} must match ${TEMPLATE_NAME.source} (max ${MAX_NAME_LENGTH})`);
        }

        if (seen.has(name)) {
            throw invalid(`duplicate template name "${name}"`);
        }

        seen.add(name);

        if (!isRecord(value)) {
            throw invalid(`template "${name}" must be an object`);
        }

        return { description: parseDescription(value.description), name, source: parseSource(value.source) };
    });
};

/**
 * Turn a validated entry into the executor config. Bundled entries are routed to the
 * package tarball that carried the manifest, never to a URL taken from the manifest.
 * @param template Validated template entry.
 * @param manifest Manifest the entry came from.
 * @param args Extra CLI arguments to forward.
 * @returns Template config for the existing executors.
 */
export const orgTemplateConfig = (template: OrgTemplate, manifest: OrgManifest, args: string[]): TemplateConfig => {
    const { source } = template;

    switch (source.kind) {
        case "bundled": {
            if (!manifest.tarball) {
                throw invalid(`bundled template "${template.name}" needs a https dist.tarball for its package`);
            }

            return { args, source: manifest.tarball, subdir: source.path, type: "remote:bundled" };
        }
        case "git": {
            return { args, source: source.url, type: "remote:git" };
        }
        case "npm": {
            return { args, source: source.package, type: "remote:npm" };
        }
        default: {
            throw invalid(`unknown source kind for "${template.name}"`);
        }
    }
};

const readManifest = async (scope: string, cwd: string): Promise<OrgManifest | undefined> => {
    const packageName = `${scope}/create`;
    const registry = getRegistryForPackage(packageName, loadNpmrc(cwd));
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, REGISTRY_TIMEOUT_MS);

    let body: string;

    try {
        // npm clients encode only the scope separator: `@scope%2Fname`.
        const response = await fetch(`${registry.url.replace(/\/+$/, "")}/${packageName.replace("/", "%2F")}/latest`, {
            headers: {
                accept: "application/json",
                ...(registry.token ? { authorization: `Bearer ${registry.token}` } : {}),
            },
            signal: controller.signal,
        });

        // No such package: the org has no create package, so there is no manifest.
        if (response.status === 404) {
            return undefined;
        }

        if (!response.ok) {
            throw new Error(`registry responded ${String(response.status)} for ${packageName}`);
        }

        body = await response.text();
    } finally {
        clearTimeout(timeout);
    }

    if (body.length > MAX_MANIFEST_CHARS) {
        throw invalid("package manifest is too large");
    }

    const pkg: unknown = JSON.parse(body);

    if (!isRecord(pkg) || !isRecord(pkg.createConfig) || pkg.createConfig.templates === undefined) {
        return undefined;
    }

    const templates = parseOrgTemplates(pkg.createConfig.templates);
    const tarball = isRecord(pkg.dist) && typeof pkg.dist.tarball === "string" && /^https:\/\//.test(pkg.dist.tarball) ? pkg.dist.tarball : undefined;

    return { tarball, templates };
};

const printTemplates = (scope: string, templates: OrgTemplate[]): void => {
    pail.info("");
    pail.info(`  ${scope} templates:`);

    for (const template of templates) {
        pail.info(`    ${bold(cyan(`${scope}:${template.name}`))}  ${dim(template.description)}`);
    }

    pail.info("");
};

/**
 * Resolve `@org` / `@org:name` to an executor config.
 *
 * - No `@org/create` manifest: falls back to running `@org/create` as a create-* package.
 * - `list`: prints the manifest (or a note) and returns `undefined`.
 * - `@org:name`: selects that entry directly.
 * - Otherwise: opens the picker when `interactive`, or prints the list and throws.
 * @param input Raw `@org` or `@org:name` input.
 * @param options Resolution options.
 * @param options.args Extra CLI arguments to forward to the template.
 * @param options.cwd Directory used to locate `.npmrc` registry settings.
 * @param options.interactive Whether a picker may be shown.
 * @param options.list Only print the templates.
 * @returns The chosen config, or `undefined` when only listing.
 */
export const resolveOrgTemplate = async (
    input: string,
    options: { args: string[]; cwd: string; interactive: boolean; list?: boolean },
): Promise<OrgChoice | undefined> => {
    const match = ORG_INPUT.exec(input);

    if (!match) {
        throw new VisUserError(`"${input}" is not an organization template.`);
    }

    const scope = `@${match[1] as string}`;
    const wanted = match[2];
    const manifest = await readManifest(scope, options.cwd);

    if (!manifest) {
        if (options.list) {
            pail.info(`${scope}/create has no createConfig.templates manifest. "vis create ${scope}" runs it as a template.`);

            return undefined;
        }

        if (wanted) {
            throw new VisUserError(`${scope}/create has no createConfig.templates manifest, so "${scope}:${wanted}" cannot be resolved.`);
        }

        return { config: { args: options.args, source: `${scope}/create`, type: "remote:npm" }, name: scope.slice(1) };
    }

    if (options.list) {
        printTemplates(scope, manifest.templates);

        return undefined;
    }

    if (wanted) {
        const template = manifest.templates.find((entry) => entry.name === wanted);

        if (!template) {
            throw new VisUserError(`${scope} has no template "${wanted}". Available: ${manifest.templates.map((entry) => entry.name).join(", ")}`);
        }

        return { config: orgTemplateConfig(template, manifest, options.args), name: template.name };
    }

    if (!options.interactive) {
        printTemplates(scope, manifest.templates);

        throw new VisUserError(`Choose a template in non-interactive mode: vis create ${scope}:<name>`);
    }

    const picked = await runTemplatePicker(
        `${scope} templates`,
        manifest.templates.map((entry) => { return { hint: entry.description, label: entry.name, value: entry.name }; }),
    );
    const template = manifest.templates.find((entry) => entry.name === picked) as OrgTemplate;

    return { config: orgTemplateConfig(template, manifest, options.args), name: template.name };
};
