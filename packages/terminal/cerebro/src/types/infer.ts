import type { ArgumentDefinition, EnvDefinitionRecord, OptionDefinitionRecord } from "./command";
import type { OptionNameToCamelCase } from "./option-types";

/**
 * Folds a name the way the parser folds it.
 *
 * A direct transcription of `command-line-args`' `/-([a-z])/g`: a hyphen folds
 * into the following character *only* when that character is an ASCII lowercase
 * letter. `a-1` and `x-` are left alone, `A-b` becomes `AB`, and a name with no
 * hyphen is returned untouched — including `outputDir`, `UPPER` and `HTTPProxy`.
 *
 * Positional names go through the same fold at runtime (`foldName` in
 * `resolve-arguments.ts`), so one type serves both surfaces. Environment
 * variables do not — they lowercase first, which is what
 * {@link OptionNameToCamelCase} models.
 */
type FoldName<T extends string> = T extends `${infer Head}-${infer Tail}`
    ? Tail extends `${infer First}${infer Rest}`
        ? Lowercase<First> extends First
            ? Uppercase<First> extends Lowercase<First>
                ? `${Head}-${FoldName<Tail>}`
                : `${Head}${Uppercase<First>}${FoldName<Rest>}`
            : `${Head}-${FoldName<Tail>}`
        : `${Head}-`
    : T;

/**
 * The value a `type` constructor produces. Falls back to `string` when no `type`
 * is declared, matching the parser, which leaves untyped values as raw strings.
 *
 * Not modelled: `TypeConstructor&lt;T>` is declared as returning `T | undefined`, so
 * a transform that genuinely returns `undefined` is still typed as `T` here.
 */
type TypeConstructorResult<D> = D extends { type: (...arguments_: never[]) => infer R } ? Exclude<R, undefined> : string;

/** `multiple` / `lazyMultiple` collect every occurrence into an array. */
type Collected<D> = D extends { lazyMultiple: true } | { multiple: true } ? TypeConstructorResult<D>[] : TypeConstructorResult<D>;

/** Whether a `defaultValue` was declared, which fills the gap when the flag is absent. */
type HasDefault<D> = "defaultValue" extends keyof D ? true : false;

/**
 * Whether a **boolean** option is declared. `listMissingArguments` short-circuits
 * missing required booleans instead of raising, and the substituted `false` never
 * reaches `parsedArgs._all` — so a required boolean can still be absent from the
 * toolbox at runtime and must keep its `| undefined`.
 */
type IsBooleanOption<D> = D extends { type: BooleanConstructor } ? true : false;

/**
 * Whether an **option** is guaranteed a value.
 *
 * `required` is enforced before `execute` runs, and a `defaultValue` fills the
 * gap when the flag is absent — except for booleans, which
 * `listMissingArguments` lets through (see {@link IsBooleanOption}).
 */
type IsOptionAlwaysPresent<D> = D extends { required: true } ? (IsBooleanOption<D> extends true ? HasDefault<D> : true) : HasDefault<D>;

/**
 * Whether a **positional** is guaranteed a value.
 *
 * No boolean exception here: `resolveArguments` reports every unfilled
 * `required` slot whatever its `type`, and `applyNamedArguments` raises before
 * `execute` runs. A required boolean positional really is always present.
 */
type IsArgumentAlwaysPresent<D> = D extends { required: true } ? true : HasDefault<D>;

/**
 * Keys declared as `no-x` produce an `x` option instead. `addNegatableOptions`
 * generates the counterpart definition and `mapNegatableOptions` rewrites the
 * parsed value onto the non-negated key, deleting `noX` — so `no-x` never
 * surfaces on the toolbox under its own name.
 */
type PositiveOptionKeys<R> = { [K in keyof R]: K extends `no-${string}` ? never : K }[keyof R];

