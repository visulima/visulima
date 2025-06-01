import { bgRed } from "@visulima/colorize";
import { describe, expect, it, vi } from "vitest";

import { boxen } from "../../src";

const longText
    = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas id erat arcu. Integer urna mauris, sodales vel egestas eu, consequat id turpis. Vivamus faucibus est mattis tincidunt lobortis. In aliquam placerat nunc eget viverra. Duis aliquet faucibus diam, blandit tincidunt magna congue eu. Sed vel ante vestibulum, maximus risus eget, iaculis velit. Quisque id dapibus purus, ut sodales lorem. Aenean laoreet iaculis tellus at malesuada. Donec imperdiet eu lacus vitae fringilla.";

vi.mock("terminal-size", () => {
    return {
        default: () => {
            return {
                columns: 80,
                rows: 24,
            };
        },
    };
});

describe("text option", () => {
    it("textColor option", () => {
        expect.assertions(1);

        const box = boxen("foo", { textColor: (text: string) => bgRed(text) });

        expect(box).toMatchSnapshot();
    });

    it("headerTextColor option", () => {
        expect.assertions(1);

        const box = boxen("foo", { headerText: "Header Text", headerTextColor: (text: string) => bgRed(text) });

        expect(box).toMatchSnapshot();
    });

    it("footerTextColor option", () => {
        expect.assertions(1);

        const box = boxen("foo", { footerText: "Footer Text", footerTextColor: (text: string) => bgRed(text) });

        expect(box).toMatchSnapshot();
    });

    it("throws on unexpected textColor", () => {
        expect.assertions(1);

        expect(() => {
            // @ts-ignore - intentional error for testing
            boxen("foo", { textColor: "dark-yellow" });
        }).toThrow("\"textColor\" is not a valid function");
    });

    it("text alignement option (left)", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            textAlignment: "left",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (center)", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            textAlignment: "center",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (right)", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            textAlignment: "right",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (left) + padding", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            padding: 1,
            textAlignment: "left",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (center) + padding", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            padding: 1,
            textAlignment: "center",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (right) + padding", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            padding: 1,
            textAlignment: "right",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (left) + long title", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            headerText: "This is a famous movie quote:",
            textAlignment: "left",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (center) + long title", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            headerText: "This is a famous movie quote:",
            textAlignment: "center",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (right) + long title", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            headerText: "This is a famous movie quote:",
            textAlignment: "right",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (left) + long title + padding", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            headerText: "This is a famous movie quote:",
            padding: 1,
            textAlignment: "left",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (center) + long title + padding", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            headerText: "This is a famous movie quote:",
            padding: 1,
            textAlignment: "center",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (right) + long title + padding", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            headerText: "This is a famous movie quote:",
            padding: 1,
            textAlignment: "right",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (left) + long title + padding + margin", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            headerText: "This is a famous movie quote:",
            margin: 1,
            padding: 1,
            textAlignment: "left",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (center) + long title + padding + margin", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            headerText: "This is a famous movie quote:",
            margin: 1,
            padding: 1,
            textAlignment: "center",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (right) + long title + padding + margin", () => {
        expect.assertions(1);

        const box = boxen("Hello there !\nGeneral Kenobi !", {
            headerText: "This is a famous movie quote:",
            margin: 1,
            padding: 1,
            textAlignment: "right",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (center) after wrapping", () => {
        expect.assertions(1);

        const box = boxen(longText, {
            textAlignment: "center",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (right) after wrapping", () => {
        expect.assertions(1);

        const box = boxen(longText, {
            textAlignment: "right",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (center) after wrapping + padding", () => {
        expect.assertions(1);

        const box = boxen(longText, {
            padding: 1,
            textAlignment: "center",
        });

        expect(box).toMatchSnapshot();
    });

    it("text alignement option (right) after wrapping + padding + margin", () => {
        expect.assertions(1);

        const box = boxen(longText, {
            margin: 1,
            padding: 1,
            textAlignment: "center",
        });

        expect(box).toMatchSnapshot();
    });

    it("headerText option works", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            headerText: "title",
        });

        expect(box).toMatchSnapshot();
    });

    it("headerText align left", () => {
        expect.assertions(1);

        const box = boxen("foo bar foo bar", {
            headerAlignment: "left",
            headerText: "title",
        });

        expect(box).toMatchSnapshot();
    });

    it("headerText align center", () => {
        expect.assertions(1);

        const box = boxen("foo bar foo bar", {
            headerAlignment: "center",
            headerText: "title",
        });

        expect(box).toMatchSnapshot();
    });

    it("headerText align right", () => {
        expect.assertions(1);

        const box = boxen("foo bar foo bar", {
            headerAlignment: "right",
            headerText: "title",
        });

        expect(box).toMatchSnapshot();
    });

    it("long headerText expands box", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            headerText: "very long title",
        });

        expect(box).toMatchSnapshot();
    });

    it("headerText + width option", () => {
        expect.assertions(3);

        // Not enough space, no title
        expect(
            boxen("foo", {
                headerText: "very long title",
                width: 3,
            }),
        ).toMatchSnapshot("width 3");

        // Space for only one character
        expect(
            boxen("foo", {
                headerText: "very long title",
                width: 5,
            }),
        ).toMatchSnapshot("width 5");

        expect(
            boxen("foo", {
                headerText: "very long title",
                width: 20,
            }),
        ).toMatchSnapshot("width 20");
    });

    it("headerText option with border style (none)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "none",
            headerText: "title",
        });

        expect(box).toMatchSnapshot();
    });

    it("footerText option works", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            footerText: "title",
        });

        expect(box).toMatchSnapshot();
    });

    it("footerText align left", () => {
        expect.assertions(1);

        const box = boxen("foo bar foo bar", {
            footerAlignment: "left",
            footerText: "title",
        });

        expect(box).toMatchSnapshot();
    });

    it("footerText align center", () => {
        expect.assertions(1);

        const box = boxen("foo bar foo bar", {
            footerAlignment: "center",
            footerText: "title",
        });

        expect(box).toMatchSnapshot();
    });

    it("footerText align right", () => {
        expect.assertions(1);

        const box = boxen("foo bar foo bar", {
            footerAlignment: "right",
            footerText: "title",
        });

        expect(box).toMatchSnapshot();
    });

    it("long footerText expands box", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            footerText: "very long title",
        });

        expect(box).toMatchSnapshot();
    });

    it("footerText + width option", () => {
        expect.assertions(3);

        // Not enough space, no title
        expect(
            boxen("foo", {
                footerText: "very long title",
                width: 3,
            }),
        ).toMatchSnapshot("width 3");

        // Space for only one character
        expect(
            boxen("foo", {
                footerText: "very long title",
                width: 5,
            }),
        ).toMatchSnapshot("width 5");

        expect(
            boxen("foo", {
                footerText: "very long title",
                width: 20,
            }),
        ).toMatchSnapshot("width 20");
    });

    it("footerText option with border style (none)", () => {
        expect.assertions(1);

        const box = boxen("foo", {
            borderStyle: "none",
            footerText: "title",
        });

        expect(box).toMatchSnapshot();
    });
});
