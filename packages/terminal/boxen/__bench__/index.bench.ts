/* eslint-disable import/no-extraneous-dependencies */
import originalBoxen from "boxen";
import { bench, describe } from "vitest";

import { boxen as visulimaBoxen } from "../src";

const simpleText = "Hello, world!";
const textWithNewlines = "Hello,\nworld!\nThis is a test.";

describe("Boxen Benchmark", () => {
    describe("Simple Text", () => {
        bench("@visulima/boxen", () => {
            visulimaBoxen(simpleText, { borderStyle: "round", margin: 1, padding: 1 });
        });

        bench("original boxen", () => {
            originalBoxen(simpleText, { borderStyle: "round", margin: 1, padding: 1 });
        });
    });

    describe("Text with Newlines", () => {
        bench("@visulima/boxen", () => {
            visulimaBoxen(textWithNewlines, { borderStyle: "double", margin: 1, padding: 1 });
        });

        bench("original boxen", () => {
            originalBoxen(textWithNewlines, { borderStyle: "double", margin: 1, padding: 1 });
        });
    });

    describe("Complex Options", () => {
        bench("@visulima/boxen", () => {
            visulimaBoxen(textWithNewlines, {
                borderStyle: "round",
                margin: {
                    bottom: 1,
                    left: 2,
                    right: 2,
                    top: 1,
                },
                padding: 2,
            });
        });

        bench("original boxen", () => {
            originalBoxen(textWithNewlines, {
                borderStyle: "round",
                margin: {
                    bottom: 1,
                    left: 2,
                    right: 2,
                    top: 1,
                },
                padding: 2,
            });
        });
    });
});
