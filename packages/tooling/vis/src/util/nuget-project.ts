/**
 * Minimal reader for the MSBuild XML of a NuGet project (`*.csproj`, `*.fsproj`),
 * `Directory.Build.props` and `Directory.Build.targets`.
 *
 * This is not an XML parser. It masks comments, then matches the property elements
 * vis needs by name. Every occurrence of a name must have the plain form
 * `&lt;Name>value&lt;/Name>` on one line, inside an unconditional `PropertyGroup`. Any
 * other form throws, so a declaration vis cannot read never hides a version.
 */

export class NuGetReadError extends Error {
    public readonly file: string;

    public constructor(file: string, message: string) {
        super(message);
        this.name = "NuGetReadError";
        this.file = file;
    }
}

export interface NuGetPropertyValue {
    /** 1-based line of the element in the raw file. */
    line: number;
    value: string;
}

/** Replace each comment with spaces, keeping newlines, so offsets and line numbers stay the same. */
export const maskXmlComments = (raw: string): string => raw.replaceAll(/<!--[\s\S]*?-->/g, (comment) => comment.replaceAll(/[^\n]/g, " "));

interface PropertyGroupRange {
    conditional: boolean;
    end: number;
    start: number;
}

const propertyGroupRanges = (masked: string): PropertyGroupRange[] => {
    const ranges: PropertyGroupRange[] = [];
    const open: Omit<PropertyGroupRange, "end">[] = [];

    for (const match of masked.matchAll(/<PropertyGroup(\s[^>]*)?>|<\/PropertyGroup\s*>/g)) {
        if (match[0].startsWith("</")) {
            const group = open.pop();

            if (group !== undefined) {
                ranges.push({ ...group, end: match.index });
            }
        } else {
            open.push({ conditional: /\sCondition\s*=/.test(match[1] ?? ""), start: match.index });
        }
    }

    return ranges;
};

/** True when `name` appears as an element anywhere in the file, in any form. */
export const hasElement = (raw: string, name: string): boolean => new RegExp(String.raw`<${name}\b`).test(maskXmlComments(raw));

/**
 * Every `&lt;name>value&lt;/name>` in the file, as a literal on one line inside an
 * unconditional `PropertyGroup`. Throws `NuGetReadError` for any other occurrence.
 */
export const readNuGetProperty = (raw: string, file: string, name: string): NuGetPropertyValue[] => {
    const masked = maskXmlComments(raw);
    const occurrences = [...masked.matchAll(new RegExp(String.raw`<${name}\b`, "g"))].length;
    const plain = [...masked.matchAll(new RegExp(String.raw`<${name}>([^<\n]*)</${name}>`, "g"))];

    if (occurrences !== plain.length) {
        throw new NuGetReadError(file, `${file} sets ${name} in a form vis cannot read. Write <${name}>1.0.0</${name}> on one line inside an unconditional PropertyGroup.`);
    }

    const groups = propertyGroupRanges(masked);

    return plain.map((match) => {
        const offset = match.index;
        const group = groups.find((range) => offset > range.start && offset < range.end);

        if (group === undefined) {
            throw new NuGetReadError(file, `${file} sets ${name} outside a PropertyGroup. vis reads only property elements.`);
        }

        if (group.conditional) {
            throw new NuGetReadError(file, `${file} sets ${name} in a conditional PropertyGroup. vis cannot tell whether that condition holds.`);
        }

        return { line: masked.slice(0, offset).split("\n").length, value: (match[1] ?? "").trim() };
    });
};

/**
 * Write `value` as the `&lt;name>` literal on `line` (1-based). The line is re-checked,
 * so an edit that moved the element throws instead of writing to the wrong place.
 */
export const replaceNuGetPropertyOnLine = (raw: string, file: string, name: string, line: number, value: string): string => {
    const lines = raw.split("\n");
    const target = lines[line - 1];
    const pattern = new RegExp(`(<${name}>)[^<]*(</${name}>)`);

    if (target === undefined || !pattern.test(target)) {
        throw new NuGetReadError(file, `${file} has no ${name} literal on line ${line} to bump.`);
    }

    lines[line - 1] = target.replace(pattern, (_all, open: string, close: string) => `${open}${value}${close}`);

    return lines.join("\n");
};
