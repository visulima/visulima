"use strict";

import { gradient } from "@visulima/colorize/gradient";

const pad = (s) => {
    let i = -1;
    const l = 11 - s.length;
    while (++i < l) {
        s += " ";
    }
    return "  " + s;
};

const str = "■".repeat(48);

const aliases = {
    atlas: { colors: ["#feac5e", "#c779d0", "#4bc0c8"], options: {} },
    cristal: { colors: ["#bdfff3", "#4ac29a"], options: {} },
    fruit: { colors: ["#ff4e50", "#f9d423"], options: {} },
    instagram: { colors: ["#833ab4", "#fd1d1d", "#fcb045"], options: {} },
    mind: { colors: ["#473b7b", "#3584a7", "#30d2be"], options: {} },
    morning: { colors: ["#ff5f6d", "#ffc371"], options: { interpolation: "hsv" } },
    passion: { colors: ["#f43b47", "#453a94"], options: {} },
    pastel: { colors: ["#74ebd5", "#74ecd5"], options: { interpolation: "hsv", hsvSpin: "long" } },
    rainbow: { colors: ["#ff0000", "#ff0100"], options: { interpolation: "hsv", hsvSpin: "long" } },
    retro: { colors: ["#3f51b1", "#5a55ae", "#7b5fac", "#8f6aae", "#a86aa4", "#cc6b8e", "#f18271", "#f3a469", "#f7c978"], options: {} },
    summer: { colors: ["#fdbb2d", "#22c1c3"], options: {} },
    teen: { colors: ["#77a1d3", "#79cbca", "#e684ae"], options: {} },
    vice: { colors: ["#5ee7df", "#b490ca"], options: { interpolation: "hsv" } },
};

console.log("");

for (const [name, settings] of Object.entries(aliases)) {
    console.log(pad(name), gradient(settings.colors, settings.options)(str));
}
