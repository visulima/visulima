import type { ExecException, ExecOptions, SpawnOptions } from "node:child_process";
import { exec as childProcessExec } from "node:child_process";
import { uptime } from "node:process";

import crossSpawn from "cross-spawn";
import type { Options as ExecaOptions } from "execa";
import { execa } from "execa";
import {
    env,
    hasTTY,
    hasWindow,
    isBun,
    isCI,
    isColorSupported,
    isDebug,
    isDeno,
    isDevelopment,
    isEdgeLight,
    isFastly,
    isLagon,
    isLinux,
    isMacOS,
    isMinimal,
    isNetlify,
    isNode,
    isProduction,
    isTest,
    isWindows,
    isWorkerd,
    nodeENV,
    nodeMajorVersion,
    nodeVersion,
    platform,
    provider,
    providerInfo,
    runtime,
    runtimeInfo,
} from "std-env";
import whichLib from "which";

import type {
    CerebroError, StringOrBuffer as IStringOrBuffer, System as ISystem,
} from "../@types";

/**
 * Executes a commandline program asynchronously.
 *
 * @param commandLine The addCommand line to execute.
 * @param options Additional child_process options for node.
 * @returns Promise with result.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-redundant-type-constituents
const run = async (commandLine: string, options: Partial<ExecOptions & { trim: boolean }> = {}): Promise<any> => {
    const trimmer = options["trim"] ? (value: string) => value.trim() : (value: string) => value;
    const { trim, ...nodeOptions } = options;

    // eslint-disable-next-line compat/compat
    return await new Promise((resolve, reject) => {
        // eslint-disable-next-line security/detect-child-process
        childProcessExec(commandLine, nodeOptions, (error: ExecException | null, stdout: IStringOrBuffer, stderr: IStringOrBuffer) => {
            if (error) {
                // eslint-disable-next-line no-param-reassign
                (error as CerebroError).stdout = stdout;
                // eslint-disable-next-line no-param-reassign
                (error as CerebroError).stderr = stderr;

                reject(error);

                return;
            }

            resolve(trimmer(<string>stdout || ""));
        });
    });
};

/**
 * Executes a commandline via execa.
 *
 * @param commandLine The addCommand line to execute.
 * @param options Additional child_process options for node.
 * @returns Promise with result.
 */
const exec = async (commandLine: string, options: ExecaOptions = {}): Promise<string> =>
    // eslint-disable-next-line compat/compat,implicit-arrow-linebreak
    await new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const arguments_ = commandLine.split(" ");

        execa(arguments_[0] as string, arguments_.slice(1), options)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            .then((result) => resolve(result.stdout))
            .catch((error) => reject(error));
    });

/**
 * Uses cross-spawn to execute a process.
 *
 * @param commandLine The command line to execute.
 * @param options Additional child_process options for node.
 * @returns The response code.
 */
const spawn = async (
    commandLine: string,
    options?: SpawnOptions,
): Promise<{
    error?: Error;
    status: number | null;
    stdout: string | null | undefined;
}> =>
    // eslint-disable-next-line compat/compat,implicit-arrow-linebreak
    await new Promise((resolve) => {
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const arguments_ = commandLine.split(" ");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const spawned = crossSpawn(arguments_[0] as string, arguments_.slice(1), options);

        const result = {
            error: null,
            status: null,
            stdout: null,
        };

        if (spawned.stdout) {
            spawned.stdout.on("data", (data) => {
                if (result.stdout === null || result.stdout === undefined) {
                    result.stdout = data;
                } else {
                    result.stdout += data;
                }
            });
        }
        spawned.on("close", (code) => {
            result.status = code;
            resolve(result);
        });
        spawned.on("error", (error) => {
            result.error = error;
            resolve(result);
        });
    });

/**
 * Finds the location of the path.
 *
 * @param command The name of program you're looking for.
 * @return The full path or null.
 */
const which = (command: string): string | null => whichLib.sync(command, { nothrow: true });

/**
 * Starts a timer used for measuring durations.
 *
 * @return A function that when called will return the elapsed duration in milliseconds.
 */
const startTimer = (): (() => number) => {
    const started = uptime() as number;

    return () => Math.floor((uptime() - started) * 1000); // uptime gives us seconds
};

export default {
    env,
    exec,
    hasTTY,
    hasWindow,
    isBun,
    isCI,
    isColorSupported,
    isDebug,
    isDeno,
    isDevelopment,
    isEdgeLight,
    isFastly,
    isLagon,
    isLinux,
    isMacOS,
    isMinimal,
    isNetlify,
    isNode,
    isProduction,
    isTest,
    isWindows,
    isWorkerd,
    nodeENV,
    nodeMajorVersion,
    nodeVersion,
    platform,
    process,
    provider,
    providerInfo,
    run,
    runtime,
    runtimeInfo,
    spawn,
    startTimer,
    which,
} as ISystem;
