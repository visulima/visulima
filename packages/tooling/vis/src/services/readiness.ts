import { Socket } from "node:net";

import type { ServiceConfig } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 100;

export class ServiceReadinessError extends Error {
    public constructor(
        message: string,
        public readonly elapsedMs: number,
    ) {
        super(message);
        this.name = "ServiceReadinessError";
    }
}

export interface WaitForTcpInput {
    host?: string;
    port: number;
    timeoutMs?: number;
}

/**
 * Resolves once a TCP `connect` to `host:port` succeeds. Polls on the
 * loopback every `POLL_INTERVAL_MS` ms. Throws `ServiceReadinessError`
 * after `timeoutMs`.
 *
 * Each attempt uses a fresh Socket because Node's net.Socket can't be
 * re-connected after `connect` rejects.
 */
export const waitForTcp = async (input: WaitForTcpInput): Promise<void> => {
    const host = input.host ?? "127.0.0.1";
    const { port } = input;
    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const ok = await tryConnect(host, port);

        if (ok) {
            return;
        }

        await delay(POLL_INTERVAL_MS);
    }

    throw new ServiceReadinessError(`Timed out waiting for ${host}:${String(port)} to accept TCP connections (${String(timeoutMs)}ms)`, Date.now() - start);
};

const tryConnect = (host: string, port: number): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
        const socket = new Socket();

        const onDone = (ok: boolean) => {
            socket.removeAllListeners();
            socket.destroy();
            resolve(ok);
        };

        socket.once("connect", () => {
            onDone(true);
        });
        socket.once("error", () => {
            onDone(false);
        });
        // Timeout per-attempt — keeps us from hanging on a half-open
        // socket when the kernel is in the SYN-RECV grey zone.
        socket.setTimeout(POLL_INTERVAL_MS, () => {
            onDone(false);
        });

        try {
            socket.connect(port, host);
        } catch {
            onDone(false);
        }
    });

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

/**
 * Run the readiness probe configured on a service. Falls back to
 * `tcp: { port: config.port }` when no probe is set but `port` is.
 * No-op when neither is set — the service is "ready" the instant it
 * spawns.
 */
export const runReadiness = async (config: ServiceConfig, override?: { timeoutMs?: number }): Promise<void> => {
    const probe = config.readiness ?? (config.port === undefined ? undefined : { tcp: { port: config.port } });

    if (!probe) {
        return;
    }

    await waitForTcp({
        host: probe.tcp.host,
        port: probe.tcp.port,
        timeoutMs: override?.timeoutMs ?? probe.tcp.timeoutMs,
    });
};
