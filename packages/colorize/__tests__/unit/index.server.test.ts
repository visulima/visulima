import { backgroundColorNames, foregroundColorNames, modifierNames } from "ansi-styles";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import colorize, { bold, Colorize, green, hex, red, yellow } from "../../src/index.server.mts";
import { esc } from "../helpers.js";

describe("style tests", () => {
    beforeEach(() => {
        vi.stubGlobal("process", {
            env: { FORCE_COLOR: "3" },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it(`should colorize visible('foo')`, () => {
        expect.assertions(1);

        const received = colorize.visible("foo");
        const expected = "foo";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`visible with template literal`, () => {
        expect.assertions(1);

        const received = colorize.visible`foo ${green`bar`}`;
        const expected = "foo \u001B[32mbar\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize green('')`, () => {
        expect.assertions(1);

        const received = colorize.green("");
        const expected = "";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize green('foo', 'bar')`, () => {
        expect.assertions(1);

        const received = colorize.green(["foo", "bar"].join(" "));
        const expected = "\u001B[32mfoo bar\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize bgMagenta('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgMagenta("foo");
        const expected = "\u001B[45mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize green.bold.underline.italic()`, () => {
        expect.assertions(1);

        const received = colorize.green.bold.underline.italic("foo");
        const expected = "\u001B[32m\u001B[1m\u001B[4m\u001B[3mfoo\u001B[23m\u001B[24m\u001B[22m\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize cyan(colorize.bold(colorize.underline(colorize.italic('foo'))))`, () => {
        expect.assertions(1);

        const received = colorize.cyan(colorize.bold(colorize.underline(colorize.italic("foo"))));
        const expected = "\u001B[36m\u001B[1m\u001B[4m\u001B[3mfoo\u001B[23m\u001B[24m\u001B[22m\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize rgb(80, 100, 150)`, () => {
        expect.assertions(1);

        const received = colorize.rgb(80, 100, 150)("foo");
        const expected = "\u001B[38;2;80;100;150mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize bgRgb(80, 100, 150)`, () => {
        expect.assertions(1);

        const received = colorize.bgRgb(80, 100, 150)("foo");
        const expected = "\u001B[48;2;80;100;150mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize hex('#ABC')`, () => {
        expect.assertions(1);

        const received = colorize.hex("#ABC")("foo");
        const expected = "\u001B[38;2;170;187;204mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize bgHex('#ABC123')`, () => {
        expect.assertions(1);

        const received = colorize.bgHex("#ABC123")("foo");
        const expected = "\u001B[48;2;171;193;35mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize ansi256(97)`, () => {
        expect.assertions(1);

        const received = colorize.ansi256(97)("foo");
        const expected = "\u001B[38;5;97mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize bgAnsi256(97)`, () => {
        expect.assertions(1);

        const received = colorize.bgAnsi256(97)("foo");
        const expected = "\u001B[48;5;97mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize green('\nHello\nNew line\nNext new line.\n')`, () => {
        expect.assertions(1);

        const received = colorize.green("\nHello\nNew line\nNext new line.\n");
        const expected = `\u001B[32m\u001B[39m
\u001B[32mHello\u001B[39m
\u001B[32mNew line\u001B[39m
\u001B[32mNext new line.\u001B[39m
\u001B[32m\u001B[39m`;

        expect(esc(received)).toStrictEqual(esc(expected));
    });
});

describe("functional tests", () => {
    beforeEach(() => {
        vi.stubGlobal("process", {
            env: { FORCE_COLOR: "3" },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it(`should colorize 'OK'`, () => {
        expect.assertions(1);

        const received = colorize("OK");
        const expected = "OK";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize nested styles`, () => {
        expect.assertions(1);

        const received = colorize.red(`foo${colorize.underline.bgBlue("bar")}!`);
        const expected = "\u001B[31mfoo\u001B[4m\u001B[44mbar\u001B[49m\u001B[24m!\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize nested prop.parent`, () => {
        expect.assertions(1);

        const received = colorize.green.bold.underline(`foo ${colorize.red.italic("bar")} foo`);
        const expected = "\u001B[32m\u001B[1m\u001B[4mfoo \u001B[31m\u001B[3mbar\u001B[23m\u001B[32m foo\u001B[24m\u001B[22m\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize nested multi styles`, () => {
        expect.assertions(1);

        const rgb = colorize.rgb(100, 80, 155);

        const received = colorize.red(
            `begin ${rgb.bold("RGB")} ${colorize.yellow("yellow")} red ${colorize.italic.cyan("italic cyan")} red ${colorize.red(
                "red",
            )} red ${colorize.underline.green.italic(
                `underline italic green ${colorize.rgb(80, 120, 200)("underline italic blue")} underline italic green`,
            )} red ${colorize.cyan("cyan")} red ${colorize.bold.yellow("bold yellow")} red ${colorize.green("green")} end`,
        );
        const expected
            = "\u001B[31mbegin \u001B[38;2;100;80;155m\u001B[1mRGB\u001B[22m\u001B[31m \u001B[33myellow\u001B[31m red \u001B[3m\u001B[36mitalic cyan\u001B[31m\u001B[23m red \u001B[31mred\u001B[31m red \u001B[4m\u001B[32m\u001B[3munderline italic green \u001B[38;2;80;120;200munderline italic blue\u001B[32m underline italic green\u001B[23m\u001B[31m\u001B[24m red \u001B[36mcyan\u001B[31m red \u001B[1m\u001B[33mbold yellow\u001B[31m\u001B[22m red \u001B[32mgreen\u001B[31m end\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should strip`, () => {
        expect.assertions(1);

        const received = colorize.strip("\u001B[36m\u001B[1m\u001B[4m\u001B[3mfoo\u001B[23m\u001B[24m\u001B[22m\u001B[39m");
        const expected = "foo";

        expect(esc(received)).toStrictEqual(esc(expected));
    });
});

describe("alias tests", () => {
    beforeEach(() => {
        vi.stubGlobal("process", {
            env: { FORCE_COLOR: "3" },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it(`should be the same strike == strikethrough`, () => {
        expect.assertions(1);

        const received = colorize.strike("foo");
        const expected = colorize.strikethrough("foo");

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should be the same gray == blackBright`, () => {
        expect.assertions(1);

        const received = colorize.gray("foo");
        const expected = colorize.blackBright("foo");

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should be the same grey == gray`, () => {
        expect.assertions(1);

        const received = colorize.grey("foo");
        const expected = colorize.gray("foo");

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should be the same bgGrey == bgGray`, () => {
        expect.assertions(1);

        const received = colorize.bgGrey("foo");
        const expected = colorize.bgGray("foo");

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should allow to call alias grey.gray('foo')`, () => {
        expect.assertions(1);

        const received = colorize.grey.gray("foo");
        const expected = "\u001B[90m\u001B[90mfoo\u001B[39m\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should be the same fg == ansi256`, () => {
        expect.assertions(1);

        const received = colorize.fg(96)("foo");
        const expected = colorize.ansi256(96)("foo");

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should be the same bg == bgAnsi256`, () => {
        expect.assertions(1);

        const received = colorize.bg(96)("foo");
        const expected = colorize.bgAnsi256(96)("foo");

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should allow to call alias ansi256(96).fg(96)('foo')`, () => {
        expect.assertions(1);

        const received = colorize.ansi256(96).fg(96)("foo");
        const expected = "\u001B[38;5;96m\u001B[38;5;96mfoo\u001B[39m\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });
});

describe("template literals tests", () => {
    it("colorize.red`red color`", () => {
        expect.assertions(1);

        const received = colorize.red`red color`;
        const expected = "\u001B[31mred color\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    // eslint-disable-next-line no-template-curly-in-string
    it("red`red ${yellow`yellow ${green`green`} yellow`} red`", () => {
        expect.assertions(1);

        const received = red`red ${yellow`yellow ${green`green`} yellow`} red`;
        const expected = "\u001B[31mred \u001B[33myellow \u001B[32mgreen\u001B[33m yellow\u001B[31m red\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });
});

describe("colorize class tests", () => {
    it(`new Colorize().red('foo')`, () => {
        expect.assertions(1);

        const received = new Colorize().red("foo");
        const expected = "\u001B[31mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
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
    beforeEach(() => {
        vi.stubGlobal("process", {
            env: { FORCE_COLOR: "3" },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it(`should colorize a number 123`, () => {
        expect.assertions(1);

        const number_ = 123;
        const received = colorize(number_);
        const expected = "123";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize a number with class call colorize.red(123)`, () => {
        expect.assertions(1);

        const number_ = 123;
        const received = colorize.red(number_);
        const expected = "\u001B[31m123\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize a number with function call red(123)`, () => {
        expect.assertions(1);

        const number_ = 123;
        const received = red(number_);
        const expected = "\u001B[31m123\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should bold a number with function call bold(123)`, () => {
        expect.assertions(1);

        const number_ = 123;
        const received = bold(number_);
        const expected = "\u001B[1m123\u001B[22m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize a number with function call red.bold(123)`, () => {
        expect.assertions(1);

        const number_ = 123;
        const received = red.bold(number_);
        const expected = "\u001B[31m\u001B[1m123\u001B[22m\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`should colorize a number with function call hex('#A00')(123)`, () => {
        expect.assertions(1);

        const number_ = 123;
        const received = hex("#A00")(number_);
        const expected = "\u001B[38;2;170;0;0m123\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    // eslint-disable-next-line no-template-curly-in-string
    it("should colorize a number with string template call red`size: ${123}px`", () => {
        expect.assertions(1);

        const number_ = 123;
        const received = red`size: ${number_ as unknown as string}px`;
        const expected = "\u001B[31msize: 123px\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });
});

describe("base ANSI 16 colors", () => {
    // foreground colors
    it(`colorize.black('foo')`, () => {
        expect.assertions(1);

        const received = colorize.black("foo");
        const expected = "\u001B[30mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.red('foo')`, () => {
        expect.assertions(1);

        const received = colorize.red("foo");
        const expected = "\u001B[31mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.green('foo')`, () => {
        expect.assertions(1);

        const received = colorize.green("foo");
        const expected = "\u001B[32mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.yellow('foo')`, () => {
        expect.assertions(1);

        const received = colorize.yellow("foo");
        const expected = "\u001B[33mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.blue('foo')`, () => {
        expect.assertions(1);

        const received = colorize.blue("foo");
        const expected = "\u001B[34mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.magenta('foo')`, () => {
        expect.assertions(1);

        const received = colorize.magenta("foo");
        const expected = "\u001B[35mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.cyan('foo')`, () => {
        expect.assertions(1);

        const received = colorize.cyan("foo");
        const expected = "\u001B[36mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.white('foo')`, () => {
        expect.assertions(1);

        const received = colorize.white("foo");
        const expected = "\u001B[37mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.blackBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.blackBright("foo");
        const expected = "\u001B[90mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.redBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.redBright("foo");
        const expected = "\u001B[91mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.greenBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.greenBright("foo");
        const expected = "\u001B[92mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.yellowBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.yellowBright("foo");
        const expected = "\u001B[93mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.blueBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.blueBright("foo");
        const expected = "\u001B[94mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.magentaBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.magentaBright("foo");
        const expected = "\u001B[95mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.cyanBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.cyanBright("foo");
        const expected = "\u001B[96mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.whiteBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.whiteBright("foo");
        const expected = "\u001B[97mfoo\u001B[39m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    // background colors

    it(`colorize.bgBlack('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgBlack("foo");
        const expected = "\u001B[40mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgRed('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgRed("foo");
        const expected = "\u001B[41mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgGreen('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgGreen("foo");
        const expected = "\u001B[42mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgYellow('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgYellow("foo");
        const expected = "\u001B[43mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgBlue('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgBlue("foo");
        const expected = "\u001B[44mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgMagenta('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgMagenta("foo");
        const expected = "\u001B[45mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgCyan('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgCyan("foo");
        const expected = "\u001B[46mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgWhite('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgWhite("foo");
        const expected = "\u001B[47mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgBlackBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgBlackBright("foo");
        const expected = "\u001B[100mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgRedBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgRedBright("foo");
        const expected = "\u001B[101mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgGreenBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgGreenBright("foo");
        const expected = "\u001B[102mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgYellowBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgYellowBright("foo");
        const expected = "\u001B[103mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgBlueBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgBlueBright("foo");
        const expected = "\u001B[104mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgMagentaBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgMagentaBright("foo");
        const expected = "\u001B[105mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgCyanBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgCyanBright("foo");
        const expected = "\u001B[106mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });

    it(`colorize.bgWhiteBright('foo')`, () => {
        expect.assertions(1);

        const received = colorize.bgWhiteBright("foo");
        const expected = "\u001B[107mfoo\u001B[49m";

        expect(esc(received)).toStrictEqual(esc(expected));
    });
});
