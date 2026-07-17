import { createHash } from "node:crypto";
import { basename, isAbsolute, resolve as resolvePath } from "node:path";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { renderToString } from "@visulima/tui";
import { Table } from "@visulima/tui-components/table";
import React from "react";

import { detectPm } from "../../pm/pm-runner";
import { lockedPackages } from "../../security/dependency-scan";
import { runProvenanceMarshall } from "../../security/marshalls/provenance";
import { runSignatureMarshall } from "../../security/marshalls/signatures";
import { loadOptionalSigstore } from "../../security/sigstore/loader";
import type { AttestEmitOptions, AttestVerifyOptions } from "./index";

type Severity = "error" | "warning";

interface AttestFinding {
    code: string;
    message: string;
    packageName: string;
    severity: Severity;
    version: string;
}

const splitList = (value: string | undefined): string[] =>
    (value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

export const attestVerifyExecute: CommandExecute<Toolbox<Console, AttestVerifyOptions>> = async ({ logger, options, workspaceRoot: wsRoot }) => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
    }

    const format = options.format ?? "table";
    const prodOnly = options.prodOnly ?? false;
    const failOn: Severity = options.failOn === "error" ? "error" : "warning";
    const allowlist = splitList(options.allowlist);

    const pm = detectPm(wsRoot);
    const installed = lockedPackages(wsRoot, pm.name, { includeDev: !prodOnly });
    const packages = installed.map(({ name, version }) => {
        return { name, version };
    });

    const [provenance, signatures] = await Promise.all([
        runProvenanceMarshall(packages, { allowlist, workspaceRoot: wsRoot }),
        runSignatureMarshall(packages, { allowlist, workspaceRoot: wsRoot }),
    ]);

    const findings: AttestFinding[] = [
        ...provenance.map((entry): AttestFinding => {
            return {
                code: "provenance-regression",
                message: `Resolved ${entry.packageName}@${entry.version} has no published provenance attestation, but ${entry.packageName}@${entry.priorVersionWithProvenance} did — a provenance regression.`,
                packageName: entry.packageName,
                severity: "warning",
                version: entry.version,
            };
        }),
        ...signatures.map((entry): AttestFinding => {
            return {
                code: entry.code,
                message: entry.message,
                packageName: entry.packageName,
                severity: entry.severity,
                version: entry.version,
            };
        }),
    ];

    const gating = findings.filter((finding) => (failOn === "error" ? finding.severity === "error" : true));

    if (format === "json") {
        process.stdout.write(`${JSON.stringify({ findings, ok: gating.length === 0 }, undefined, 2)}\n`);
    } else if (format === "ndjson") {
        for (const finding of findings) {
            process.stdout.write(`${JSON.stringify(finding)}\n`);
        }
    } else if (findings.length === 0) {
        logger.info(`No provenance regressions or signature problems across ${String(packages.length)} locked packages.`);
    } else {
        const columns = process.stdout.columns || 80;

        logger.info(
            renderToString(
                React.createElement(Table, {
                    data: findings.map((finding) => {
                        return {
                            code: finding.code,
                            package: `${finding.packageName}@${finding.version}`,
                            severity: finding.severity,
                        };
                    }),
                }),
                { columns },
            ),
        );

        for (const finding of findings) {
            logger.warn(`${finding.packageName}@${finding.version}: ${finding.message}`);
        }
    }

    if (gating.length > 0) {
        process.exitCode = 1;
    }
};

const detectAmbientOidc = (): boolean =>
    process.env.CI === "true" || typeof process.env.ACTIONS_ID_TOKEN_REQUEST_URL === "string" || typeof process.env.SIGSTORE_ID_TOKEN === "string";

// Known limitation: `resolvedDependencies` and `internalParameters`
// are intentionally empty in this MVP. The statement is SLSA v1
// schema-valid and binds the subject digest, but it does not yet
// reach SLSA build L2/L3 (no dependency closure, no isolated builder
// claim). Downstream consumers gating on resolved deps should treat
// this as L1-equivalent until those fields are populated.
const buildSlsaStatement = (subjectName: string, sha256: string, workspaceRoot: string): Record<string, unknown> => {
    return {
        _type: "https://in-toto.io/Statement/v1",
        predicate: {
            buildDefinition: {
                buildType: "https://visulima.com/vis/attest/v1",
                externalParameters: { workspaceRoot },
                internalParameters: {},
                resolvedDependencies: [],
            },
            runDetails: {
                builder: { id: "https://visulima.com/vis" },
                metadata: { invocationId: process.env.GITHUB_RUN_ID ?? "", startedOn: new Date().toISOString() },
            },
        },
        predicateType: "https://slsa.dev/provenance/v1",
        subject: [{ digest: { sha256 }, name: subjectName }],
    };
};

export const attestEmitExecute: CommandExecute<Toolbox<Console, AttestEmitOptions>> = async ({ argument, fs, logger, options, workspaceRoot: wsRoot }) => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo.");
    }

    const subjectArgument = argument[0];

    if (!subjectArgument) {
        throw new Error("Missing subject. Usage: vis attest <path-to-artifact>");
    }

    const predicate = options.predicate ?? "slsaProvenance";

    if (predicate !== "slsaProvenance") {
        throw new Error(`Unsupported predicate '${predicate}'. Only 'slsaProvenance' is supported.`);
    }

    const subjectPath = isAbsolute(subjectArgument) ? subjectArgument : resolvePath(wsRoot, subjectArgument);
    const requireSigning = options.requireSigning ?? false;
    const format = options.format ?? "table";

    let artifact: Uint8Array;

    try {
        artifact = await fs.readFile(subjectPath);
    } catch {
        throw new Error(`Cannot read subject artifact at ${subjectPath}.`);
    }

    const sha256 = createHash("sha256").update(artifact).digest("hex");

    if (!detectAmbientOidc()) {
        const message = "No ambient OIDC token (not running in CI). Keyless signing needs a Fulcio identity from CI OIDC.";

        if (requireSigning) {
            throw new Error(`${message} Re-run in CI or drop --require-signing.`);
        }

        if (format === "json") {
            // Axis A: a JSON consumer must always get a single parseable
            // document on stdout, even on the skip path.
            process.stdout.write(
                `${JSON.stringify({ ok: false, reason: "no-ambient-oidc", sha256, skipped: true, subject: basename(subjectPath) }, undefined, 2)}\n`,
            );

            return;
        }

        logger.warn(`${message} Skipping signing (subject sha256: ${sha256}). Pass --require-signing to make this fatal.`);

        return;
    }

    const statement = buildSlsaStatement(basename(subjectPath), sha256, wsRoot);
    const payload = Buffer.from(JSON.stringify(statement));

    const sigstore = await loadOptionalSigstore({ workspaceRoot: wsRoot });
    const bundle = await sigstore.attest(payload, "application/vnd.in-toto+json");

    const outputPath = options.output ? (isAbsolute(options.output) ? options.output : resolvePath(wsRoot, options.output)) : `${subjectPath}.sigstore`;

    await fs.writeFile(outputPath, `${JSON.stringify(bundle, undefined, 2)}\n`, "utf8");

    if (format === "json") {
        process.stdout.write(`${JSON.stringify({ bundle: outputPath, ok: true, sha256, subject: basename(subjectPath) }, undefined, 2)}\n`);

        return;
    }

    logger.info(`Signed SLSA v1 provenance for ${basename(subjectPath)} (sha256 ${sha256.slice(0, 16)}…).`);
    logger.info(`Bundle written to ${outputPath}.`);
};
