import { join, resolve } from "node:path";
import { bench, describe } from "vitest";

import * as simple from "find-up-simple";
import { findUp } from "find-up";
import * as find from "empathic/find";
import { findUp as visulimaFindUp, findUpSync as visulimaFindUpSync } from "@visulima/fs";

const fixtures = resolve(__dirname, "../__fixtures__/test-strings/fixtures");
const start = join(fixtures, "a/b/c/d/e/f/g/h/i/j");

const level6 = "file.txt";
const level10 = "deno.json";
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
                await simple.findUp(level6, { cwd: start });
            });
        });
        describe("sync", () => {
            bench("@visulima/fs find-up (sync)", () => {
                visulimaFindUpSync(level6, { cwd: start });
            });
            bench("find-up-simple (sync)", () => {
                simple.findUpSync(level6, { cwd: start });
            });
            bench("empathic find.up (sync)", () => {
                find.up(level6, { cwd: start });
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
                await simple.findUp(level10, { cwd: start });
            });
        });
        describe("sync", () => {
            bench("@visulima/fs find-up (sync)", () => {
                visulimaFindUpSync(level10, { cwd: start });
            });
            bench("find-up-simple (sync)", () => {
                simple.findUpSync(level10, { cwd: start });
            });
            bench("empathic find.up (sync)", () => {
                find.up(level10, { cwd: start });
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
                await simple.findUp(other, { cwd: start });
            });
        });
        describe("sync", () => {
            bench("@visulima/fs find-up (sync)", () => {
                visulimaFindUpSync(other, { cwd: start });
            });
            bench("find-up-simple (sync)", () => {
                simple.findUpSync(other, { cwd: start });
            });
            bench("empathic find.up (sync)", () => {
                find.up(other, { cwd: start });
            });
        });
    });
});
