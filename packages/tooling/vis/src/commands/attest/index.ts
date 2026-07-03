import type { Command, CreateOptions } from "@visulima/cerebro";
import { lazyNamed } from "@visulima/cerebro";

/**
 * `vis attest` — outbound supply-chain attestation.
 *
 * Two leaves:
 *
 * - `vis attest &lt;subject>` (emit): build an in-toto SLSA v1 provenance
 *   statement for a built artifact and keyless-sign it via Sigstore
 *   (Fulcio cert from ambient CI OIDC, Rekor transparency log). Writes a
 *   serialized `.sigstore` bundle. Authenticity, not just integrity.
 * - `vis attest verify`: compose the inbound provenance + registry
 *   signature marshalls over the locked dependency graph and gate on
 *   regressions (publisher dropped provenance, unknown/expired keyid,
 *   bad signature). The shipped inbound half of roadmap item 12.
 */

const formatOption = {
    description: "Output format: table, json, or ndjson (default: table). json/ndjson go to stdout, logs to stderr.",
    name: "format",
    type: String,
} as const;

const attestVerify: Command = {
    commandPath: ["attest"],
    description: "Verify inbound provenance + registry signatures across the locked dependency graph and gate on regressions",
    examples: [
        ["vis attest verify", "Check every locked dep for provenance regressions and signature problems"],
        ["vis attest verify --prod-only", "Skip devDependencies"],
        ["vis attest verify --format json", "Machine-readable findings for CI (Axis A)"],
        ["vis attest verify --fail-on error", "Exit non-zero only on error-severity findings (default: any finding)"],
    ],
    group: "Security & Health",
    loader: lazyNamed(() => import("./handler"), "attestVerifyExecute"),
    name: "verify",
    options: [
        formatOption,
        {
            defaultValue: false,
            description: "Skip devDependencies — verify the production graph only.",
            name: "prod-only",
            type: Boolean,
        },
        {
            description: "Severity that triggers a non-zero exit: 'warning' (any finding, default) or 'error'.",
            name: "fail-on",
            type: String,
        },
        {
            description: "Comma-separated package names to exclude from both marshalls.",
            name: "allowlist",
            type: String,
        },
    ],
};

const attestEmit: Command = {
    argument: {
        description: "Path to the built artifact to attest (e.g. dist/app.tgz). Its sha256 becomes the in-toto subject digest.",
        name: "subject",
        type: String,
    },
    description: "Build an in-toto SLSA v1 provenance statement for an artifact and keyless-sign it via Sigstore",
    examples: [
        ["vis attest dist/app.tgz", "Emit dist/app.tgz.sigstore (keyless-signed in CI)"],
        ["vis attest dist/app.tgz --output attest.sigstore", "Write the bundle to a specific path"],
        ["vis attest dist/app.tgz --predicate slsaProvenance", "Predicate type (default: slsaProvenance)"],
        ["vis attest dist/app.tgz --require-signing", "Fail instead of skip-with-warn when no ambient OIDC (outside CI)"],
        ["vis attest dist/app.tgz --format json", "Print the signed bundle summary as JSON (Axis A)"],
    ],
    group: "Security & Health",
    loader: lazyNamed(() => import("./handler"), "attestEmitExecute"),
    name: "attest",
    options: [
        formatOption,
        {
            description: "Write the serialized Sigstore bundle here (default: <subject>.sigstore).",
            name: "output",
            type: String,
        },
        {
            description: "Predicate type: 'slsaProvenance' (default, https://slsa.dev/provenance/v1).",
            name: "predicate",
            type: String,
        },
        {
            defaultValue: false,
            description: "Error instead of skip-with-warn when no ambient OIDC token is available (i.e. outside CI).",
            name: "require-signing",
            type: Boolean,
        },
    ],
};

const attestCommands: Command[] = [attestEmit, attestVerify];

export default attestCommands;

export type AttestVerifyOptions = CreateOptions<{
    allowlist: string | undefined;
    "fail-on": string | undefined;
    format: string | undefined;
    "prod-only": boolean | undefined;
}>;

export type AttestEmitOptions = CreateOptions<{
    format: string | undefined;
    output: string | undefined;
    predicate: string | undefined;
    "require-signing": boolean | undefined;
}>;
