import { describe, expect, it } from "vitest";
import { red } from "@visulima/colorize";

import { boxen } from "../src";

describe("border option", () => {
    it("border color (red)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
            borderColor: (border: string) => red(border),
        });

        expect(box).toMatchSnapshot();
    });

    it("throws on unexpected borderColor", () => {
        expect.assertions(1);

        expect(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment,@typescript-eslint/prefer-ts-expect-error
            // @ts-ignore - intentional error for testing
            boxen("foo", { borderColor: "greasy-white" });
        }).toThrow("")
    });

    it("border style (single)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "single",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (singleDouble)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "singleDouble",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (doubleSingle)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "doubleSingle",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (double)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "double",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (classic)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "classic",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (bold)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "bold",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (round)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "round",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (none)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "none",
        });

        expect(box).toMatchSnapshot();
    });

    it("border style (custom ascii style)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: {
                bottom: "_",
                bottomLeft: "3",
                bottomRight: "4",
                left: "|",
                right: "!",
                top: "-",
                topLeft: "1",
                topRight: "2",
            },
        });

        expect(box).toMatchSnapshot();
    });

    it("throws on unexpected borderStyle as string", () => {
        expect.assertions(1);

        expect(() => {
            boxen("foo", { borderStyle: "shakenSnake" });
        }).toThrow("s")
    });
});
