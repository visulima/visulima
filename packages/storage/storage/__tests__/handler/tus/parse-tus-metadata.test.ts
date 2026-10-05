import { describe, expect, it } from "vitest";

import { parseTusMetadata } from "../../../src";

// Exported so code in front of the handler (an authorization or size check) reads `Upload-Metadata`
// exactly as the handler stores it, instead of keeping a copy of the parser that drifts.
describe(parseTusMetadata, () => {
    it("parses a header as the TUS handler does", () => {
        expect.assertions(1);

        expect({ ...parseTusMetadata(`filename ${btoa("a.png")}, filetype ${btoa("image/png")},flag`) }).toStrictEqual({
            filename: "a.png",
            filetype: "image/png",
            flag: "",
        });
    });

    it.each(["a b c", `x ${btoa("1")},x ${btoa("2")}`, `uploadConcat ${btoa("partial")}`, `_writeClaim ${btoa("x")}`, "filetype %%%"])(
        "refuses %j with 400",
        (header) => {
            expect.assertions(1);

            expect(() => parseTusMetadata(header)).toThrow(expect.objectContaining({ statusCode: 400 }));
        },
    );
});
