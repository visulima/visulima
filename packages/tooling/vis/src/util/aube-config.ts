import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { parse as parseYaml } from "yaml";

/**
 * Subset of `aube-workspace.yaml` / `pnpm-workspace.yaml` that aube
 * treats as security-relevant. Every field is optional — aube ships
 * documented defaults for each one (per `crates/aube-settings/settings.toml`
 * in github.com/endevco/aube) and absence in the workspace YAML means
 * "use the default".
 *
 * `paranoid: true` is the master switch: it forces `trustPolicy =
 * no-downgrade`, `jailBuilds = true`, `minimumReleaseAgeStrict = true`,
 * `strictStoreIntegrity = true`, and `strictDepBuilds = true`,
 * regardless of how each is configured individually.
 */
export interface AubeSecurityPosture {
    allowBuildsCount: number;
    blockExoticSubdeps: boolean | undefined;
    jailBuilds: boolean | undefined;
    minimumReleaseAge: number | undefined;
    minimumReleaseAgeStrict: boolean | undefined;
    paranoid: boolean | undefined;
    /** Filename the posture was read from, for diagnostics. */
    source: string | undefined;
    strictDepBuilds: boolean | undefined;
    trustPolicy: "no-downgrade" | "off" | undefined;
}

const AUBE_WORKSPACE_YAML_NAMES = ["aube-workspace.yaml", "pnpm-workspace.yaml"] as const;

interface RawAubeYaml {
    allowBuilds?: Record<string, unknown>;
    blockExoticSubdeps?: unknown;
    jailBuilds?: unknown;
    minimumReleaseAge?: unknown;
    minimumReleaseAgeStrict?: unknown;
    paranoid?: unknown;
    strictDepBuilds?: unknown;
    trustPolicy?: unknown;
}

const asBool = (value: unknown): boolean | undefined => (typeof value === "boolean" ? value : undefined);

const asTrustPolicy = (value: unknown): "no-downgrade" | "off" | undefined => {
    if (value === "no-downgrade" || value === "off") {
        return value;
    }

    return undefined;
};

/**
 * Reads aube's security-relevant settings from the first workspace
 * YAML that exists at the workspace root. Returns an all-undefined
 * posture (with `source: undefined`) when no file is found or the
 * file is unparseable — callers can treat that as "aube defaults
 * apply unchanged".
 *
 * Precedence is `aube-workspace.yaml` first, then `pnpm-workspace.yaml`.
 * The first file that *exists and parses to an object* wins
 * unconditionally — even an empty `aube-workspace.yaml` (`{}` or
 * just whitespace + `paranoid:` with no value) shadows
 * `pnpm-workspace.yaml`. That matches aube's own resolution: once
 * `aube-workspace.yaml` is on disk, aube treats the workspace as
 * aube-managed and stops consulting the legacy file.
 *
 * Best-effort: never throws. A malformed YAML or unexpected shape
 * yields the default posture so `vis doctor` does not abort on a
 * broken config file.
 */
export const readAubeSecurityPosture = (workspaceRoot: string): AubeSecurityPosture => {
    const posture: AubeSecurityPosture = {
        allowBuildsCount: 0,
        blockExoticSubdeps: undefined,
        jailBuilds: undefined,
        minimumReleaseAge: undefined,
        minimumReleaseAgeStrict: undefined,
        paranoid: undefined,
        source: undefined,
        strictDepBuilds: undefined,
        trustPolicy: undefined,
    };

    for (const fileName of AUBE_WORKSPACE_YAML_NAMES) {
        const filePath = join(workspaceRoot, fileName);

        if (!isAccessibleSync(filePath)) {
            continue;
        }

        let parsed: unknown;

        try {
            parsed = parseYaml(readFileSync(filePath));
        } catch {
            continue;
        }

        if (typeof parsed !== "object" || parsed === null) {
            continue;
        }

        const raw = parsed as RawAubeYaml;

        posture.source = fileName;
        posture.paranoid = asBool(raw.paranoid);
        posture.trustPolicy = asTrustPolicy(raw.trustPolicy);
        posture.blockExoticSubdeps = asBool(raw.blockExoticSubdeps);
        posture.jailBuilds = asBool(raw.jailBuilds);
        posture.strictDepBuilds = asBool(raw.strictDepBuilds);
        posture.minimumReleaseAgeStrict = asBool(raw.minimumReleaseAgeStrict);

        if (typeof raw.minimumReleaseAge === "number" && Number.isFinite(raw.minimumReleaseAge)) {
            posture.minimumReleaseAge = raw.minimumReleaseAge;
        }

        if (raw.allowBuilds && typeof raw.allowBuilds === "object" && !Array.isArray(raw.allowBuilds)) {
            posture.allowBuildsCount = Object.keys(raw.allowBuilds).length;
        }

        return posture;
    }

    return posture;
};

/**
 * Resolve the *effective* posture aube would apply. `paranoid: true`
 * forces a strict bundle on regardless of the individual settings, so
 * doctor findings should reflect that — otherwise users with
 * `paranoid: true` would see warnings about settings that paranoid
 * has already turned on for them.
 *
 * Mirrors `crates/aube-settings/settings.toml::[paranoid]` in
 * github.com/endevco/aube.
 */
export const applyAubeParanoidOverrides = (posture: AubeSecurityPosture): AubeSecurityPosture => {
    if (!posture.paranoid) {
        return posture;
    }

    return {
        ...posture,
        jailBuilds: true,
        minimumReleaseAgeStrict: true,
        strictDepBuilds: true,
        trustPolicy: "no-downgrade",
    };
};
