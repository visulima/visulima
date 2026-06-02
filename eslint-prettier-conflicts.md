# ESLint rules that conflict with Prettier

These stylistic ESLint rules fight Prettier's output. When Prettier is the formatter of record, Prettier reformats the code one way and ESLint then reports an error demanding the opposite — an unfixable ping-pong (`eslint --fix` and `prettier --write` keep undoing each other).

If you run Prettier as the source of truth, **disable the rules below** in the ESLint flat config so ESLint stops policing formatting Prettier already owns.

## The conflicting rules

| Rule | What ESLint wants | What Prettier does | Where it bit us |
| --- | --- | --- | --- |
| `@stylistic/no-extra-parens` | No parentheses around a conditional (ternary) arrow body: `(o) => cond ? a : b` | Wraps the ternary in parens: `(o) => (cond ? a : b)` | `packages/email/email/src/utils/validation/check-feature-support.ts` (the `CAPABILITY_PROBES` `detect` arrows) |
| `no-confusing-arrow` | The **opposite** of the above — *requires* parens/braces around an arrow returning a conditional | (satisfied by Prettier's parens) | same file — removing the parens to satisfy `no-extra-parens` immediately trips this one, so the two rules are mutually unsatisfiable without Prettier's form |
| `@stylistic/operator-linebreak` | `=` (and other operators) at the **beginning** of a wrapped line | Puts the operator at the **end** of the previous line | `packages/email/email/src/mail.ts` (the wrapped `let emailOptions =` in `draft()`) |
| `generator-star-spacing` | Specific `*` spacing for generators, e.g. `async* fn()` | Formats as `async *fn()` | `packages/email/email/src/mail.ts` (`async* sendMany`) |
| `@stylistic/generator-star-spacing` | Same as above (the `@stylistic` clone) | same | same |

> `no-confusing-arrow` + `@stylistic/no-extra-parens` are a true catch-22: one demands the parens, the other forbids them. Only Prettier's chosen form satisfies `no-confusing-arrow`, so if you keep Prettier you must drop `@stylistic/no-extra-parens` (not the other way around).

## Drop-in flat-config override (when Prettier is authoritative)

```js
// eslint.config.js
export default [
    // ...existing config
    {
        rules: {
            "@stylistic/no-extra-parens": "off",
            "@stylistic/operator-linebreak": "off",
            "@stylistic/generator-star-spacing": "off",
            "generator-star-spacing": "off",
            // `no-confusing-arrow` can stay on — Prettier's parens satisfy it.
        },
    },
];
```

## Current state of the code

Right now ESLint is authoritative for `mail.ts` (the operator-linebreak / generator-star forms were left in the ESLint-preferred shape). The only spot that needed Prettier's form is the ternary arrows in `check-feature-support.ts`, which carry a scoped inline directive:

```ts
/* eslint-disable @stylistic/no-extra-parens -- prettier wraps these conditional arrow bodies in parens (also required by no-confusing-arrow). */
```

If you adopt the global override above, that inline `eslint-disable` block in `check-feature-support.ts` becomes redundant and can be removed (otherwise it may surface as an unused-disable-directive once the rule is off globally).

_Discovered while adding the email capability guard; see also the repo memory note on the package-wide formatter conflict in `@visulima/fs`._
