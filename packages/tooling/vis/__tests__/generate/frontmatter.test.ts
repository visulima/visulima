import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import { splitFrontmatter } from "../../src/generate/moon-adapter/frontmatter";

const parse = (yaml: string): unknown => parseYaml(yaml) as unknown;

describe(splitFrontmatter, () => {
    it("should leave files without frontmatter untouched", () => {
        expect.assertions(2);

        const result = splitFrontmatter("hello world\n", parse);

        expect(result.body).toBe("hello world\n");
        expect(result.frontmatter).toBeUndefined();
    });

    it("should parse a basic frontmatter block", () => {
        expect.assertions(2);

        const source = `---\nto: src/[name].ts\nforce: true\n---\nbody\n`;
        const result = splitFrontmatter(source, parse);

        expect(result.body).toBe("body\n");
        expect(result.frontmatter).toStrictEqual({ force: true, to: "src/[name].ts" });
    });

    it("should ignore frontmatter when there's no closing fence", () => {
        expect.assertions(2);

        const source = `---\nto: foo\nbody without close`;
        const result = splitFrontmatter(source, parse);

        expect(result.body).toBe(source);
        expect(result.frontmatter).toBeUndefined();
    });

    it("should support `if` and `skip` keys", () => {
        expect.assertions(1);

        const source = `---\nif: includeReadme\nskip: false\n---\nbody`;
        const result = splitFrontmatter(source, parse);

        expect(result.frontmatter).toStrictEqual({ if: "includeReadme", skip: false });
    });

    it("should reject non-mapping frontmatter", () => {
        expect.assertions(1);

        const source = `---\n- a\n- b\n---\nbody`;

        expect(() => splitFrontmatter(source, parse)).toThrow(/mapping/);
    });

    it("should handle CRLF line endings", () => {
        expect.assertions(2);

        const source = "---\r\nto: foo\r\n---\r\nbody";
        const result = splitFrontmatter(source, parse);

        expect(result.frontmatter).toStrictEqual({ to: "foo" });
        expect(result.body).toBe("body");
    });
});
