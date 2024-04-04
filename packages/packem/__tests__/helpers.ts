import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NodeOptions } from "execa";
import { execaNode } from "execa";
import getNode from "get-node";

 
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

export const execPackemSync = (flags: string[] = [], options: NodeOptions<string>) => execaNode(join(dirname(fileURLToPath(import.meta.url)), "../dist/cli.mjs"), flags, options);

export const getNodePathList = async () => {
    const supportedNode = ["18", "20"];
    const outputNodes = [];

    for await (const node of supportedNode) {
        const nodeBinary = await getNode(node);

        outputNodes.push([nodeBinary.version, nodeBinary.path]);
    }

    return outputNodes;
}

// @TODO: Fix type
export const streamToString = async (stream: any) => {
    // lets have a ReadableStream as a stream variable
    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString("utf-8");
}
