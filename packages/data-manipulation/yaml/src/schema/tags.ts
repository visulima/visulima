/**
 * Custom scalar tags.
 *
 * A tag teaches the parser one extra scalar type: how to recognise it (by an
 * explicit `!!name`, or implicitly via `test`), how to turn its text into a
 * value, and how to write that value back out.
 *
 * The shape mirrors `yaml`'s `ScalarTag` minus the node-model parameters, which
 * have no meaning here — this parser produces native values directly, so
 * `resolve` receives the raw text and `stringify` receives the value itself.
 * Collection tags are not supported for the same reason.
 */

import { YAMLParseError } from "../errors";

/** One custom scalar type. */
interface ScalarTag {
    /**
     * Participate in *implicit* resolution — an untagged scalar matching
     * {@link ScalarTag.test} resolves through this tag. Without it the tag only
     * applies when written explicitly (`!!name value`).
     * @default false
     */
    default?: boolean;

    /** Recognise a JS value as belonging to this tag, used when serializing. */
    identify?: (value: unknown) => boolean;

    /** Turn the scalar's raw text into a value. */
    resolve: (raw: string) => unknown;

    /** Render a value back to scalar text. Defaults to `String(value)`. */
    stringify?: (value: unknown) => string;

    /**
     * The tag name. Either a local `!name` / `!!name`, or a fully qualified
     * `tag:domain,date:name`.
     */
    tag: string;

    /** Pattern an untagged scalar must match for implicit resolution. */
    test?: RegExp;
}

/** What the `customTags` option accepts. */
type CustomTags = ScalarTag[] | ((tags: ScalarTag[]) => ScalarTag[]);

/**
 * A tag is addressable by the shorthand the document uses and by the resolved
 * form the parser produces, so both spellings are indexed.
 *
 * `!!name` expands to `tag:yaml.org,2002:name`, which is what the parser has in
 * hand by the time a tag is applied.
 */
const tagAliases = (tag: string): string[] => {
    if (tag.startsWith("!!")) {
        return [tag, `tag:yaml.org,2002:${tag.slice(2)}`];
    }

    return [tag];
};

/** Custom tags indexed for lookup during a parse. */
interface TagRegistry {
    /** Every tag, keyed by each spelling it answers to. */
    byTag: Map<string, ScalarTag>;

    /** Tags eligible for implicit resolution, in declaration order. */
    implicit: (ScalarTag & { test: RegExp })[];
}

const buildTagRegistry = (customTags: CustomTags | undefined): TagRegistry | undefined => {
    if (!customTags) {
        return undefined;
    }

    const tags = typeof customTags === "function" ? customTags([]) : customTags;

    if (!Array.isArray(tags)) {
        throw new YAMLParseError("customTags must be an array of tags, or a function returning one");
    }

    if (tags.length === 0) {
        return undefined;
    }

    const byTag = new Map<string, ScalarTag>();
    const implicit: (ScalarTag & { test: RegExp })[] = [];

    for (const tag of tags) {
        for (const alias of tagAliases(tag.tag)) {
            byTag.set(alias, tag);
        }

        if (tag.default && tag.test) {
            // A caller's `test` may carry the `g` or `y` flag, which makes
            // `test()` stateful through `lastIndex` — the same scalar would then
            // match only every other time. Rebuild without them so implicit
            // resolution is deterministic.
            const test = tag.test.flags.includes("g") || tag.test.flags.includes("y")
                ? new RegExp(tag.test.source, tag.test.flags.replaceAll(/[gy]/gu, ""))
                : tag.test;

            implicit.push({ ...tag, test });
        }
    }

    return { byTag, implicit };
};

/**
 * Resolve `raw` through the first implicit tag whose `test` matches, or return
 * `undefined` to leave it to the schema.
 */
const resolveImplicitTag = (registry: TagRegistry | undefined, raw: string): { value: unknown } | undefined => {
    if (!registry) {
        return undefined;
    }

    for (const tag of registry.implicit) {
        if (tag.test.test(raw)) {
            return { value: tag.resolve(raw) };
        }
    }

    return undefined;
};

/** Render `value` if some tag claims it, prefixed with that tag. */
const stringifyCustomTag = (tags: ScalarTag[] | undefined, value: unknown): string | undefined => {
    if (!tags) {
        return undefined;
    }

    for (const tag of tags) {
        if (tag.identify?.(value)) {
            const text = tag.stringify ? tag.stringify(value) : String(value);

            return `${tag.tag} ${text}`;
        }
    }

    return undefined;
};

export type { CustomTags, ScalarTag, TagRegistry };
export { buildTagRegistry, resolveImplicitTag, stringifyCustomTag };
