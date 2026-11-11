/* eslint-disable import/no-extraneous-dependencies */
import originalBoxen from "boxen";
import { describe, test } from "vitest";

import { boxen as visulimaBoxen } from "../src";

const simpleText = "Hello, world!";
const textWithNewlines = "Hello,\nworld!\nThis is a test.";

describe("Boxen Benchmark", () => {
    describe("Simple Text", () => {
        test("@visulima/boxen", async ({ bench }) => {
            await bench("@visulima/boxen", () => {
                visulimaBoxen(simpleText, { borderStyle: "round", margin: 1, padding: 1 });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("original boxen", async ({ bench }) => {
            await bench("original boxen", () => {
                originalBoxen(simpleText, { borderStyle: "round", margin: 1, padding: 1 });
            }).run();
        });
    });

    describe("Text with Newlines", () => {
        test("@visulima/boxen", async ({ bench }) => {
            await bench("@visulima/boxen", () => {
                visulimaBoxen(textWithNewlines, { borderStyle: "double", margin: 1, padding: 1 });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("original boxen", async ({ bench }) => {
            await bench("original boxen", () => {
                originalBoxen(textWithNewlines, { borderStyle: "double", margin: 1, padding: 1 });
            }).run();
        });
    });

    describe("Complex Options", () => {
        test("@visulima/boxen", async ({ bench }) => {
            await bench("@visulima/boxen", () => {
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
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("original boxen", async ({ bench }) => {
            await bench("original boxen", () => {
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
            }).run();
        });
    });
});
