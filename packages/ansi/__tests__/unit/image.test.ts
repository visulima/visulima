import { describe, expect, it } from "vitest";

import { BEL, OSC } from "../../src/constants";
import { image } from "../../src/image";

describe("image (iTerm2 protocol)", () => {
    const mockData = new Uint8Array([1, 2, 3, 4, 5]);
    const mockDataB64 = Buffer.from(mockData).toString("base64");

    it("should generate basic image sequence with inline data", () => {
        expect.assertions(1);

        const expected = `${OSC}1337;File=inline=1:${mockDataB64}${BEL}`;

        expect(image(mockData)).toBe(expected);
    });

    it("should include width option", () => {
        expect.assertions(1);

        const expected = `${OSC}1337;File=inline=1;width=100:${mockDataB64}${BEL}`;

        expect(image(mockData, { width: 100 })).toBe(expected);
    });

    it("should include height option", () => {
        expect.assertions(1);

        const expected = `${OSC}1337;File=inline=1;height=50px:${mockDataB64}${BEL}`;

        expect(image(mockData, { height: "50px" })).toBe(expected);
    });

    it("should include width and height options", () => {
        expect.assertions(1);

        const expected = `${OSC}1337;File=inline=1;width=auto;height=30%:${mockDataB64}${BEL}`;

        expect(image(mockData, { height: "30%", width: "auto" })).toBe(expected);
    });

    it("should include preserveAspectRatio=0 when false", () => {
        expect.assertions(1);

        const expected = `${OSC}1337;File=inline=1;preserveAspectRatio=0:${mockDataB64}${BEL}`;

        expect(image(mockData, { preserveAspectRatio: false })).toBe(expected);
    });

    it("should not include preserveAspectRatio when true or undefined", () => {
        expect.assertions(2);

        const expectedDefault = `${OSC}1337;File=inline=1:${mockDataB64}${BEL}`;

        expect(image(mockData, { preserveAspectRatio: true })).toBe(expectedDefault);
        expect(image(mockData, {})).toBe(expectedDefault);
    });

    it("should include all options", () => {
        expect.assertions(1);

        const expected = `${OSC}1337;File=inline=1;width=200;height=100;preserveAspectRatio=0:${mockDataB64}${BEL}`;

        expect(image(mockData, { height: 100, preserveAspectRatio: false, width: 200 })).toBe(expected);
    });

    it("should correctly encode different data", () => {
        expect.assertions(1);

        const differentData = new Uint8Array([10, 20, 30]);
        const differentDataB64 = Buffer.from(differentData).toString("base64");
        const expected = `${OSC}1337;File=inline=1:${differentDataB64}${BEL}`;

        expect(image(differentData)).toBe(expected);
    });

    it("should handle empty data array", () => {
        expect.assertions(1);

        const emptyData = new Uint8Array([]);
        const emptyDataB64 = Buffer.from(emptyData).toString("base64"); // will be ""
        const expected = `${OSC}1337;File=inline=1:${emptyDataB64}${BEL}`;

        expect(image(emptyData)).toBe(expected);
    });
});
