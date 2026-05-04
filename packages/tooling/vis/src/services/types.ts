/**
 * Configuration block declared on a target to mark it as a long-lived
 * "service" — eligible to be started/stopped via `vis service` and
 * auto-attached when other tasks depend on it.
 *
 * Targets must also carry `preset: "server"` (or the equivalent
 * `persistent: true`) for the service-mode lifecycle to apply.
 */
export interface ServiceConfig {
    /**
     * Env vars to expose to dependent tasks when this service is
     * registered. Merged into the dependent task's env after the task's
     * own envFile and before the task's explicit `env` overrides — the
     * dependent task wins on key collisions.
     *
     * Note: only this `env` map propagates to dependents. The service
     * target's own `envFile` is loaded into the **service process** at
     * start time but is *not* forwarded — dependents must declare any
     * shared values they need either here or in their own envFile. This
     * boundary is intentional: envFiles often contain operator-only
     * secrets (deploy keys, admin tokens) that should not leak into
     * downstream test commands.
     */
    env?: Record<string, string>;

    /**
     * Grace period in milliseconds between SIGTERM and SIGKILL when the
     * service is stopped.
     * @default 5000
     */
    killGracePeriodMs?: number;

    /**
     * Optional port the service listens on. Used as the default for
     * `readiness.tcp.port` when no explicit probe is configured, and
     * surfaced by `vis service list`.
     */
    port?: number;

    /** Readiness probe configuration. v1 supports TCP only. */
    readiness?: {
        tcp: {
            host?: string;
            port: number;
            timeoutMs?: number;
        };
    };
}

/**
 * Persisted registry entry. One JSON file per running service in
 * `~/.vis-services/<workspaceHash>/<slug>.json`.
 */
export interface ServiceEntry {
    /** Resolved command actually spawned. Used for stale-PID detection. */
    command: string;

    /** Service config captured at start time. */
    config: ServiceConfig;

    cwd: string;

    /**
     * Env vars to forward to dependents. Resolved at start time —
     * defaults to `config.env`, but a future `--env-from` flag could
     * extend this without touching the registry consumer.
     */
    env: Record<string, string>;

    /** Target id, e.g. `apps/api:db`. */
    id: string;

    /** Absolute path to the captured stdout/stderr log file. */
    logFile: string;

    pid: number;

    /**
     * Filesystem-safe slug of `id`. `apps/api:db` → `apps_api__db`.
     * Used as the entry's filename so registry reads can map slug → entry.
     */
    slug: string;

    /** ISO 8601 timestamp of when the service was started. */
    startedAt: string;

    /**
     * vis version that started this service. Auto-attach refuses entries
     * from a mismatched version — protects against schema drift.
     */
    visVersion: string;
}
