/**
 * Modified copy of https://github.com/chalk/chalk-template/blob/main/test
 *
 * MIT License
 *
 * Copyright (c) Josh Junon
 * Copyright (c) Sindre Sorhus &lt;sindresorhus@gmail.com> (https://sindresorhus.com)
 */

import { describe, expect, it } from "vitest";

// @ts-expect-error - this is a test file
import { blue, magenta, red } from "../../src/index.server.mts";
import template from "../../src/template";

describe(template, () => {
    it.each([["stdout", template]])("[%s] should return an empty string for an empty literal", (_, function_) => {
        expect.assertions(1);

        expect(function_``).toBe("");
    });

    it.each([["stdout", template]])("[%s] should correctly parse and evaluate color-convert functions", (_, function_) => {
        expect.assertions(2);

        expect(function_`{bold.rgb(144,10,178).inverse Hello, {~inverse there!}}`).toBe(
            "\u001B[1m\u001B[38;2;144;10;178m\u001B[7mHello, "
            + "\u001B[27m\u001B[39m\u001B[22m\u001B[1m"
            + "\u001B[38;2;144;10;178mthere!\u001B[39m\u001B[22m",
        );

        expect(function_`{bold.bgRgb(144,10,178).inverse Hello, {~inverse there!}}`).toBe(
            "\u001B[1m\u001B[48;2;144;10;178m\u001B[7mHello, "
            + "\u001B[27m\u001B[49m\u001B[22m\u001B[1m"
            + "\u001B[48;2;144;10;178mthere!\u001B[49m\u001B[22m",
        );
    });

    it.each([["stdout", template]])("[%s] should properly handle escapes", (_, function_) => {
        expect.assertions(1);

        expect(function_`{bold hello \{in brackets\}}`).toBe("\u001B[1mhello {in brackets}\u001B[22m");
    });

    it.each([["stdout", template]])("[%s] should throw if there is an unclosed block", (_, function_) => {
        expect.assertions(2);

        expect(() => {
            function_`{bold this shouldn't work ever\}`;
        }).toThrow("template literal is missing 1 closing bracket (`}`)");

        expect(() => {
            function_`{bold this shouldn't {inverse appear {underline ever\} :) \}`;
        }).toThrow("template literal is missing 3 closing brackets (`}`)");
    });

    it.each([["stdout", template]])("[%s] should throw if there is an invalid style", (_, function_) => {
        expect.assertions(1);

        expect(() => {
            function_`{abadstylethatdoesntexist this shouldn't work ever}`;
        }).toThrow("Unknown style: abadstylethatdoesntexist");
    });

    it.each([["stdout", template]])("[%s] should properly style multiline color blocks", (_, function_) => {
        expect.assertions(1);

        expect(
            function_`{bold
			Hello! This is a
			${"multiline"} block!
			:)
		} {underline
			I hope you enjoy
		}`,
        ).toBe(
            "\u001B[1m\u001B[22m\n"
            + "\u001B[1m\t\t\tHello! This is a\u001B[22m\n"
            + "\u001B[1m\t\t\tmultiline block!\u001B[22m\n"
            + "\u001B[1m\t\t\t:)\u001B[22m\n"
            + "\u001B[1m\t\t\u001B[22m \u001B[4m\u001B[24m\n"
            + "\u001B[4m\t\t\tI hope you enjoy\u001B[24m\n"
            + "\u001B[4m\t\t\u001B[24m",
        );
    });

    it.each([["stdout", template]])("[%s] should escape interpolated values", (_, function_) => {
        expect.assertions(2);

        expect(function_`Hello {bold hi}`).toBe("Hello \u001B[1mhi\u001B[22m");
        expect(function_`Hello ${"{bold hi}"}`).toBe("Hello {bold hi}");
    });

    it.each([["stdout", template]])("[%s] should allow bracketed Unicode escapes", (_, function_) => {
        expect.assertions(3);

        expect(function_`\u{AB}`).toBe("\u{AB}");
        expect(function_`This is a {bold \u{AB681}} test`).toBe("This is a \u001B[1m\u{AB681}\u001B[22m test");
        expect(function_`This is a {bold \u{10FFFF}} test`).toBe("This is a \u001B[1m\u{10FFFF}\u001B[22m test");
    });

    it.each([["stdout", template]])("[%s] should handle special hex case", (_, function_) => {
        expect.assertions(9);

        expect(function_`{#FF0000 hello}`).toBe("\u001B[38;2;255;0;0mhello\u001B[39m");
        expect(function_`{#:FF0000 hello}`).toBe("\u001B[48;2;255;0;0mhello\u001B[49m");
        expect(function_`{#00FF00:FF0000 hello}`).toBe("\u001B[38;2;0;255;0m\u001B[48;2;255;0;0mhello\u001B[49m\u001B[39m");
        expect(function_`{bold.#FF0000 hello}`).toBe("\u001B[1m\u001B[38;2;255;0;0mhello\u001B[39m\u001B[22m");
        expect(function_`{bold.#:FF0000 hello}`).toBe("\u001B[1m\u001B[48;2;255;0;0mhello\u001B[49m\u001B[22m");
        expect(function_`{bold.#00FF00:FF0000 hello}`).toBe("\u001B[1m\u001B[38;2;0;255;0m\u001B[48;2;255;0;0mhello\u001B[49m\u001B[39m\u001B[22m");
        expect(function_`{#FF0000.bold hello}`).toBe("\u001B[38;2;255;0;0m\u001B[1mhello\u001B[22m\u001B[39m");
        expect(function_`{#:FF0000.bold hello}`).toBe("\u001B[48;2;255;0;0m\u001B[1mhello\u001B[22m\u001B[49m");
        expect(function_`{#00FF00:FF0000.bold hello}`).toBe("\u001B[38;2;0;255;0m\u001B[48;2;255;0;0m\u001B[1mhello\u001B[22m\u001B[49m\u001B[39m");
    });

    it.each([["stdout", template]])(`[%s] should return a regular string for a literal with no templates`, (_, function_) => {
        expect.assertions(1);

        expect(function_`hello`).toBe("hello");
    });

    it.each([["stdout", template]])(`[%s] should correctly perform template parsing`, async (name, function_) => {
        expect.assertions(1);

        await expect(function_`{bold Hello, {cyan World!} This is a} test. {green Woo!}`).toMatchFileSnapshot(
            `__snapshots__/template[${name}-template-parsing].test.ts.snap`,
        );
    });

    it.each([["stdout", template]])(`[%s] should correctly perform template substitutions`, async (_, function_) => {
        expect.assertions(1);

        const name = "Sindre";
        const exclamation = "Neat";

        await expect(function_`{bold Hello, {cyan.inverse ${name}!} This is a} test. {green ${exclamation}!}`).toMatchFileSnapshot(
            `__snapshots__/template[${name}-template-substitutions].test.ts.snap`,
        );
    });

    it.each([["stdout", template]])(`[%s] should correctly perform nested template substitutions`, async (_, function_) => {
        expect.assertions(3);

        const name = "Sindre";
        const exclamation = "Neat";

        await expect(`${function_`{bold Hello, {cyan.inverse ${name}!} This is a}`} test. ${function_`{green ${exclamation}!}`}`).toMatchFileSnapshot(
            `__snapshots__/template[${name}-nested-template-substitutions-1].test.ts.snap`,
        );
        await expect(function_`{red.bgGreen.bold Hello {italic.blue ${name}}}`).toMatchFileSnapshot(
            `__snapshots__/template[${name}-nested-template-substitutions-2].test.ts.snap`,
        );
        await expect(function_`{strikethrough.cyanBright.bgBlack Works with {reset {bold numbers}} {bold.red ${1}}}`).toMatchFileSnapshot(
            `__snapshots__/template[${name}-nested-template-substitutions-3].test.ts.snap`,
        );
    });

    it.each([["stdout", template]])(`[%s] should correctly parse newline literals (bug #184)`, (_, function_) => {
        expect.assertions(1);

        expect(function_`Hello
{red there}`).toBe(`Hello
${red("there")}`);
    });

    it.each([["stdout", template]])(`[%s] should correctly parse newline escapes (bug #177)`, (_, function_) => {
        expect.assertions(1);

        expect(function_`Hello\nthere!`).toBe("Hello\nthere!");
    });

    it.each([["stdout", template]])(`[%s] should correctly parse escape in parameters (bug #177 comment 318622809)`, (_, function_) => {
        expect.assertions(1);

        const string = "\\";

        expect(function_`{blue ${string}}`).toBe(blue("\\"));
    });

    it.each([["stdout", template]])(`[%s] should correctly parses unicode/hex escapes`, (_, function_) => {
        expect.assertions(1);

        expect(function_`\u0078ylophones are fo\u0078y! {magenta.inverse \u0078ylophones are fo\u0078y!}`).toBe(
            `xylophones are foxy! ${magenta.inverse`xylophones are foxy!`}`,
        );
    });

    it.each([["stdout", template]])(`[%s] should throws if an extra unescaped } is found`, (_, function_) => {
        expect.assertions(1);

        expect(() => {
            function_`{red hi!}}`;
        }).toThrow("Found extraneous } in template literal");
    });

    it.each([["stdout", template]])(`[%s] should not parse upper-case escapes`, (_, function_) => {
        expect.assertions(1);

        expect(function_`\N\n\T\t\X07\u0007\U000A\u000A\U000a\u000A`).toBe("N\nT\tX07\u0007U000A\u000AU000a\u000A");
    });

    it.each([["stdout", template]])(`[%s] should properly handle undefined template interpolated values`, (_, function_) => {
        expect.assertions(2);

        expect(function_`hello ${undefined}`).toBe("hello undefined");
        expect(function_`hello ${null}`).toBe("hello null");
    });
});
