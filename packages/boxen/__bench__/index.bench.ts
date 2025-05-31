import { describe, bench } from "vitest";
import { boxen as visulimaBoxen } from "../src";
import originalBoxen from "boxen";

const simpleText = "Hello, world!";
const textWithNewlines = "Hello,\nworld!\nThis is a test.";

describe("Boxen Benchmark", () => {
  describe("Simple Text", () => {
    bench("@visulima/boxen", () => {
      visulimaBoxen(simpleText, { padding: 1, margin: 1, borderStyle: "round" });
    });

    bench("original boxen", () => {
      originalBoxen(simpleText, { padding: 1, margin: 1, borderStyle: "round" });
    });
  });

  describe("Text with Newlines", () => {
    bench("@visulima/boxen", () => {
      visulimaBoxen(textWithNewlines, { padding: 1, margin: 1, borderStyle: "double" });
    });

    bench("original boxen", () => {
      originalBoxen(textWithNewlines, { padding: 1, margin: 1, borderStyle: "double" });
    });
  });

  describe("Complex Options", () => {
    bench("@visulima/boxen", () => {
      visulimaBoxen(textWithNewlines, {
        padding: 2,
        margin: {
          top: 1,
          bottom: 1,
          left: 2,
          right: 2,
        },
        borderStyle: "round",
      });
    });

    bench("original boxen", () => {
      originalBoxen(textWithNewlines, {
        padding: 2,
        margin: {
          top: 1,
          bottom: 1,
          left: 2,
          right: 2,
        },
        borderStyle: "round",
      });
    });
  });
});
