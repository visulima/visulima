import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { dim, green, red, yellow } from "@visulima/colorize";

import { pail } from "../../io/logger";
import { runArchivedRepoMarshall } from "../../security/marshalls/archived-repo";
import { runAuthorMarshall } from "../../security/marshalls/author";
import { runDownloadsMarshall } from "../../security/marshalls/downloads";
import { runExpiredDomainsMarshall } from "../../security/marshalls/expired-domains";
import type { MarshallFinding } from "../../security/marshalls/findings";
import { formatMarshallFindingsAsJson, formatMarshallFindingsAsTable, MarshallFindings } from "../../security/marshalls/findings";
import { runMetadataMarshall } from "../../security/marshalls/metadata";
import { runNewBinMarshall } from "../../security/marshalls/new-bin";
import { getPackument, resolveVersionRange } from "../../security/marshalls/packument";
import { runProvenanceMarshall } from "../../security/marshalls/provenance";
import type { MarshallName } from "../../security/marshalls/registry";
import { runS1ngularityMarshall } from "../../security/marshalls/s1ngularity";
import { runSignatureMarshall } from "../../security/marshalls/signatures";
import type { InspectOptions } from "./index";

interface ParsedPackageArg {
    name: string;
    spec: string | undefined;
}

const KNOWN_MARSHALLS: ReadonlySet<MarshallName> = new Set([
    "archivedRepo",
    "author",
    "downloads",
    "expiredDomains",
    "metadata",
    "newBin",
    "provenance",
    "s1ngularity",
    "signatures",
]);

/**
 * Split `&lt;name>` or `&lt;name>@&lt;spec>` into `{ name, spec }`. Scoped names
 * keep their leading `@` — the *second* `@` (if any) is the separator.
 */
const parsePackageArg = (raw: string): ParsedPackageArg | undefined => {
    const trimmed = raw.trim();

    if (trimmed === "") {
        return undefined;
    }

    if (trimmed.startsWith("@")) {
        const separator = trimmed.indexOf("@", 1);

        if (separator === -1) {
            return { name: trimmed, spec: undefined };
        }

        return { name: trimmed.slice(0, separator), spec: trimmed.slice(separator + 1) || undefined };
    }

    const separator = trimmed.indexOf("@");

    if (separator === -1) {
        return { name: trimmed, spec: undefined };
    }

    return { name: trimmed.slice(0, separator), spec: trimmed.slice(separator + 1) || undefined };
};

const parseOnlyFlag = (raw: string | undefined): Set<MarshallName> | undefined => {
    if (raw === undefined || raw.trim() === "") {
        return undefined;
    }

    const requested = new Set<MarshallName>();

    for (const part of raw.split(",")) {
        const candidate = part.trim() as MarshallName;

        if (!KNOWN_MARSHALLS.has(candidate)) {
            throw new Error(`Unknown marshall in --only: ${candidate}. Known: ${[...KNOWN_MARSHALLS].sort().join(", ")}.`);
        }

        requested.add(candidate);
    }

    return requested;
};

const should = (only: Set<MarshallName> | undefined, name: MarshallName): boolean => only === undefined || only.has(name);

/**
 * Signatures default to off — both here and in `runMarshallPipeline` —
 * because npm's signing-key coverage still produces noisy warnings on
 * legitimate packages. Users opt in via `--only signatures`.
 */
const shouldRunSignatures = (only: Set<MarshallName> | undefined): boolean => only?.has("signatures") ?? false;

