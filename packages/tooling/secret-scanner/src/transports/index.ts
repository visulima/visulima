// Registry of optional validator transports.
//
// Each non-HTTP validator type in Kingfisher's YAML (AWS, GCP, MongoDB, …)
// corresponds to a provider-specific protocol whose spec is *not* in the YAML —
// Kingfisher bakes it into Rust. Replicating each one here would inflate the
// package with SDKs that ≤2 rules ever use, so we take the `peerDependencies`
// path instead: declare the drivers as *optional* peer deps, and when a user
// actually triggers validation for that type, we either:
//
//   1. dynamically import the driver if installed → run the transport;
//   2. emit a one-time install-hint warning and mark the finding `"skipped"`.
//
// That keeps the default scanner small while giving users a concrete next step
// for every type they care about. Use `listRequiredValidators()` or
// `vis secrets --list-validators` to discover the mapping up front.

import type { ValidationStatus } from "../types";
import { validateJwt } from "../validator/jwt";
import { validateAws } from "./aws";
import type { TransportContext, ValidatorTransport } from "./context";
import { validateGcp } from "./gcp";
import { validateJdbc } from "./jdbc";
import { validateMongoDB } from "./mongodb";
import { validateMySQL } from "./mysql";
import { validatePostgres } from "./postgres";
import { emitInstallWarning } from "./runtime";

export const TRANSPORTS: Record<string, ValidatorTransport> = {
    AWS: {
        displayName: "AWS STS",
        implemented: true,
        packageName: "@aws-sdk/client-sts",
        summary: "Signs a `sts:GetCallerIdentity` call with the captured access-key pair. Requires the AKID from the paired `depends_on_rule` dependency.",
        validate: validateAws,
    },
    AzureStorage: {
        displayName: "Azure Storage",
        implemented: false,
        packageName: "@azure/storage-blob",
        summary: "HMAC-SHA256 shared-key signing against the storage account endpoint. Implementation pending an upstream spec PR.",
    },
    Coinbase: {
        displayName: "Coinbase",
        implemented: false,
        summary: "Provider-specific HMAC-SHA256 signing; the endpoint is not in upstream YAML. Implementation pending an upstream spec PR.",
    },
    GCP: {
        displayName: "Google Cloud",
        implemented: true,
        packageName: "google-auth-library",
        summary: "Decodes the captured service-account JSON and exchanges it for an OAuth access token.",
        validate: validateGcp,
    },
    Grpc: {
        displayName: "gRPC",
        implemented: false,
        packageName: "@grpc/grpc-js",
        summary:
            "Unary gRPC call against the provider's endpoint. Disabled pending a spec: real gRPC services reject empty-body passthrough calls, so the prior implementation always returned `error`. Upstream has 1 rule using this; skip rather than fail.",
    },
    Jdbc: {
        displayName: "JDBC",
        implemented: true,
        summary: "Parses a generic `jdbc:<scheme>:` URL and dispatches to the matching driver. Install `mongodb`, `mysql2`, or `pg` depending on the scheme.",
        validate: validateJdbc,
    },
    JWT: {
        displayName: "JSON Web Token",
        implemented: true,
        summary: "Offline formal-validity check — three base64url segments, header + payload parse as JSON, `alg` is present. No network.",
        validate: async ({ secret }) => validateJwt(secret),
    },
    MongoDB: {
        displayName: "MongoDB",
        implemented: true,
        packageName: "mongodb",
        summary: "Connects with the captured connection string and pings the server.",
        validate: validateMongoDB,
    },
    MySQL: {
        displayName: "MySQL",
        implemented: true,
        packageName: "mysql2",
        summary: "Connects with the captured `mysql://…` URL and issues a `SELECT 1`.",
        validate: validateMySQL,
    },
    Postgres: {
        displayName: "PostgreSQL",
        implemented: true,
        packageName: "pg",
        summary: "Connects with the captured `postgres://…` URL and issues a `SELECT 1`.",
        validate: validatePostgres,
    },
    Raw: {
        displayName: "Raw transport",
        implemented: false,
        summary: "Custom protocol per rule (FTP, SMTP, …). No generic driver — bespoke per provider.",
    },
};

/**
 * Return the transport metadata for a validator type, or `undefined` when the
 * type isn't registered. Used by `validateFinding` to decide between
 * "try-to-run" and "nothing-we-can-do".
 */
export const lookupTransport = (type: string): ValidatorTransport | undefined => TRANSPORTS[type];

/**
 * Dispatch to the transport-specific validator when one is implemented.
 * Unimplemented types emit a one-time install-hint warning and resolve to
 * `"skipped"` — `"verified"` is only possible via an implemented transport
 * whose peer dep is installed.
 */
export const runTransport = async (type: string, context: TransportContext): Promise<ValidationStatus> => {
    const transport = lookupTransport(type);

    if (!transport) {
        return "skipped";
    }

    if (!transport.implemented || !transport.validate) {
        emitInstallWarning(type, transport);

        return "skipped";
    }

    return transport.validate(context);
};

// ---------------------------------------------------------------------------
// Discovery API — consumed by `listRequiredValidators()` + `--list-validators`
// ---------------------------------------------------------------------------

export interface ValidatorReport {
    displayName: string;
    implemented: boolean;
    packageName?: string;
    ruleCount: number;
    summary: string;
    type: string;
}

export const reportValidators = (rules: { validation?: unknown }[]): ValidatorReport[] => {
    const counts = new Map<string, number>();

    for (const rule of rules) {
        if (typeof rule.validation !== "object" || rule.validation === null) {
            continue;
        }

        const { type } = rule.validation as { type?: unknown };

        if (typeof type !== "string") {
            continue;
        }

        counts.set(type, (counts.get(type) ?? 0) + 1);
    }

    const out: ValidatorReport[] = [];

    for (const [type, ruleCount] of counts) {
        const transport = lookupTransport(type);

        if (transport) {
            out.push({
                displayName: transport.displayName,
                implemented: transport.implemented,
                packageName: transport.packageName,
                ruleCount,
                summary: transport.summary,
                type,
            });
        }
    }

    return out.toSorted((a, b) => b.ruleCount - a.ruleCount);
};

export type { TransportContext, ValidatorTransport } from "./context";
export { resetWarningsForTests } from "./runtime";
