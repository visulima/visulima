import { describe, expect, it } from "vitest";

import inferExportType from "../../../src/utils/infer-export-type";

describe("inferExportType", () => {
    it("should infers export type by condition", () => {
        expect.assertions(4);

        expect(inferExportType("import", [])).toBe("esm");
        expect(inferExportType("require", [])).toBe("cjs");
        expect(inferExportType("node", [])).toBe("esm");
        expect(inferExportType("some_unknown_condition", [])).toBe("esm");
    });

    it("should infers export type based on previous conditions", () => {
        expect.assertions(4);

        expect(inferExportType("import", ["require"])).toBe("esm");
        expect(inferExportType("node", ["require"])).toBe("cjs");
        expect(inferExportType("node", ["import"])).toBe("esm");
        expect(inferExportType("node", ["unknown", "require"])).toBe("cjs");
    });

    it("should infers export type based on filename", () => {
        expect.assertions(3);

        expect(inferExportType("import", [], "file.d.ts")).toBe("esm");
        expect(inferExportType("import", [], "file.mjs")).toBe("esm");
        expect(inferExportType("import", [], "file.cjs")).toBe("cjs");
    });

    it("should default to esm if no conditions are met", () => {
        expect.assertions(1);

        expect(inferExportType("unknown", [])).toBe("esm");
    });

    it("should use package.json type if no conditions are met", () => {
        expect.assertions(1);

        expect(inferExportType("unknown", [], undefined, "commonjs")).toBe("cjs");
    })
});
