# CycloneDX schemas (vendored, test-only)

These files are vendored verbatim from the official CycloneDX specification
repository. They live under `__tests__/` because they are loaded exclusively
by `__tests__/sbom/validator.ts` to validate the SBOMs that `vis sbom`
produces against the spec. They are **never loaded at runtime** and are not
part of the published package (`dist/` nor the `files` list).

| File                   | Purpose                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `bom-1.6.schema.json`  | CycloneDX 1.6 JSON Schema (Draft-07). Main validation target.                                                                    |
| `spdx.schema.json`     | SPDX licence-id enum referenced by `bom-1.6.schema.json` via `$ref`.                                                             |
| `jsf-0.82.schema.json` | JSON Signature Format 0.82 referenced by `bom-1.6.schema.json` via `$ref`. Only needed if signed BOMs are validated.             |
| `LICENSE`              | Verbatim copy of the upstream Apache-2.0 licence text (§4.1 of the Apache licence requires redistributors to carry the licence). |

## Source and version

- Upstream: <https://github.com/CycloneDX/specification>
- Tag: **`1.6.1`**
- Direct URLs:
    - <https://raw.githubusercontent.com/CycloneDX/specification/1.6.1/schema/bom-1.6.schema.json>
    - <https://raw.githubusercontent.com/CycloneDX/specification/1.6.1/schema/spdx.schema.json>
    - <https://raw.githubusercontent.com/CycloneDX/specification/1.6.1/schema/jsf-0.82.schema.json>
    - <https://raw.githubusercontent.com/CycloneDX/specification/1.6.1/LICENSE>

## Licence & attribution

The CycloneDX specification is published by OWASP under the **Apache-2.0**
licence. The schema files themselves carry an upstream `$comment` field
declaring this (e.g. `bom-1.6.schema.json`: _"CycloneDX JSON schema is
published under the terms of the Apache License 2.0."_), which we preserve
unchanged because we vendor the files verbatim.

The full Apache-2.0 licence text is reproduced in `LICENSE` next to the
schemas. There is no upstream `NOTICE` file as of tag `1.6.1`, so no
separate attribution file is required.

We do not modify the schemas; if that ever changes, Apache §4.2 requires
adding prominent modification notices.

## Refreshing

Run the bundled update script from the `vis` package root:

```sh
# refresh the currently vendored tag (1.6.1)
pnpm tsx scripts/update-cyclonedx-schemas.ts

# pin to a specific tag
pnpm tsx scripts/update-cyclonedx-schemas.ts 1.6.1

# bump to a newer spec version (filename changes with major.minor)
pnpm tsx scripts/update-cyclonedx-schemas.ts 1.7
```

The script downloads the three schema files plus the LICENSE, validates
each JSON file parses cleanly, and writes them into this directory.

After running, update the **Tag** + **Direct URLs** section above to match
and review `src/sbom/types.ts` for any new enum values or fields added by
the spec.
