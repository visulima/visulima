import { blue, red, yellow } from "@visulima/colorize";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { boxen } from "../../src";

const longText
    = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas id erat arcu. Integer urna mauris, sodales vel egestas eu, consequat id turpis. Vivamus faucibus est mattis tincidunt lobortis. In aliquam placerat nunc eget viverra. Duis aliquet faucibus diam, blandit tincidunt magna congue eu. Sed vel ante vestibulum, maximus risus eget, iaculis velit. Quisque id dapibus purus, ut sodales lorem. Aenean laoreet iaculis tellus at malesuada. Donec imperdiet eu lacus vitae fringilla.";

const formattedText = `
!!!  Unicorns are lit !!!
Hello this is a formatted text !
				It has alignements
				already includes 
				in it. 
Boxen should protect this alignement,
		otherwise the users would be sad !
Hehe          Haha${" ".repeat(33)}
Hihi       Hoho
	All this garbage is on purpose.
Have a good day !
`;

const randomText

    = "lewb{+^PN_6-l 8eK2eqB:jn^YFgGl;wuT)mdA9TZlf 9}?X#P49`x\"@+nLx:BH5p{5_b`S'E8\0{A0l\"(62`TIf(z8n2arEY~]y|bk,6,FYf~rGY*Xfa00q{=fdm=4.zVf6#'|3S!`pJ3 6y02]nj2o4?-`1v$mudH?Wbw3fZ]a+aE''P4Q(6:NHBry)L_&/7v]0<!7<kw~gLc.)'ajS>\0~y8PZ*|-BRY&m%UaCe'3A,N?8&wbOP}*.O<47rnPzxO=4\"*|[%A):;E)Z6!V&x!1*OprW-*+q<F$6|864~1HmYX@J#Nl1j1`!$Y~j^`j;PB2qpe[_;.+vJGnE3) yo&5qRI~WHxK~r%+'P>Up&=P6M<kDdpSL#<Ur/[NN0qI3dFEEy|>_VGx0O/VOvPEez:7C58a^.N,\"Rxc|a6C[i$3QC_)~x!wd+ZMtYsGF&?";

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

describe(boxen, () => {
    beforeEach(() => {
        vi.stubGlobal("process", {
            env: { COLUMNS: "22" },
            stderr: {
                rows: 24,
            },
            stdout: {
                columns: 80,
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("creates a box", () => {
        expect.assertions(1);

        const box = boxen("foo");

        expect(box).toMatchSnapshot();
    });

    it("box not overflowing terminal", () => {
        expect.assertions(1);

        const box = boxen("foo".repeat(22));

        expect(box).toMatchSnapshot();
    });

    it("box not overflowing terminal with padding", () => {
        expect.assertions(1);

        const box = boxen("foo".repeat(22), {
            padding: 3,
        });

        expect(box).toMatchSnapshot();
    });

    it("box not overflowing terminal with words", () => {
        expect.assertions(1);

        const box = boxen("foo ".repeat(22));

        expect(box).toMatchSnapshot();
    });

    it("box not overflowing terminal with words + padding", () => {
        expect.assertions(1);

        const box = boxen("foo ".repeat(22), {
            padding: 2,
        });

        expect(box).toMatchSnapshot();
    });

    it("box not overflowing terminal with words + padding + margin", () => {
        expect.assertions(1);

        const box = boxen("foo ".repeat(22), {
            margin: 1,
            padding: 2,
        });

        expect(box).toMatchSnapshot();
    });

    it("handles long text", () => {
        expect.assertions(1);

        const box = boxen(longText);

        expect(box).toMatchSnapshot();
    });

    it("handles formatted text", () => {
        expect.assertions(2);

        const box = boxen(formattedText, {
            transformTabToSpace: false,
        });

        expect(box).toMatchSnapshot("no tab transform");

        const box2 = boxen(formattedText, {
            transformTabToSpace: 2,
        });

        expect(box2).toMatchSnapshot("tab transform 2 spaces");
    });

    it("handles random text", () => {
        expect.assertions(1);

        const box = boxen(randomText);

        expect(box).toMatchSnapshot();
    });

    it("handles colored texts", () => {
        expect.assertions(3);

        let box = boxen(red(longText));

        expect(box).toMatchSnapshot("red box");

        box = boxen(blue(formattedText));

        expect(box).toMatchSnapshot("blue box");

        box = boxen(yellow(randomText));

        expect(box).toMatchSnapshot("yellow box");
    });
});
