/**
 * TypeScript types for the subset of CycloneDX 1.7 that `vis sbom` emits.
 *
 * These types are hand-maintained against the vendored schema at
 * `__tests__/sbom/schemas/bom-1.7.schema.json` (upstream tag 1.7). They
 * intentionally cover only the shapes the SBOM generator produces —
 * `services`, `vulnerabilities`, `compositions`, `annotations`,
 * `formulation`, `declarations`, `signature`, `pedigree`, `evidence`,
 * `modelCard`, `citations`, `patents`, and crypto-asset fields are omitted.
 *
 * The schema is still the source of truth: see
 * `__tests__/sbom/schema-conformance.test.ts` for the ajv-backed validator
 * that runs on every emitted BOM.
 */

/** Hash algorithms permitted by CycloneDX 1.7. */
export type HashAlgorithm
    = | "BLAKE2b-256"
        | "BLAKE2b-384"
        | "BLAKE2b-512"
        | "BLAKE3"
        | "MD5"
        | "SHA-1"
        | "SHA-256"
        | "SHA-384"
        | "SHA-512"
        | "SHA3-256"
        | "SHA3-384"
        | "SHA3-512"
        | "Streebog-256"
        | "Streebog-512";

/** A single hash entry on a component. */
export interface Hash {
    alg: HashAlgorithm;
    /** Hex-encoded digest (no `sha512-` prefix; integrity strings from npm lockfiles must be stripped + base64-decoded first). */
    content: string;
}

/** Component type enumeration. */
export type ComponentType
    = | "application"
        | "container"
        | "cryptographic-asset"
        | "data"
        | "device"
        | "device-driver"
        | "file"
        | "firmware"
        | "framework"
        | "library"
        | "machine-learning-model"
        | "operating-system"
        | "platform";

/** Dependency scope on a component. */
export type ComponentScope = "excluded" | "optional" | "required";

/** License acknowledgement status. */
export type LicenseAcknowledgement = "concluded" | "declared";

/** Fields shared by every licence variant. */
export interface LicenseBase {
    acknowledgement?: LicenseAcknowledgement;
    "bom-ref"?: string;
    text?: Attachment;
    url?: string;
}

/**
 * A named or SPDX-identified licence.
 *
 * The schema requires exactly one of `id` or `name` to be present; this is
 * modelled as a discriminated union so the constraint is enforced at the
 * type level rather than just at ajv-validation time.
 */
export type License = NamedLicense | SpdxLicense;

/** SPDX-identified licence (`id` is a valid SPDX licence identifier). */
export interface SpdxLicense extends LicenseBase {
    /** SPDX licence identifier (e.g. `"MIT"`). */
    id: string;
    name?: never;
}

/** Free-form licence where no SPDX identifier matches. */
export interface NamedLicense extends LicenseBase {
    id?: never;
    /** Free-form licence name. */
    name: string;
}

/** A single licence entry in the `licenses` array. */
export interface LicenseEntry {
    license: License;
}

/** A single-element tuple carrying an SPDX expression. */
export interface LicenseExpressionEntry {
    acknowledgement?: LicenseAcknowledgement;
    "bom-ref"?: string;
    expression: string;
}

/**
 * Per the spec, `licenses` is EITHER a list of `{ license }` entries OR a
 * one-element tuple carrying an SPDX expression — never mixed.
 */
export type LicenseChoice = LicenseEntry[] | [LicenseExpressionEntry];

/** Attachment (inline blob) used for licence texts, etc. */
export interface Attachment {
    content: string;
    contentType?: string;
    encoding?: "base64";
}

/** Individual contact within an organisation. */
export interface OrganizationalContact {
    "bom-ref"?: string;
    email?: string;
    name?: string;
    phone?: string;
}

/** Postal address attached to an organisation. */
export interface PostalAddress {
    "bom-ref"?: string;
    country?: string;
    locality?: string;
    postalCode?: string;
    region?: string;
    streetAddress?: string;
}

/** Company / organisation metadata. */
export interface OrganizationalEntity {
    address?: PostalAddress;
    "bom-ref"?: string;
    contact?: OrganizationalContact[];
    name?: string;
    url?: string[];
}

/**
 * All 47 values from the CycloneDX 1.7 `externalReferenceType` enum. Kept
 * exhaustive so any spec-legal reference type type-checks. The 1.7 additions
 * over 1.6 are: `citation`, `patent`, `patent-assertion`, `patent-family`.
 */
export type ExternalReferenceType
    = | "adversary-model"
        | "advisories"
        | "attestation"
        | "bom"
        | "build-meta"
        | "build-system"
        | "certification-report"
        | "chat"
        | "citation"
        | "codified-infrastructure"
        | "component-analysis-report"
        | "configuration"
        | "digital-signature"
        | "distribution"
        | "distribution-intake"
        | "documentation"
        | "dynamic-analysis-report"
        | "electronic-signature"
        | "evidence"
        | "exploitability-statement"
        | "formulation"
        | "issue-tracker"
        | "license"
        | "log"
        | "mailing-list"
        | "maturity-report"
        | "model-card"
        | "other"
        | "patent"
        | "patent-assertion"
        | "patent-family"
        | "pentest-report"
        | "poam"
        | "quality-metrics"
        | "release-notes"
        | "rfc-9116"
        | "risk-assessment"
        | "runtime-analysis-report"
        | "security-contact"
        | "social"
        | "source-distribution"
        | "static-analysis-report"
        | "support"
        | "threat-model"
        | "vcs"
        | "vulnerability-assertion"
        | "website";