const execute = async ({ argument, options, workspaceRoot: wsRoot }: Toolbox<Console, InspectOptions>): Promise<void> => {
    if (!argument || argument.length === 0) {
        throw new Error("No package specified. Usage: vis inspect <package>[@<spec>]");
    }

    const parsed = parsePackageArg(argument[0] as string);

    if (parsed === undefined) {
        throw new Error(`Invalid package argument: "${String(argument[0])}". Usage: vis inspect <package>[@<spec>]`);
    }

    const only = parseOnlyFlag(options.only);
    const packument = await getPackument(parsed.name, { workspaceRoot: wsRoot });

    if (packument === undefined) {
        pail.error(`Package ${parsed.name} not found in the registry.`);
        process.exitCode = 2;

        return;
    }

    const resolvedVersion = resolveVersionRange(packument, parsed.spec);

    if (resolvedVersion === undefined) {
        pail.error(`Could not resolve ${parsed.name}@${parsed.spec ?? "latest"} to a published version.`);
        process.exitCode = 2;

        return;
    }

    const target = [{ name: parsed.name, version: resolvedVersion }];
    const findings = new MarshallFindings();

    // Run each marshall and convert its typed findings into MarshallFinding.
    if (should(only, "author")) {
        const results = await runAuthorMarshall(target, { workspaceRoot: wsRoot });

        for (const result of results) {
            findings.add({ marshall: "author", message: result.message, packageName: result.packageName, severity: result.severity });
        }
    }

    if (should(only, "provenance")) {
        const results = await runProvenanceMarshall(target);

        for (const result of results) {
            findings.add({
                marshall: "provenance",
                message: `Prior version ${result.priorVersionWithProvenance} had provenance but ${result.version} does not.`,
                packageName: result.packageName,
                severity: "error",
            });
        }
    }

    if (should(only, "s1ngularity")) {
        const results = await runS1ngularityMarshall(target, { workspaceRoot: wsRoot });

        for (const result of results) {
            const hooks = result.hookChanges.map((change) => `${change.hook} (${change.kind})`).join(", ");
            const singular = result.hookChanges.length === 1;

            findings.add({
                marshall: "s1ngularity",
                message: `${result.version} ${singular ? "has an" : "has"} install-script ${singular ? "change" : "changes"} [${hooks}] AND dropped the provenance attestation that ${result.priorVersion} carried — this is the s1ngularity compromised-publish shape.`,
                packageName: result.packageName,
                severity: "error",
            });
        }
    }

    if (should(only, "newBin")) {
        const results = await runNewBinMarshall(target);

        for (const result of results) {
            const list = result.newBins.map((bin) => bin.command).join(", ");

            findings.add({
                marshall: "newBin",
                message: `${result.toVersion} adds new bin script${result.newBins.length === 1 ? "" : "s"}: ${list} (prior: ${result.fromVersion}).`,
                packageName: result.packageName,
                severity: "warning",
            });
        }
    }

    if (should(only, "metadata")) {
        const results = await runMetadataMarshall(target, { workspaceRoot: wsRoot });

        for (const result of results) {
            findings.add({
                marshall: "metadata",
                message: `Missing/invalid metadata: ${result.issues.join(", ")}.`,
                packageName: result.packageName,
                severity: "warning",
            });
        }
    }

    if (should(only, "downloads")) {
        const results = await runDownloadsMarshall([parsed.name]);

        for (const result of results) {
            const count = result.downloadsLastMonth === undefined ? "unknown" : String(result.downloadsLastMonth);

            findings.add({
                marshall: "downloads",
                message: result.kind === "no-data" ? `npm stats API returned no monthly download data.` : `Only ${count} downloads in the past month.`,
                packageName: result.packageName,
                severity: result.severity,
            });
        }
    }

    if (should(only, "expiredDomains")) {
        const results = await runExpiredDomainsMarshall(target, { workspaceRoot: wsRoot });

        for (const result of results) {
            findings.add({
                marshall: "expiredDomains",
                message:
                    result.kind === "expired"
                        ? `Maintainer email domain ${result.domain} (${result.maintainer}) is unregistered — potential hijack risk.`
                        : `Could not verify maintainer email domain ${result.domain} (${result.maintainer}).`,
                packageName: result.packageName,
                severity: result.severity,
            });
        }
    }

    if (shouldRunSignatures(only)) {
        const results = await runSignatureMarshall(target, { workspaceRoot: wsRoot });

        for (const result of results) {
            findings.add({ marshall: "signatures", message: result.message, packageName: result.packageName, severity: result.severity });
        }
    }

    if (should(only, "archivedRepo")) {
        const results = await runArchivedRepoMarshall(target, { workspaceRoot: wsRoot });

        for (const result of results) {
            findings.add({
                marshall: "archivedRepo",
                message:
                    result.kind === "archived"
                        ? `Source repo ${result.owner}/${result.repo} is archived${result.archivedAt === undefined ? "" : ` (since ${result.archivedAt})`}.`
                        : `Source repo ${result.owner}/${result.repo} returned 404 from GitHub.`,
                packageName: result.packageName,
                severity: "warning",
            });
        }
    }

    const snapshot: ReadonlyArray<MarshallFinding> = findings.all();

    if (options.json === true) {
        process.stdout.write(`${JSON.stringify(formatMarshallFindingsAsJson(snapshot), undefined, 2)}\n`);
    } else {
        const header = `${parsed.name}@${resolvedVersion}`;

        if (snapshot.length === 0) {
            pail.info(`${green("✓")} ${header} — no findings.`);
        } else {
            pail.info(`${dim("Inspecting")} ${header}`);

            for (const line of formatMarshallFindingsAsTable(snapshot)) {
                process.stdout.write(`${line}\n`);
            }

            const errorCount = findings.errors().length;
            const warningCount = findings.warnings().length;

            process.stdout.write(
                `\n${dim("Summary:")} ${red(`${String(errorCount)} error${errorCount === 1 ? "" : "s"}`)}, ${yellow(`${String(warningCount)} warning${warningCount === 1 ? "" : "s"}`)}.\n`,
            );
        }
    }

    if (findings.hasErrors() || (options.strict === true && !findings.isEmpty())) {
        process.exitCode = 1;
    }
};

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export default execute as CommandExecute<Toolbox>;
export { parsePackageArg };
