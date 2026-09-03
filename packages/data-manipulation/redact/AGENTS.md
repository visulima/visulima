# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/redact` walks objects, arrays, Errors, Maps, Sets, JSON strings, and URL query strings, masking sensitive values according to configurable rules. The default rule set (`src/rules.ts`) covers API keys, AWS credentials, bearer tokens, credit cards, crypto addresses, bank accounts, and similar high-risk patterns.

## Architecture

- Two entries: `.` is the recursive filter (`src/index.ts`), `./nlp` is the optional NLP scanner (`src/nlp.ts`). Supporting modules are `src/string-anonymizer.ts`, `src/rules.ts`, `src/types.ts`, and `src/utils/` (`parse-url-parameters.ts`, `wildcard.ts`).
- `compromise` must stay reachable ONLY from `src/nlp.ts`. It is an optional peer dependency, and a static import of it anywhere in the `.` entry's module graph puts ~140 KB gzipped of English lexicon into every consumer — unremovable by any bundler, because `stringAnonymize` is on the path of nearly every call. `__tests__/bundle/bundle-graph.test.ts` bundles both entries and fails if it leaks back in.
- NLP detection is injected, never imported: `RedactOptions.nlp` takes an `NlpScanner` (`(input, types, logger?) => { start, tag, text }[]`), which `processDocument` calls at most once per string. No scanner means no parse.
- The `exports` map intentionally separates `import` and `browser` conditions — both currently point at the same file, but the structure is in place; keep it.
- Circular references are tracked via a `WeakMap` of original object → its copy (`src/index.ts`). Inputs are never mutated (frozen/sealed objects are safe, nothing leaks if a rule throws), and the map is garbage-collected automatically, so no cleanup pass is required.
- `dot-prop` is a devDependency used at runtime via inlining by `packem`. If you change the bundler config, verify `hasProperty` / `setProperty` still resolve.
- Default rules in `src/rules.ts` reference https://github.com/nitaiaharoni1/anonymize-nlp (MIT). Preserve the attribution comment when editing the file.

## Related

- Pairs naturally with `@visulima/object` (dot-path access) and is often used alongside logger packages for scrubbing sensitive fields before emit.
