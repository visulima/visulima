import { execSync } from "node:child_process";
import { mkdir, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ExecaChildProcess, NodeOptions } from "execa";
import { execaNode } from "execa";
import getNode from "get-node";

/**
 * Escape the slash `\` in ESC-symbol.
 * Use it to show by an error the received ESC sequence string in console output.
 */
export const esc = (string_: string): string => string_.replaceAll("", "\\x1b");

export const execScriptSync = (file: string, flags: string[] = [], environment: string[] = []): string => {
    const environmentVariables = environment.length > 0 ? `${environment.join(" ")} ` : "";

    let cmd = `node "${file}" ${flags.join(" ")}`;

    if (environmentVariables) {
        cmd = `${environmentVariables}${cmd}`;
    }

    const result = execSync(cmd);

    // replace last newline in result
    return result.toString().replace(/\n$/, "");
};

export const execPackemSync = (flags?: string[], options?: NodeOptions): ExecaChildProcess =>
    execaNode(join(dirname(fileURLToPath(import.meta.url)), "../dist/cli.mjs"), flags, options);

export const getNodePathList = async (): Promise<string[][]> => {
    const supportedNode = ["18", "20"];
    const outputNodes = [];

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for await (const node of supportedNode) {
        const nodeBinary = await getNode(node);

        outputNodes.push([nodeBinary.version, nodeBinary.path]);
    }

    return outputNodes;
};

// @TODO: Fix type
export const streamToString = async (stream: any): Promise<string> => {
    // lets have a ReadableStream as a stream variable
    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return esc(Buffer.concat(chunks).toString("utf8"));
};

export const installPackage = async (fixturePath: string, packageName: string): Promise<void> => {
    const nodeModulesDirectory = join(fixturePath, "node_modules");

    await mkdir(nodeModulesDirectory, { recursive: true });
    await symlink(resolve("node_modules/" + packageName), join(nodeModulesDirectory, packageName), "dir");
};
