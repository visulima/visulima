import type { Toolbox } from "@visulima/cerebro";
import { bold, cyan, dim, green, red, yellow } from "@visulima/colorize";
import type { RemoteCacheOptions } from "@visulima/task-runner";
import { ReapiRemoteCache, resolveTurboEnvCompat } from "@visulima/task-runner";

import { pail } from "../../io/logger";
import type { CacheDoctorOptions } from "./index";

interface ProbeResult {
    backend: "http" | "reapi";
    capabilities?: {
        digestFunctions: ReadonlyArray<string>;
        maxBatchTotalSizeBytes: number;
    };
    durationMs: number;
    error?: string;
    httpStatus?: number;
    ok: boolean;
    url: string;
}

const inferBackend = (url: string, override: string | undefined): "http" | "reapi" => {
    if (override === "http" || override === "reapi") {
        return override;
    }

    if (url.startsWith("grpc://") || url.startsWith("grpcs://")) {
        return "reapi";
    }

    return "http";
};

const probeHttp = async (url: string, timeoutMs: number): Promise<ProbeResult> => {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        // Send a HEAD against the configured URL. A reachable cache typically
        // responds with 401/403/404 (unauthenticated, no team, or no artifact)
        // — anything that isn't a network error means the server is alive.
        const response = await fetch(url, { method: "HEAD", signal: controller.signal });

        return {
            backend: "http",
            durationMs: Date.now() - startedAt,
            httpStatus: response.status,
            ok: true,
            url,
        };
    } catch (error) {
        return {
            backend: "http",
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : String(error),
            ok: false,
            url,
        };
    } finally {
        clearTimeout(timer);
    }
};

const probeReapi = async (options: RemoteCacheOptions, timeoutMs: number): Promise<ProbeResult> => {
    const startedAt = Date.now();
    // The constructor enforces the cleartext-bearer guard. probeCapabilities
    // bypasses the read/write mode gate so probes work regardless of the
    // configured mode.
    const cache = new ReapiRemoteCache({ ...options, timeout: timeoutMs });

    try {
        const capabilities = await cache.probeCapabilities();

        return {
            backend: "reapi",
            capabilities,
            durationMs: Date.now() - startedAt,
            ok: true,
            url: options.url,
        };
    } catch (error) {
        return {
            backend: "reapi",
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : String(error),
            ok: false,
            url: options.url,
        };
    } finally {
        // Swallow close() errors so a teardown failure doesn't mask the real
        // probe outcome — operators need the probe error, not "handle already
        // disposed" or similar boilerplate from the gRPC channel shutdown.
        try {
            await cache.close();
        } catch {
            // Intentionally ignored — best-effort shutdown.
        }
    }
};

const formatTable = (result: ProbeResult): string => {
    const lines: string[] = [];
    const status = result.ok ? green("OK") : red("FAIL");

    lines.push(`${bold("Remote cache")} ${status}`);
    lines.push(`  ${dim("URL:")}     ${cyan(result.url)}`);
    lines.push(`  ${dim("Backend:")} ${result.backend}`);
    lines.push(`  ${dim("Latency:")} ${String(result.durationMs)}ms`);

    if (result.httpStatus !== undefined) {
        lines.push(`  ${dim("Status:")}  ${String(result.httpStatus)}`);
    }

    if (result.capabilities) {
        const digestFunctions = result.capabilities.digestFunctions.length > 0 ? result.capabilities.digestFunctions.join(", ") : yellow("(none advertised)");

        lines.push(`  ${dim("Digests:")} ${digestFunctions}`);
        lines.push(`  ${dim("Batch:")}   ${String(result.capabilities.maxBatchTotalSizeBytes)} bytes`);
    }

    if (result.error) {
        lines.push(`  ${dim("Error:")}   ${red(result.error)}`);
    }

    return lines.join("\n");
};

export const cacheDoctorExecute = async ({ logger, options, visConfig }: Toolbox<Console, CacheDoctorOptions>): Promise<void> => {
    const cfg = (visConfig ?? {}) as { taskRunner?: { remoteCache?: RemoteCacheOptions } };
    // Fill missing fields from TURBO_API / TURBO_TOKEN / TURBO_TEAM so
    // `vis cache doctor` works on a Turbo-shaped CI environment with no
    // vis.config.ts changes.
    const configRemoteCache = resolveTurboEnvCompat(cfg.taskRunner?.remoteCache);
    const cliUrl = options.url;
    const url = cliUrl ?? configRemoteCache?.url;
    const format = options.format ?? "table";
    const timeoutMs = options.timeout ?? 5000;

    if (!url) {
        pail.error("No remote cache configured. Set taskRunner.remoteCache.url in vis.config.ts, pass --url=..., or export TURBO_API.");
        process.exitCode = 1;

        return;
    }

    const backend = inferBackend(url, options.backend);

    const result: ProbeResult
        = backend === "reapi" ? await probeReapi({ ...(configRemoteCache ?? { url }), backend: "reapi", url }, timeoutMs) : await probeHttp(url, timeoutMs);

    if (format === "json") {
        logger.log(JSON.stringify(result, null, 2));
    } else {
        logger.log(formatTable(result));
    }

    if (!result.ok) {
        process.exitCode = 1;
    }
};
