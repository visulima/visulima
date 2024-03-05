import { describe, expect, it, vi } from "vitest";

import { boxen } from "../src";
import { blue, red, yellow } from "@visulima/colorize";

const longText =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas id erat arcu. Integer urna mauris, sodales vel egestas eu, consequat id turpis. Vivamus faucibus est mattis tincidunt lobortis. In aliquam placerat nunc eget viverra. Duis aliquet faucibus diam, blandit tincidunt magna congue eu. Sed vel ante vestibulum, maximus risus eget, iaculis velit. Quisque id dapibus purus, ut sodales lorem. Aenean laoreet iaculis tellus at malesuada. Donec imperdiet eu lacus vitae fringilla.";

const formattedText = `
!!!  Unicorns are lit !!!
Hello this is a formatted text !
				It has alignements
				already includes${" "}
				in it.${" "}
Boxen should protect this alignement,
		otherwise the users would be sad !
Hehe          Haha${" ".repeat(33)}
Hihi       Hoho
	All this garbage is on purpose.
Have a good day !
`;

const randomText =
    "lewb{+^PN_6-l 8eK2eqB:jn^YFgGl;wuT)mdA9TZlf 9}?X#P49`x\"@+nLx:BH5p{5_b`S'E8\0{A0l\"(62`TIf(z8n2arEY~]y|bk,6,FYf~rGY*Xfa00q{=fdm=4.zVf6#'|3S!`pJ3 6y02]nj2o4?-`1v$mudH?Wbw3fZ]a+aE''P4Q(6:NHBry)L_&/7v]0<!7<kw~gLc.)'ajS>\0~y8PZ*|-BRY&m%UaCe'3A,N?8&wbOP}*.O<47rnPzxO=4\"*|[%A):;E)Z6!V&x!1*OprW-*+q<F$6|864~1HmYX@J#Nl1j1`!$Y~j^`j;PB2qpe[_;.+vJGnE3) yo&5qRI~WHxK~r%+'P>Up&=P6M<kDdpSL#<Ur/[NN0qI3dFEEy|>_VGx0O/VOvPEez:7C58a^.N,\"Rxc|a6C[i$3QC_)~x!wd+ZMtYsGF&?";

describe("boxen", () => {
    it("creates a box", () => {
        const box = boxen("foo");

        expect(box).toMatchSnapshot();
    });

    it("box not overflowing terminal", () => {
        vi.stubGlobal("process", {
            env: { COLUMNS: "22" },
        });

        const box = boxen("foo".repeat(process.env["COLUMNS"]));

        vi.unstubAllGlobals();

        expect(box).toMatchSnapshot();
    });

    it("box not overflowing terminal with padding", () => {
        vi.stubGlobal("process", {
            env: { COLUMNS: "22" },
        });

        const box = boxen("foo".repeat(process.env["COLUMNS"]), {
            padding: 3,
        });

        vi.unstubAllGlobals();

        expect(box).toMatchSnapshot();
    });

    it("box not overflowing terminal with words", () => {
        vi.stubGlobal("process", {
            env: { COLUMNS: "22" },
        });

        const box = boxen("foo ".repeat(process.env["COLUMNS"]));

        vi.unstubAllGlobals();

        expect(box).toMatchSnapshot();
    });

    it("box not overflowing terminal with words + padding", () => {
        vi.stubGlobal("process", {
            env: { COLUMNS: "22" },
        });

        const box = boxen("foo ".repeat(process.env["COLUMNS"]), {
            padding: 2,
        });

        vi.unstubAllGlobals();

        expect(box).toMatchSnapshot();
    });

    it("box not overflowing terminal with words + padding + margin", () => {
        vi.stubGlobal("process", {
            env: { COLUMNS: "22" },
        });

        const box = boxen("foo ".repeat(process.env["COLUMNS"]), {
            magin: 1,
            padding: 2,
        });

        vi.unstubAllGlobals();

        expect(box).toMatchSnapshot();
    });

    it("handles long text", () => {
        const box = boxen(longText);

        expect(box).toMatchSnapshot();
    });

    it("handles formatted text", () => {
        const box = boxen(formattedText);

        expect(box).toMatchSnapshot();
    });

    it("handles random text", () => {
        const box = boxen(randomText);

        expect(box).toMatchSnapshot();
    });

    it("handles colored texts", () => {
        let box = boxen(red(longText));

        expect(box).toMatchSnapshot();

        box = boxen(blue(formattedText));

        expect(box).toMatchSnapshot();

        box = boxen(yellow(randomText));

        expect(box).toMatchSnapshot();
    });
});
