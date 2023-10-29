import type { Options } from "cli-progress";
import { MultiBar, SingleBar } from "cli-progress";

export const progress = (options: Options = {}): SingleBar =>
    new SingleBar({ noTTYOutput: Boolean(process.env["TERM"] === "dumb" || !process.stdin.isTTY), ...options });

export const multiProgress = (options: Options = {}): MultiBar =>
    new MultiBar({ noTTYOutput: Boolean(process.env["TERM"] === "dumb" || !process.stdin.isTTY), ...options });