/** External reference (website, VCS, distribution, etc.). */
export interface ExternalReference {
    comment?: string;
    hashes?: Hash[];
    type: ExternalReferenceType;
    url: string;
}

/**
 * A software component in the BOM. This is the shape `vis sbom` emits —
 * it's a strict subset of the CycloneDX definition.
 */
export interface Component {
    author?: string;
    "bom-ref"?: string;
    components?: Component[];
    copyright?: string;
    cpe?: string;
    description?: string;
    externalReferences?: ExternalReference[];
    group?: string;
    hashes?: Hash[];
    licenses?: LicenseChoice;
    manufacturer?: OrganizationalEntity;
    "mime-type"?: string;
    name: string;
    properties?: Property[];
    publisher?: string;
    /** Package URL, e.g. `pkg:npm/@scope/name@1.2.3`. */
    purl?: string;
    scope?: ComponentScope;
    supplier?: OrganizationalEntity;
    tags?: string[];
    type: ComponentType;
    version?: string;
}

/** Arbitrary key-value metadata attachable to components and BOMs. */
export interface Property {
    name: string;
    value?: string;
}

/**
 * CycloneDX 1.5+ form of `metadata.tools`: a bag of tool components and
 * (optionally) services. The legacy array form is intentionally not
 * supported — new BOMs should use this shape.
 */
export interface ToolsAggregate {
    components?: Component[];
}

/** BOM lifecycle phase (pre-defined names in the spec). */
export type LifecyclePhase = "build" | "decommission" | "design" | "discovery" | "operations" | "post-build" | "pre-build";

export interface Lifecycle {
    description?: string;
    name?: string;
    phase?: LifecyclePhase;
}

export interface Metadata {
    authors?: OrganizationalContact[];
    component?: Component;
    licenses?: LicenseChoice;
    lifecycles?: Lifecycle[];
    manufacturer?: OrganizationalEntity;
    properties?: Property[];
    supplier?: OrganizationalEntity;
    /** ISO 8601 timestamp describing when the BOM was created. */
    timestamp?: string;
    tools?: ToolsAggregate;
}

/** A single edge in the dependency graph. */
export interface Dependency {
    /** `bom-ref`s of components this component directly depends on. */
    dependsOn?: string[];
    /** `bom-ref`s of components this component provides (conformance claims). */
    provides?: string[];
    /** `bom-ref` of the subject component. */
    ref: string;
}

/** The root CycloneDX 1.7 BOM document. */
export interface CycloneDxBom {
    $schema?: string;
    bomFormat: "CycloneDX";
    components?: Component[];
    dependencies?: Dependency[];
    externalReferences?: ExternalReference[];
    metadata?: Metadata;
    properties?: Property[];
    /** `urn:uuid:&lt;rfc-4122>` — unique identifier for this specific BOM revision. */
    serialNumber?: string;
    specVersion: "1.7";
    /** Monotonically increasing integer for BOM revisions (starts at 1). */
    version?: number;
    vulnerabilities?: CycloneDxVulnerability[];
}

/** CycloneDX 1.7 vulnerability rating method. */
export type CycloneDxRatingMethod = "CVSSv2" | "CVSSv3" | "CVSSv31" | "CVSSv4" | "OWASP" | "SSVC" | "other";

/** CycloneDX 1.7 severity enum. */
export type CycloneDxSeverity = "critical" | "high" | "medium" | "low" | "info" | "none" | "unknown";

export interface CycloneDxVulnerabilityRating {
    method?: CycloneDxRatingMethod;
    score?: number;
    severity?: CycloneDxSeverity;
    source?: { name?: string; url?: string };
    vector?: string;
}

export interface CycloneDxVulnerabilityReference {
    id: string;
    source: { name?: string; url?: string };
}

export interface CycloneDxVulnerabilityAffects {
    ref: string;
    versions?: { status?: "affected" | "unaffected" | "unknown"; version: string }[];
}

/** CycloneDX 1.7 VEX analysis state. */
export type CycloneDxAnalysisState = "resolved" | "resolved_with_pedigree" | "exploitable" | "in_triage" | "false_positive" | "not_affected";

/** CycloneDX 1.7 VEX analysis justification. */
export type CycloneDxAnalysisJustification
    = | "code_not_present"
        | "code_not_reachable"
        | "requires_configuration"
        | "requires_dependency"
        | "requires_environment"
        | "protected_by_compiler"
        | "protected_at_runtime"
        | "protected_at_perimeter"
        | "protected_by_mitigating_control";

export interface CycloneDxVulnerability {
    affects?: CycloneDxVulnerabilityAffects[];
    analysis?: {
        detail?: string;
        justification?: CycloneDxAnalysisJustification;
        response?: ("can_not_fix" | "will_not_fix" | "update" | "rollback" | "workaround_available")[];
        state?: CycloneDxAnalysisState;
    };
    "bom-ref"?: string;
    created?: string;
    description?: string;
    detail?: string;
    id: string;
    properties?: Property[];
    published?: string;
    ratings?: CycloneDxVulnerabilityRating[];
    recommendation?: string;
    references?: CycloneDxVulnerabilityReference[];
    source?: { name?: string; url?: string };
    updated?: string;
}
