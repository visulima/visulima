import { describe, expect, it } from "vitest";

import { parseSgrMouse } from "../../../src/ink/mouse/ansi-parser";

describe(parseSgrMouse, () => {
    describe("click events", () => {
        it("should parse left click press", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<0;10;20M")).toStrictEqual({
                action: "press",
                button: "left",
                type: "click",
                x: 10,
                y: 20,
            });
        });

        it("should parse left click release", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<0;10;20m")).toStrictEqual({
                action: "release",
                button: "left",
                type: "click",
                x: 10,
                y: 20,
            });
        });

        it("should parse middle click press", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<1;3;4M")).toStrictEqual({
                action: "press",
                button: "middle",
                type: "click",
                x: 3,
                y: 4,
            });
        });

        it("should parse middle click release", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<1;3;4m")).toStrictEqual({
                action: "release",
                button: "middle",
                type: "click",
                x: 3,
                y: 4,
            });
        });

        it("should parse right click press", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<2;5;8M")).toStrictEqual({
                action: "press",
                button: "right",
                type: "click",
                x: 5,
                y: 8,
            });
        });

        it("should parse right click release", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<2;5;8m")).toStrictEqual({
                action: "release",
                button: "right",
                type: "click",
                x: 5,
                y: 8,
            });
        });
    });

    describe("drag events", () => {
        it("should parse left drag", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<32;15;25M")).toStrictEqual({
                action: "press",
                button: "left",
                type: "drag",
                x: 15,
                y: 25,
            });
        });

        it("should parse middle drag", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<33;15;25M")).toStrictEqual({
                action: "press",
                button: "middle",
                type: "drag",
                x: 15,
                y: 25,
            });
        });

        it("should parse right drag", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<34;15;25M")).toStrictEqual({
                action: "press",
                button: "right",
                type: "drag",
                x: 15,
                y: 25,
            });
        });

        it("should parse drag release", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<32;10;10m")).toStrictEqual({
                action: "release",
                button: "left",
                type: "drag",
                x: 10,
                y: 10,
            });
        });
    });

    describe("move events", () => {
        it("should parse mouse move", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<35;10;20M")).toStrictEqual({
                type: "move",
                x: 10,
                y: 20,
            });
        });
    });

    describe("scroll events", () => {
        it("should parse scroll up", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<64;10;20M")).toStrictEqual({
                direction: "scrollup",
                type: "scroll",
                x: 10,
                y: 20,
            });
        });

        it("should parse scroll down", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<65;10;20M")).toStrictEqual({
                direction: "scrolldown",
                type: "scroll",
                x: 10,
                y: 20,
            });
        });
    });

    describe("modifier bits", () => {
        it("should strip ctrl modifier from left click (16 + 0 = 16)", () => {
            expect.assertions(1);

            const result = parseSgrMouse("\u001B[<16;10;20M");

            expect(result).toStrictEqual({
                action: "press",
                button: "left",
                type: "click",
                x: 10,
                y: 20,
            });
        });

        it("should strip shift modifier from right click (4 + 2 = 6)", () => {
            expect.assertions(1);

            const result = parseSgrMouse("\u001B[<6;10;20M");

            expect(result).toStrictEqual({
                action: "press",
                button: "right",
                type: "click",
                x: 10,
                y: 20,
            });
        });

        it("should strip meta modifier from middle click (8 + 1 = 9)", () => {
            expect.assertions(1);

            const result = parseSgrMouse("\u001B[<9;10;20M");

            expect(result).toStrictEqual({
                action: "press",
                button: "middle",
                type: "click",
                x: 10,
                y: 20,
            });
        });

        it("should strip all modifiers from left drag (4 + 8 + 16 + 32 = 60)", () => {
            expect.assertions(1);

            const result = parseSgrMouse("\u001B[<60;5;5M");

            expect(result).toStrictEqual({
                action: "press",
                button: "left",
                type: "drag",
                x: 5,
                y: 5,
            });
        });

        it("should strip ctrl modifier from scroll up (16 + 64 = 80)", () => {
            expect.assertions(1);

            const result = parseSgrMouse("\u001B[<80;10;20M");

            expect(result).toStrictEqual({
                direction: "scrollup",
                type: "scroll",
                x: 10,
                y: 20,
            });
        });
    });

    describe("invalid input", () => {
        it("should return null for non-mouse input", () => {
            expect.assertions(1);

            expect(parseSgrMouse("hello")).toBeUndefined();
        });

        it("should return null for partial sequence", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[<0;10")).toBeUndefined();
        });

        it("should return null for empty string", () => {
            expect.assertions(1);

            expect(parseSgrMouse("")).toBeUndefined();
        });

        it("should return null for keyboard escape sequence", () => {
            expect.assertions(1);

            expect(parseSgrMouse("\u001B[A")).toBeUndefined();
        });
    });
});
