import { describe, expect, it } from "vitest";

import { BEL, OSC } from "../../src/constants";
import type { IITerm2Payload, ITerm2FileProps as ITerm2FileProperties } from "../../src/iterm2";
import {
    IT2_AUTO,
    it2Cells,
    it2Percent,
    it2Pixels,
    iTerm2 as indexTerm2,
    ITerm2File,
    ITerm2FileEnd,
    ITerm2FilePart,
    ITerm2MultipartFileStart,
} from "../../src/iterm2";

describe("iTerm2 Integration", () => {
    describe("dimension Helpers", () => {
        it("iT2_AUTO should be correct", () => {
            expect.assertions(1);

            expect(IT2_AUTO).toBe("auto");
        });

        it("it2Cells should format correctly", () => {
            expect.assertions(1);

            expect(it2Cells(100)).toBe("100");
        });

        it("it2Pixels should format correctly", () => {
            expect.assertions(1);

            expect(it2Pixels(150)).toBe("150px");
        });

        it("it2Percent should format correctly", () => {
            expect.assertions(1);

            expect(it2Percent(50)).toBe("50%");
        });
    });

    describe("iTerm2 ANSI Sequences", () => {
        describe("iTerm2 main function", () => {
            it("should correctly format a sequence with a valid payload", () => {
                expect.assertions(1);

                const payload: IITerm2Payload = { toString: () => "TestPayload" };

                expect(indexTerm2(payload)).toBe(`${OSC}1337;TestPayload${BEL}`);
            });

            it("should return an empty string for a null payload", () => {
                expect.assertions(1);

                expect(() => indexTerm2(null as any)).toThrow("Invalid payload: must implement IITerm2Payload with a custom toString method");
            });

            it("should return an empty string for a payload with no toString", () => {
                expect.assertions(1);

                expect(() => indexTerm2({} as any)).toThrow("Invalid payload: must implement IITerm2Payload with a custom toString method");
            });

            it("should return an empty string for a payload with Object.prototype.toString", () => {
                expect.assertions(1);

                const payload = { foo: "bar" }; // Uses Object.prototype.toString

                expect(() => indexTerm2(payload as any)).toThrow("Invalid payload: must implement IITerm2Payload with a custom toString method");
            });
        });

        describe("iTerm2File", () => {
            it("should format with minimal props (content only)", () => {
                expect.assertions(2);

                const properties: ITerm2FileProperties = { content: "QWxhZGRpbjpvcGVuIHNlc2FtZQ==" }; // "Aladdin:open sesame"
                const file = new ITerm2File(properties);

                expect(file.toString()).toBe("File=:QWxhZGRpbjpvcGVuIHNlc2FtZQ==");
                expect(indexTerm2(file)).toBe(`${OSC}1337;File=:QWxhZGRpbjpvcGVuIHNlc2FtZQ==${BEL}`);
            });

            it("should format with all props", () => {
                expect.assertions(2);

                const properties: ITerm2FileProperties = {
                    content: "SGVsbG8gd29ybGQ=", // "Hello world"
                    doNotMoveCursor: true,
                    height: it2Percent(50),
                    ignoreAspectRatio: true,
                    inline: true,
                    name: "my file.txt", // Will not be base64 encoded by this simple impl
                    size: 12_345,
                    width: it2Pixels(100),
                };
                const file = new ITerm2File(properties);
                const expectedPayload
                    = "File=name=my file.txt;size=12345;width=100px;height=50%;preserveAspectRatio=0;inline=1;doNotMoveCursor=1:SGVsbG8gd29ybGQ=";

                expect(file.toString()).toBe(expectedPayload);
                expect(indexTerm2(file)).toBe(`${OSC}1337;${expectedPayload}${BEL}`);
            });

            it("should format with numeric width/height (interpreted as cells)", () => {
                expect.assertions(1);

                const properties: ITerm2FileProperties = { content: "YQ==", height: 24, width: 80 };
                const file = new ITerm2File(properties);

                expect(file.toString()).toBe("File=width=80;height=24:YQ==");
            });
        });

        describe("iTerm2MultipartFileStart", () => {
            it("should format with name and size", () => {
                expect.assertions(2);

                const properties: Omit<ITerm2FileProperties, "content"> = {
                    inline: true, // Should be included
                    name: "archive.zip",
                    size: 98_765,
                };
                const start = new ITerm2MultipartFileStart(properties);
                const expectedPayload = "MultipartFile=name=archive.zip;size=98765;inline=1";

                expect(start.toString()).toBe(expectedPayload);
                expect(indexTerm2(start)).toBe(`${OSC}1337;${expectedPayload}${BEL}`);
            });
        });

        describe("iTerm2FilePart", () => {
            it("should format with base64 chunk", () => {
                expect.assertions(2);

                const chunk = "Y2h1bmsx";
                const part = new ITerm2FilePart(chunk);
                const expectedPayload = `FilePart=${chunk}`;

                expect(part.toString()).toBe(expectedPayload);
                expect(indexTerm2(part)).toBe(`${OSC}1337;${expectedPayload}${BEL}`);
            });
        });

        describe("iTerm2FileEnd", () => {
            it("should format correctly", () => {
                expect.assertions(2);

                const end = new ITerm2FileEnd();
                const expectedPayload = "FileEnd";

                expect(end.toString()).toBe(expectedPayload);
                expect(indexTerm2(end)).toBe(`${OSC}1337;${expectedPayload}${BEL}`);
            });
        });
    });
});
