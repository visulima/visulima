/**
 * TypeScript types for the subset of CycloneDX 1.6 that `vis sbom` emits.
 *
 * These types are hand-maintained against the vendored schema at
 * `./schemas/bom-1.6.schema.json` (upstream tag 1.6.1). They intentionally
 * cover only the shapes the SBOM generator produces — `services`,
 * `vulnerabilities`, `compositions`, `annotations`, `formulation`,
 * `declarations`, `signature`, `pedigree`, `evidence`, `modelCard`, and
 * crypto-asset fields are omitted.
 *
 * The schema is still the source of truth: see
 * `__tests__/sbom/schema-conformance.test.ts` for the ajv-backed validator
 * that runs on every emitted BOM.
 */

/** Hash algorithms permitted by CycloneDX 1.6. */
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
        | "SHA3-512";

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

/** A named or SPDX-identified licence. One of `id` or `name` must be present. */
export interface License {
    "bom-ref"?: string;
    /** SPDX licence identifier (e.g. `"MIT"`). Mutually exclusive with `name`. */
    id?: string;
    /** Free-form licence name when not an SPDX identifier. Mutually exclusive with `id`. */
    name?: string;
    acknowledgement?: LicenseAcknowledgement;
    url?: string;
    text?: Attachment;
}

/** A single licence entry in the `licenses` array. */
export interface LicenseEntry {
    license: License;
}

/** A single-element tuple carrying an SPDX expression. */
export interface LicenseExpressionEntry {
    "bom-ref"?: string;
    acknowledgement?: LicenseAcknowledgement;
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

/** Company / organisation metadata. */
export interface OrganizationalEntity {
    "bom-ref"?: string;
    address?: {
        country?: string;
        locality?: string;
        postalCode?: string;
        region?: string;
        streetAddress?: string;
    };
    contact?: OrganizationalContact[];
    name?: string;
    url?: string[];
}

/** External reference (website, VCS, distribution, etc.). */
export interface ExternalReference {
    comment?: string;
    hashes?: Hash[];
    type:
      | "advisories"
      | "bom"
      | "build-meta"
      | "build-system"
      | "chat"
      | "distribution"
      | "distribution-intake"
      | "documentation"
      | "issue-tracker"
      | "license"
      | "mailing-list"
      | "other"
      | "release-notes"
      | "security-contact"
      | "social"
      | "source-distribution"
      | "support"
      | "vcs"
      | "website";
    url: string;
}

/**
 * A software component in the BOM. This is the shape `vis sbom` emits —
 * it's a strict subset of the CycloneDX definition.
 */
export interface Component {
    "bom-ref"?: string;
    "mime-type"?: string;
    author?: string;
    components?: Component[];
    copyright?: string;
    cpe?: string;
    description?: string;
    externalReferences?: ExternalReference[];
    group?: string;
    hashes?: Hash[];
    licenses?: LicenseChoice;
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
export type LifecyclePhase
    = | "build"
        | "decommission"
        | "design"
        | "discovery"
        | "operations"
        | "post-build"
        | "pre-build";

export interface Lifecycle {
    description?: string;
    name?: string;
    phase?: LifecyclePhase;
}

export interface Metadata {
    authors?: OrganizationalContact[];
    component?: Component;
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

/**
 * The root CycloneDX 1.6 BOM document.
 *
 * Use {@link createEmptyBom} in `cyclonedx.ts` to produce a pre-populated
 * document — it fills in `bomFormat`, `specVersion`, `version`, and the
 * `$schema` pointer.
 */
export interface CycloneDxBom {
    $schema?: string;
    bomFormat: "CycloneDX";
    components?: Component[];
    dependencies?: Dependency[];
    externalReferences?: ExternalReference[];
    metadata?: Metadata;
    properties?: Property[];
    /** `urn:uuid:<rfc-4122>` — unique identifier for this specific BOM revision. */
    serialNumber?: string;
    specVersion: "1.6";
    /** Monotonically increasing integer for BOM revisions (starts at 1). */
    version?: number;
}
