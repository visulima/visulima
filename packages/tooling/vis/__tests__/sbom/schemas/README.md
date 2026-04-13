# CycloneDX schemas (vendored, test-only)

These files are vendored verbatim from the official CycloneDX specification
repository. They live under `__tests__/` because they are loaded exclusively
by `__tests__/sbom/validator.ts` to validate the SBOMs that `vis sbom`
produces against the spec. They are **never loaded at runtime** and are not
part of the published package (`dist/` nor the `files` list).

| File | Purpose |
|------|---------|
| `bom-1.6.schema.json` | CycloneDX 1.6 JSON Schema (Draft-07). Main validation target. |
| `spdx.schema.json` | SPDX licence-id enum referenced by `bom-1.6.schema.json` via `$ref`. |
| `jsf-0.82.schema.json` | JSON Signature Format 0.82 referenced by `bom-1.6.schema.json` via `$ref`. Only needed if signed BOMs are validated. |

## Source and version

- Upstream: <https://github.com/CycloneDX/specification>
- Tag: **`1.6.1`**
- Direct URLs:
  - <https://raw.githubusercontent.com/CycloneDX/specification/1.6.1/schema/bom-1.6.schema.json>
  - <https://raw.githubusercontent.com/CycloneDX/specification/1.6.1/schema/spdx.schema.json>
  - <https://raw.githubusercontent.com/CycloneDX/specification/1.6.1/schema/jsf-0.82.schema.json>

## Licence

The CycloneDX specification is published by OWASP under the Apache-2.0 licence.
The files above are redistributed unchanged under the same licence.

## Refreshing

To pull newer copies, re-run the download commands above against a newer tag.
Keep all three files in lock-step — the main schema uses `$ref` to resolve
into `spdx.schema.json` and `jsf-0.82.schema.json` by relative filename.
