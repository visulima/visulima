import { dirname, resolve } from "@visulima/path";
import { describe, expect, it } from "vitest";

import resolveSymlinkTarget from "../../../../src/ensure/utils/resolve-symlink-target";

describe(resolveSymlinkTarget, () => {
    it("should return the target if it is a URL", () => {
        expect.assertions(1);

        // eslint-disable-next-line compat/compat
        const target = new URL("https://example.com");
        const linkName = "link";

        const result = resolveSymlinkTarget(target, linkName);

        expect(result).toBe(target);
    });

    it("should return the resolved target if it starts with \"./\"", () => {
        expect.assertions(1);

        const target = "./path/to/file";
        const linkName = "link";

        const result = resolveSymlinkTarget(target, linkName);

        expect(result).toBe(resolve(target));
    });

    it("should return the resolved target with the directory name of linkName if linkName is a string", () => {
        expect.assertions(1);

        const target = "file";
        const linkName = "/path/to/link";

        const result = resolveSymlinkTarget(target, linkName);

        expect(result).toBe(resolve(dirname(linkName), target));
    });

    it("should return a new URL with the target and linkName if linkName is a URL", () => {
        expect.assertions(1);

        const target = "file";
        // eslint-disable-next-line compat/compat
        const linkName = new URL("https://example.com");

        const result = resolveSymlinkTarget(target, linkName);

        // eslint-disable-next-line compat/compat
        expect(result).toStrictEqual(new URL(target, linkName));
    });
});