/**
 * The positive names cerebro *generates* from a `no-x` declaration.
 *
 * Only when `x` is not declared itself. `negatable()` declares both halves, and
 * a positive half without a `defaultValue` stays `undefined` when neither flag
 * is passed — `mapNegatableOptions` rewrites nothing because the negated key
 * never reaches the parsed options. Claiming `boolean` there would erase a
 * deliberate tri-state.
 */
type NegatedOptionKeys<R> = { [K in keyof R]: K extends `no-${infer Rest}` ? (Rest extends keyof R ? never : Rest) : never }[keyof R];

/** Collapses an intersection into a single object literal so tooltips stay readable. */
type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Infers the shape of `toolbox.options` from a record of option definitions.
 *
 * Option names are folded the way the parser folds them, `required: true` or a
 * `defaultValue` drops the `| undefined`, and `multiple` produces an array.
 *
 * Not modelled: values injected by `implies`, which is an untyped
 * `Record&lt;string, unknown>` and can name any option.
 * @example
 * ```typescript
 * type Options = InferOptions<{
 *   "output-dir": { required: true; type: StringConstructor };
 *   verbose: { type: BooleanConstructor };
 * }>;
 * // { outputDir: string; verbose: boolean | undefined }
 * ```
 */
type InferOptions<R extends OptionDefinitionRecord> = Simplify<
    {
        // A generated counterpart always resolves to a value: `addNegatableOptions`
        // gives it a `defaultValue`.
        [K in NegatedOptionKeys<R> & string as FoldName<K>]: boolean;
    } & {
        [K in PositiveOptionKeys<R> & string as FoldName<K>]: IsOptionAlwaysPresent<R[K]> extends true ? Collected<R[K]> : Collected<R[K]> | undefined;
    }
>;

/**
 * Infers the shape of `toolbox.env` from a record of environment definitions.
 *
 * `processEnvVariables` lowercases the whole name before folding snake segments,
 * so `API_KEY` becomes `apiKey` and an already-camelCase `apiKey` becomes
 * `apikey` — which is what {@link OptionNameToCamelCase} models. Only a
 * `defaultValue` removes the `| undefined`; environment variables have no
 * `required` concept.
 * @example
 * ```typescript
 * type Env = InferEnv<{ API_KEY: { type: StringConstructor } }>;
 * // { apiKey: string | undefined }
 * ```
 */
type InferEnv<R extends EnvDefinitionRecord> = Simplify<{
    [K in keyof R & string as OptionNameToCamelCase<K>]: HasDefault<R[K]> extends true ? TypeConstructorResult<R[K]> : TypeConstructorResult<R[K]> | undefined;
}>;

/** Picks the positional definition carrying a given name out of the tuple. */
type ArgumentNamed<T extends ReadonlyArray<ArgumentDefinition>, N extends string> = Extract<T[number], { name: N }>;

/**
 * Infers the shape of `toolbox.args` from a tuple of positional definitions.
 *
 * Positional names are camelCased, `multiple: true` on the final entry produces
 * an array, and `required: true` or a `defaultValue` drops the `| undefined`.
 *
 * Slot order matters, so `arguments` is an array rather than a record. The tuple
 * is captured by a `const` type parameter on `defineCommand`, so no `as const` is
 * needed at the call site.
 * @example
 * ```typescript
 * type Args = InferArguments<
 *     [{ name: "source"; required: true; type: StringConstructor }, { multiple: true; name: "targets"; type: StringConstructor }]
 * >;
 * // { source: string; targets: string[] | undefined }
 * ```
 */
type InferArguments<T extends ReadonlyArray<ArgumentDefinition>> = Simplify<{
    [K in T[number]["name"] as FoldName<K>]: IsArgumentAlwaysPresent<ArgumentNamed<T, K>> extends true
        ? Collected<ArgumentNamed<T, K>>
        : Collected<ArgumentNamed<T, K>> | undefined;
}>;

export type { InferArguments, InferEnv, InferOptions };
