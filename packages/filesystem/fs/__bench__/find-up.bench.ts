import { join, resolve } from "node:path";

import { findUp as visulimaFindUp, findUpSync as visulimaFindUpSync } from "@visulima/fs";
import { up } from "empathic/find";
import { findUp } from "find-up";
import { findUp as findUpSimple, findUpSync as findUpSimpleSync } from "find-up-simple";
// eslint-disable-next-line import/no-extraneous-dependencies
import { bench, describe } from "vitest";

const fixtures = resolve(__dirname, "../__fixtures__/test-strings/fixtures");
const start = join(fixtures, "a/b/c/d/e/f/g/h/i/j");

const level6 = "file.txt";
const level10 = "deno.json";
// eslint-disable-next-line sonarjs/pseudo-random
const other = Math.random().toString(16).slice(4);

describe("find-up", () => {
    describe("level-6 (file.txt, 6 levels up)", () => {
        describe("async", () => {
            bench("@visulima/fs find-up", async () => {
                await visulimaFindUp(level6, { cwd: start });
            });
            bench("find-up", async () => {
                await findUp(level6, { cwd: start });
            });
            bench("find-up-simple", async () => {
                await findUpSimple(level6, { cwd: start });
            });
        });

        describe("sync", () => {
            bench("@visulima/fs find-up (sync)", () => {
                visulimaFindUpSync(level6, { cwd: start });
            });
            bench("find-up-simple (sync)", () => {
                findUpSimpleSync(level6, { cwd: start });
            });
            bench("empathic find.up (sync)", () => {
                up(level6, { cwd: start });
            });
        });
    });

    describe("level-10 (deno.json, 10 levels up)", () => {
        describe("async", () => {
            bench("@visulima/fs find-up", async () => {
                await visulimaFindUp(level10, { cwd: start });
            });
            bench("find-up", async () => {
                await findUp(level10, { cwd: start });
            });
            bench("find-up-simple", async () => {
                await findUpSimple(level10, { cwd: start });
            });
        });

        describe("sync", () => {
            bench("@visulima/fs find-up (sync)", () => {
                visulimaFindUpSync(level10, { cwd: start });
            });
            bench("find-up-simple (sync)", () => {
                findUpSimpleSync(level10, { cwd: start });
            });
            bench("empathic find.up (sync)", () => {
                up(level10, { cwd: start });
            });
        });
    });

    describe("missing (random file, not found)", () => {
        describe("async", () => {
            bench("@visulima/fs find-up", async () => {
                await visulimaFindUp(other, { cwd: start });
            });
            bench("find-up", async () => {
                await findUp(other, { cwd: start });
            });
            bench("find-up-simple", async () => {
                await findUpSimple(other, { cwd: start });
            });
        });

        describe("sync", () => {
            bench("@visulima/fs find-up (sync)", () => {
                visulimaFindUpSync(other, { cwd: start });
            });
            bench("find-up-simple (sync)", () => {
                findUpSimpleSync(other, { cwd: start });
            });
            bench("empathic find.up (sync)", () => {
                up(other, { cwd: start });
            });
        });
    });
});
