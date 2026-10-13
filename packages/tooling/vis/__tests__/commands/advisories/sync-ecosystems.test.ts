import { describe, expect, it } from "vitest";

import { parseEcosystems } from "../../../src/commands/advisories/sync";

/**
 * `advisories sync` downloads `&lt;bucket>/&lt;name>/all.zip`, and the OSV bucket names are case-sensitive.
 * Aliases must therefore be mapped to the OSV name before the download.
 */
describe(parseEcosystems, () => {
    it("defaults to npm when no ecosystem is given", () => {
        expect.assertions(1);

        expect(parseEcosystems(undefined)).toStrictEqual(["npm"]);
    });

    it("maps lowercase aliases to their OSV bucket names", () => {
        expect.assertions(2);

        expect(parseEcosystems("hex")).toStrictEqual(["Hex"]);
        expect(parseEcosystems("cargo, pypi,go")).toStrictEqual(["crates.io", "PyPI", "Go"]);
    });
});
