import { backgroundColorNames, foregroundColorNames, modifierNames } from "ansi-styles";
import { describe, expect, it } from "vitest";

import colorize, { bold, Colorize, green, hex, red, yellow } from "../../src/index.browser";

describe("style tests", () => {
    it(`should colorize visible('foo')`, () => {
        expect.assertions(1);

        const received = colorize.visible("foo");
        const expected = ["%cfoo", "opacity: 0;"];

        expect(received).toStrictEqual(expected);
    });

    it(`visible with template literal`, () => {
        expect.assertions(1);

        const received = colorize.visible`foo ${green`bar`}`;
        const expected = ["%cfoo %cbar", "opacity: 0;", "color: green;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize green('')`, () => {
        expect.assertions(1);

        const received = colorize.green("");
        const expected = [];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize green('foo', 'bar')`, () => {
        expect.assertions(1);

        const received = colorize.green(["foo", "bar"].join(" "));
        const expected = ["%cfoo bar", "color: green;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize bgMagenta('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgMagenta("foo");
        const expected = ["%cfoo", "background-color: magenta; color: white;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize green.bold.underline.italic()`, () => {
        expect.assertions(1);

        const received = colorize.green.bold.underline.italic("foo");
        const expected = ["%cfoo", "font-style:italic;text-decoration:underline;font-weight:bold;color:green;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize cyan(colorize.bold(colorize.underline(colorize.italic('foo'))))`, () => {
        expect.assertions(1);

        const received = colorize.cyan(colorize.bold(colorize.underline(colorize.italic("foo"))));
        const expected = ["%cfoo", "color: cyan;font-weight: bold;text-decoration: underline;font-style: italic;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize rgb(80, 100, 150)`, () => {
        expect.assertions(1);

        const received = colorize.rgb(80, 100, 150)("foo");
        const expected = ["%cfoo", "color: rgb(80,100,150);"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize bgRgb(80, 100, 150)`, () => {
        expect.assertions(1);

        const received = colorize.bgRgb(80, 100, 150)("foo");
        const expected = ["%cfoo", "background-color: rgb(80,100,150);"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize hex('#ABC')`, () => {
        expect.assertions(1);

        const received = colorize.hex("#ABC")("foo");
        const expected = ["%cfoo", "color:#ABC;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize bgHex('#ABC123')`, () => {
        expect.assertions(1);

        const received = colorize.bgHex("#ABC123")("foo");
        const expected = ["%cfoo", "background-color: #ABC123;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize ansi256(97)`, () => {
        expect.assertions(1);

        const received = colorize.ansi256(97)("foo");
        const expected = ["%cfoo", "color: #875faf;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize bgAnsi256(97)`, () => {
        expect.assertions(1);

        const received = colorize.bgAnsi256(97)("foo");
        const expected = ["%cfoo", "background-color: #875faf;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize green('\nHello\nNew line\nNext new line.\n')`, () => {
        expect.assertions(1);

        const received = colorize.green("\nHello\nNew line\nNext new line.\n");
        const expected = ["%c\nHello\nNew line\nNext new line.\n", "color: green;"];

        expect(received).toStrictEqual(expected);
    });
});

describe("functional tests", () => {
    it(`should colorize 'OK'`, () => {
        expect.assertions(1);

        const received = colorize("OK");
        const expected = "OK";

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize nested styles`, () => {
        expect.assertions(1);

        const received = colorize.red(`foo${colorize.underline.bgBlue("bar")}!`);
        const expected = ["%cfoo%cbar!", "color: red;", "background-color:blue;color:white;text-decoration:underline;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize nested prop.parent`, () => {
        expect.assertions(1);

        const received = colorize.green.bold.underline(`foo ${colorize.red.italic("bar")} foo`);
        const expected = ["%cfoo %cbar foo", "text-decoration:underline;font-weight:bold;color:green;", "font-style:italic;color:red;"];

        expect(received).toStrictEqual(expected);
    });

    // @TODO: Find a way to add multi nested styles to the browser console
    // eslint-disable-next-line vitest/no-disabled-tests
    it.skip(`should colorize nested multi styles`, () => {
        expect.assertions(1);

        const rgb = colorize.rgb(100, 80, 155);

        const received = colorize.red(
            `begin ${rgb.bold("RGB")} ${colorize.yellow("yellow")} red ${colorize.italic.cyan("italic cyan")} red ${colorize.red(
                "red",
            )} red ${colorize.underline.green.italic(
                `underline italic green ${colorize.rgb(80, 120, 200)("RGB")} underline italic green`,
            )} red ${colorize.cyan("cyan")} red ${colorize.bold.yellow("bold yellow")} red ${colorize.green("green")} end`,
        );
        const expected = [
            "%cbegin %cRGB %cyellow %cred %citalic cyan %cred %cred %cred %cunderline italic green %cunderline italic blue %cunderline italic green %cred %ccyan red %cbold yellow red %cgreen end",
            "color: red;",
            "font-weight:bold;",
            "color: yellow;",
            "color: red;",
            "font-style:italic;color:cyan;",
            "color: red;",
            "color: red;",
            "color: red;",
            "text-decoration: underline;font-style: italic;color: green;",
            "color: rgb(80,120,200);",
            "color: cyan;",
            "font-weight:bold;color:yellow;",
            "color: green;",
        ];

        expect(received).toStrictEqual(expected);
    });
});

describe("alias tests", () => {
    it(`should be the same strike == strikethrough`, () => {
        expect.assertions(1);

        const received = colorize.strike("foo");
        const expected = colorize.strikethrough("foo");

        expect(received).toStrictEqual(expected);
    });

    it(`should be the same gray == blackBright`, () => {
        expect.assertions(1);

        const received = colorize.gray("foo");
        const expected = colorize.blackBright("foo");

        expect(received).toStrictEqual(expected);
    });

    it(`should be the same grey == gray`, () => {
        expect.assertions(1);

        const received = colorize.grey("foo");
        const expected = colorize.gray("foo");

        expect(received).toStrictEqual(expected);
    });

    it(`should be the same bgGrey == bgGray`, () => {
        expect.assertions(1);

        const received = colorize.bgGrey("foo");
        const expected = colorize.bgGray("foo");

        expect(received).toStrictEqual(expected);
    });

    it(`should allow to call alias grey.gray('foo')`, () => {
        expect.assertions(1);

        const received = colorize.grey.gray("foo");
        const expected = ["%cfoo", "color:#666;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should be the same fg == ansi256`, () => {
        expect.assertions(1);

        const received = colorize.fg(96)("foo");
        const expected = colorize.ansi256(96)("foo");

        expect(received).toStrictEqual(expected);
    });

    it(`should be the same bg == bgAnsi256`, () => {
        expect.assertions(1);

        const received = colorize.bg(96)("foo");
        const expected = colorize.bgAnsi256(96)("foo");

        expect(received).toStrictEqual(expected);
    });

    it(`should allow to call alias ansi256(96).fg(96)('foo')`, () => {
        expect.assertions(1);

        const received = colorize.ansi256(96).fg(96)("foo");
        const expected = ["%cfoo", "color:#875f87;"];

        expect(received).toStrictEqual(expected);
    });
});

describe("template literals tests", () => {
    it("colorize.red`red color`", () => {
        expect.assertions(1);

        const received = colorize.red`red color`;
        const expected = ["%cred color", "color: red;"];

        expect(received).toStrictEqual(expected);
    });

    // eslint-disable-next-line no-template-curly-in-string
    it("red`red ${yellow`yellow ${green`green`} yellow`} red`", () => {
        expect.assertions(1);

        const received = red`red ${yellow`yellow ${green`green`} yellow`} red`;
        const expected = ["%cred %cyellow %cgreen yellow red", "color: red;", "color: yellow;", "color: green;"];

        expect(received).toStrictEqual(expected);
    });
});

describe("colorize class tests", () => {
    it(`new Colorize().red('foo')`, () => {
        expect.assertions(1);

        const received = new Colorize().red("foo");
        const expected = ["%cfoo", "color: red;"];

        expect(received).toStrictEqual(expected);
    });
});

describe("colorize ansi-styles", () => {
    it.each(foregroundColorNames)("colorize.%s('foo')", (style) => {
        expect.assertions(1);

        // eslint-disable-next-line security/detect-object-injection
        expect(colorize[style]("foo")).toBeDefined();
    });

    it.each(backgroundColorNames)("colorize.%s('foo')", (style) => {
        expect.assertions(1);

        // eslint-disable-next-line security/detect-object-injection
        expect(colorize[style]("foo")).toBeDefined();
    });

    it.each(modifierNames)("colorize.%s('foo')", (style) => {
        expect.assertions(1);

        // eslint-disable-next-line security/detect-object-injection
        expect(colorize[style]("foo")).toBeDefined();
    });
});

describe("handling numbers", () => {
    it(`should colorize a number 123`, () => {
        expect.assertions(1);

        const number_ = 123;
        const received = colorize(number_);
        const expected = "123";

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize a number with class call colorize.red(123)`, () => {
        expect.assertions(1);

        const number_ = 123;
        const received = colorize.red(number_);
        const expected = ["%c123", "color: red;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize a number with function call red(123)`, () => {
        expect.assertions(1);

        const number_ = 123;
        const received = red(number_);
        const expected = ["%c123", "color: red;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should bold a number with function call bold(123)`, () => {
        expect.assertions(1);

        const number_ = 123;
        const received = bold(number_);
        const expected = ["%c123", "font-weight: bold;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize a number with function call red.bold(123)`, () => {
        expect.assertions(1);

        const number_ = 123;
        const received = red.bold(number_);
        const expected = ["%c123", "font-weight:bold;color:red;"];

        expect(received).toStrictEqual(expected);
    });

    it(`should colorize a number with function call hex('#A00')(123)`, () => {
        expect.assertions(1);

        const number_ = 123;
        const received = hex("#A00")(number_);
        const expected = ["%c123", "color:#A00;"];

        expect(received).toStrictEqual(expected);
    });

    // eslint-disable-next-line no-template-curly-in-string
    it("should colorize a number with string template call red`size: ${123}px`", () => {
        expect.assertions(1);

        const number_ = 123;
        const received = red`size: ${number_ as unknown as string}px ${number_ as unknown as string}`;
        const expected = ["%csize: 123px 123", "color: red;"];

        expect(received).toStrictEqual(expected);
    });
});
