/**
 * Masking reader for Maven pom.xml files, shared by the release and task-graph code.
 *
 * The pom is read with a masking scanner rather than an XML parser: comments and
 * the blocks that are not the project's own are blanked to spaces of the same
 * length, so every offset found in the masked text is also an offset in the raw
 * text, and an edit can rewrite one value in place.
 */

/** A value's span in the pom text, so an edit can rewrite it without touching the formatting around it. */
export interface PomSlot {
    end: number;
    start: number;
    value: string;
}

export interface PomDependency {
    artifactId?: PomSlot;
    groupId?: PomSlot;
    scope?: PomSlot;
    version?: PomSlot;
}

export interface PomScan {
    artifactId?: PomSlot;
    dependencies: PomDependency[];
    groupId?: PomSlot;
    modules: string[];
    parent?: { artifactId?: PomSlot; groupId?: PomSlot; relativePath?: string; version?: PomSlot };
    properties: Map<string, PomSlot>;
    version?: PomSlot;
}

/** Blocks the project-root reads must never see: their `&lt;version>` and `&lt;groupId>` belong to something else. */
const NON_ROOT_BLOCKS = ["build", "dependencyManagement", "distributionManagement", "pluginRepositories", "profiles", "reporting", "repositories"] as const;

/** Blocks read separately, so the root scan skips them too. */
const SEPARATE_BLOCKS = ["dependencies", "modules", "parent", "properties"] as const;

const blank = (text: string): string => " ".repeat(text.length);

const maskComments = (xml: string): string => xml.replaceAll(/<!--[\s\S]*?-->/g, blank);

const maskBlocks = (xml: string, tags: ReadonlyArray<string>): string => xml.replaceAll(new RegExp(String.raw`<(${tags.join("|")})\b[^>]*>[\s\S]*?</\1>`, "g"), blank);

/** The span between an opening and its closing tag (first occurrence), or undefined. */
const innerRange = (text: string, tag: string): { end: number; start: number } | undefined => {
    const open = new RegExp(String.raw`<${tag}(?:\s[^>]*)?>`).exec(text);

    if (!open) {
        return undefined;
    }

    const start = open.index + open[0].length;
    const end = text.indexOf(`</${tag}>`, start);

    return end === -1 ? undefined : { end, start };
};

/** The simple `&lt;tag>value&lt;/tag>` element inside `scope`, where `base` is the raw offset of `scope[0]`. */
const field = (scope: string, base: number, tag: string): PomSlot | undefined => {
    const match = new RegExp(String.raw`<${tag}>(\s*)([^<]*?)\s*</${tag}>`).exec(scope);

    if (!match) {
        return undefined;
    }

    const start = base + match.index + tag.length + 2 + match[1]!.length;

    return { end: start + match[2]!.length, start, value: match[2]! };
};

/** Read a pom's project-root coordinates, parent, properties, modules and top-level dependencies. */
export const scanPom = (raw: string): PomScan => {
    const comments = maskComments(raw);
    const nested = maskBlocks(comments, NON_ROOT_BLOCKS);
    const root = maskBlocks(nested, SEPARATE_BLOCKS);
    const scan: PomScan = {
        artifactId: field(root, 0, "artifactId"),
        dependencies: [],
        groupId: field(root, 0, "groupId"),
        modules: [],
        properties: new Map(),
        version: field(root, 0, "version"),
    };

    const parent = innerRange(nested, "parent");

    if (parent) {
        const scope = nested.slice(parent.start, parent.end);
        const relativePath = /<relativePath>\s*([^<]*?)\s*<\/relativePath>/.exec(raw.slice(parent.start, parent.end))?.[1];

        scan.parent = {
            artifactId: field(scope, parent.start, "artifactId"),
            groupId: field(scope, parent.start, "groupId"),
            relativePath,
            version: field(scope, parent.start, "version"),
        };
    }

    const properties = innerRange(nested, "properties");

    if (properties) {
        const scope = nested.slice(properties.start, properties.end);

        for (const match of scope.matchAll(/<([A-Z_][\w.-]*)>(\s*)([^<]*?)\s*<\/\1>/gi)) {
            const start = properties.start + match.index + match[1]!.length + 2 + match[2]!.length;

            scan.properties.set(match[1]!, { end: start + match[3]!.length, start, value: match[3]! });
        }
    }

    const modules = innerRange(nested, "modules");

    if (modules) {
        for (const match of nested.slice(modules.start, modules.end).matchAll(/<module>\s*([^<]+?)\s*<\/module>/g)) {
            scan.modules.push(match[1]!);
        }
    }

    const dependencies = innerRange(nested, "dependencies");

    if (dependencies) {
        const scope = maskBlocks(nested.slice(dependencies.start, dependencies.end), ["exclusions"]);

        for (const match of scope.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
            const base = dependencies.start + match.index + "<dependency>".length;

            scan.dependencies.push({
                artifactId: field(match[1]!, base, "artifactId"),
                groupId: field(match[1]!, base, "groupId"),
                scope: field(match[1]!, base, "scope"),
                version: field(match[1]!, base, "version"),
            });
        }
    }

    return scan;
};

/** Replace each slot with its value, last slot first so earlier offsets stay valid. */
export const applySlotEdits = (raw: string, edits: ReadonlyArray<{ slot: PomSlot; value: string }>): string => {
    let out = raw;

    for (const { slot, value } of [...edits].sort((a, b) => b.slot.start - a.slot.start)) {
        out = `${out.slice(0, slot.start)}${value}${out.slice(slot.end)}`;
    }

    return out;
};

/** `project.groupId`, or the parent's groupId when the pom does not declare one. */
export const effectiveGroupId = (scan: PomScan): string | undefined => scan.groupId?.value ?? scan.parent?.groupId?.value;

/**
 * The `groupId:artifactId` a dependency points at, resolving `${project.groupId}`
 * against the dependent's own groupId. Undefined when either part is unknown.
 */
export const dependencyName = (scan: PomScan, dependency: PomDependency): string | undefined => {
    const group = dependency.groupId?.value === "${project.groupId}" ? effectiveGroupId(scan) : dependency.groupId?.value;
    const artifact = dependency.artifactId?.value;

    return group === undefined || artifact === undefined ? undefined : `${group}:${artifact}`;
};

/** A `${name}` reference rather than a literal value. */
export const isPropertyReference = (value: string): boolean => value.includes("${");

/**
 * A single exact version a release can rewrite. A property reference and a
 * Maven range (`[1.0,2.0)`, `(,2.0]`) are not: a range accepts several versions,
 * so it is not a pin to move.
 */
export const isPinned = (value: string): boolean => !isPropertyReference(value) && !/^[[(]/.test(value);
