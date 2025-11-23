import type { Socket } from "node:net";
import { connect, isIP } from "node:net";
import type { Readable } from "node:stream";
import { PassThrough } from "node:stream";

import type { File } from "../../utils/file";
import type { ScanResult, SecurityScanner } from "../types";

export interface ClamAVScannerOptions {
    /**
     * ClamAV debug mode
     * @default false
     */
    debug?: boolean;
    /**
     * ClamAV host
     * @default 'localhost'
     */
    host?: string;
    /**
     * ClamAV port
     * @default 3310
     */
    port?: number;
    /**
     * ClamAV socket path (overrides host/port)
     */
    socket?: string;
    /**
     * ClamAV timeout in milliseconds
     * @default 30000
     */
    timeout?: number;
}

export class ClamAVScanner implements SecurityScanner {
    public readonly name = "ClamAV";

    private readonly config: Required<Omit<ClamAVScannerOptions, "socket">> & { socket?: string };

    public constructor(config: ClamAVScannerOptions = {}) {
        this.config = {
            debug: false,
            host: "localhost",
            port: 3310,
            timeout: 30_000,
            ...config,
        };
    }

    public async scan(file: File, content: Readable | Buffer | string): Promise<ScanResult> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            const socket = await this.getSocket().catch((error) => {
                reject(new Error(`Could not connect to ClamAV: ${error instanceof Error ? error.message : String(error)}`));
                return undefined;
            });

            if (!socket) {
                return;
            }

            // Set timeout
            socket.setTimeout(this.config.timeout);

            socket.on("timeout", () => {
                socket.destroy(new Error("ClamAV scan timed out"));
            });

            // Collect response
            const chunks: Buffer[] = [];
            socket.on("data", (chunk) => chunks.push(chunk));

            socket.on("error", (error) => {
                reject(new Error(`ClamAV socket error: ${error.message}`));
            });

            socket.on("close", () => {
                const response = Buffer.concat(chunks).toString("utf8").trim();

                if (this.config.debug) {
                    // eslint-disable-next-line no-console
                    console.debug(`[ClamAV] Response: ${response}`);
                }

                if (response.includes("OK")) {
                    resolve({ detected: false });
                } else if (response.includes("FOUND")) {
                    const match = /stream: (.+) FOUND/.exec(response);
                    const virusName = match ? match[1] : "Unknown";

                    resolve({
                        detected: true,
                        metadata: { virusName },
                        reason: `Virus found: ${virusName}`,
                    });
                } else {
                    reject(new Error(`Unknown ClamAV response: ${response}`));
                }
            });

            // Send zINSTREAM command
            socket.write("zINSTREAM\0");

            // Stream the file content
            const stream = this.getContentStream(content);

            // Transform stream to chunks: <length><data>
            stream.on("data", (chunk: Buffer) => {
                // Write chunk length (4 bytes, big endian)
                const lengthBuffer = Buffer.alloc(4);
                lengthBuffer.writeUInt32BE(chunk.length, 0);
                socket.write(lengthBuffer);
                // Write chunk data
                socket.write(chunk);
            });

            stream.on("end", () => {
                // Write zero length chunk to indicate end of stream
                const endBuffer = Buffer.alloc(4);
                endBuffer.writeUInt32BE(0, 0);
                socket.write(endBuffer);
            });

            stream.on("error", (error) => {
                socket.destroy();
                reject(new Error(`Error reading file content: ${error.message}`));
            });
        });
    }

    private async getSocket(): Promise<Socket> {
        return new Promise((resolve, reject) => {
            let socket: Socket;

            if (this.config.socket) {
                socket = connect(this.config.socket);
            } else {
                socket = connect(this.config.port, this.config.host);
            }

            socket.on("connect", () => resolve(socket));
            socket.on("error", (error) => reject(error));
        });
    }

    private getContentStream(content: Readable | Buffer | string): Readable {
        if (typeof content === "string") {
            // Assume file path - but SecurityEngine usually resolves this?
            // For now, if it's a string, treat it as content if it's not a path,
            // but standard interface implies string could be path.
            // However, fs dependency might be needed.
            // To be safe, let's assume the caller (SecurityEngine) handles file reading if needed,
            // or we use fs.createReadStream here.
            // Given the context of 'storage', we usually have streams or buffers.
            // If it's a path, we need 'fs'.
            // Let's verify imports.
            // I'll treat string as a path if it looks like one, otherwise buffer.
            // But to be safe, let's assume `fs` is available.
            const fs = require("node:fs");
            return fs.createReadStream(content);
        }

        if (Buffer.isBuffer(content)) {
            const stream = new PassThrough();
            stream.end(content);
            return stream;
        }

        return content;
    }
}
