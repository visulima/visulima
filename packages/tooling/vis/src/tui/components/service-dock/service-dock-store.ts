/**
 * Service dock state container. Mirrors the devcontainer-store pattern
 * (listener-based pub/sub, drained via `useSyncExternalStore`).
 *
 * The dock has three derived states: `boot` (any service still pending
 * or starting), `ready` (all green), and `crash` (one or more crashed
 * mid-run). The component reads `getDockState()` to decide its own
 * height/visibility.
 *
 * The store is intentionally pure — no I/O, no spawning. Drives are
 * `markStarting`, `appendLog`, `markReady`, `markFailed`, `markCrashed`,
 * and a side-channel `markRetrying` used when the user hits R.
 */

const TAIL_BYTES_BUDGET = 64 * 1024;

const TAIL_LINE_LIMIT = 256;

// Strip ANSI escape sequences (CSI + OSC) and stray carriage returns from
// log content before storing it. The dock renders `lastLine` inline as a
// row's right-hand detail; if a service emits a cursor-move escape (e.g.
// `\x1b[60G`) or a CR-overwrite progress line, the terminal would honor it
// and shove the text into the wrong column, leaking content past the
// dock's right border. Strip at ingest so every consumer (rows, crash
// header, retry display) sees clean text.
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = new RegExp("[\u001b\u009b]\\[[0-?]*[ -/]*[@-~]", "g");

const sanitizeLogLine = (line: string): string => line.replaceAll(ANSI_REGEX, "").replaceAll("\r", "");

export type ServiceStatus = "crashed" | "failed" | "pending" | "ready" | "starting";

export type DockState = "boot" | "crash" | "ready";

export interface ServiceState {
    /** Optional reason / one-liner shown alongside `failed` or `crashed` rows. */
    errorMessage?: string;
    id: string;
    /** Last appended log line — shown live during boot phase. */
    lastLine?: string;
    /** Optional port surfaced in the status pill once ready. */
    port?: number;
    readyAt?: number;
    startedAt?: number;
    status: ServiceStatus;
    /** Rolling tail used as crash context (bounded by TAIL_LINE_LIMIT). */
    tailLines: string[];
}

type Listener = () => void;

export class ServiceDockStore {
    #ids: string[] = [];

    #listeners = new Set<Listener>();

    #snapshot: ReadonlyMap<string, ServiceState> = new Map();

    #states = new Map<string, ServiceState>();

    public constructor(serviceIds: ReadonlyArray<string> = []) {
        for (const id of serviceIds) {
            this.#states.set(id, {
                id,
                status: "pending",
                tailLines: [],
            });
        }

        this.#ids = [...serviceIds];
        this.#refreshSnapshot();
    }

    public readonly getSnapshot = (): ReadonlyMap<string, ServiceState> => this.#snapshot;

    public readonly subscribe = (listener: Listener): (() => void) => {
        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    };

    /** Stable, insertion-ordered list of service ids. */
    public getIds(): ReadonlyArray<string> {
        return this.#ids;
    }

    public getState(id: string): ServiceState | undefined {
        return this.#states.get(id);
    }

    /**
     * Derived dock state used by the component. `crash` wins over `boot`
     * because a mid-run crash is more important to surface than a still-
     * booting service in some other slot.
     */
    public getDockState(): DockState {
        let hasCrashed = false;
        let hasBooting = false;

        for (const state of this.#states.values()) {
            if (state.status === "crashed" || state.status === "failed") {
                hasCrashed = true;
            } else if (state.status === "pending" || state.status === "starting") {
                hasBooting = true;
            }
        }

        if (hasCrashed) {
            return "crash";
        }

        if (hasBooting) {
            return "boot";
        }

        return "ready";
    }

    public registerService(id: string): void {
        if (this.#states.has(id)) {
            return;
        }

        this.#states.set(id, { id, status: "pending", tailLines: [] });
        this.#ids = [...this.#ids, id];
        this.#emit();
    }

    public markStarting(id: string): void {
        this.#updateState(id, (current) => {
            return {
                ...current,
                errorMessage: undefined,
                startedAt: current.startedAt ?? Date.now(),
                status: "starting",
            };
        });
    }

    public markStarted(id: string, _pid: number | null): void {
        // PIDs aren't surfaced in the UI today — but keep the seam so the
        // bridge doesn't have to special-case ephemeral vs registry.
        this.#updateState(id, (current) => {
            return {
                ...current,
                startedAt: current.startedAt ?? Date.now(),
                status: current.status === "ready" ? "ready" : "starting",
            };
        });
    }

    public markReady(id: string, info: { host: string; port: number }): void {
        this.#updateState(id, (current) => {
            return {
                ...current,
                errorMessage: undefined,
                port: info.port,
                readyAt: Date.now(),
                status: "ready",
            };
        });
    }

    public markFailed(id: string, reason: string, detail?: Record<string, unknown>): void {
        const message = detail?.["message"] as string | undefined;

        this.#updateState(id, (current) => {
            return {
                ...current,
                errorMessage: sanitizeLogLine(message ?? reason),
                status: "failed",
            };
        });
    }

    public markCrashed(id: string, tail: ReadonlyArray<string>): void {
        const cleanTail = tail.slice(-TAIL_LINE_LIMIT).map(sanitizeLogLine);

        this.#updateState(id, (current) => {
            return {
                ...current,
                errorMessage: cleanTail.length > 0 ? cleanTail[cleanTail.length - 1] : "process exited",
                status: "crashed",
                tailLines: cleanTail,
            };
        });
    }

    public appendLog(id: string, chunk: string): void {
        const lines = chunk
            .split("\n")
            .map(sanitizeLogLine)
            .filter((line) => line.length > 0);

        if (lines.length === 0) {
            return;
        }

        this.#updateState(id, (current) => {
            const nextTail = [...current.tailLines, ...lines];

            // Bound by line count and approx byte budget so a chatty service
            // can't grow the buffer unboundedly.
            while (nextTail.length > TAIL_LINE_LIMIT) {
                nextTail.shift();
            }

            let bytes = 0;

            for (let i = nextTail.length - 1; i >= 0; i--) {
                bytes += nextTail[i]!.length + 1;

                if (bytes > TAIL_BYTES_BUDGET) {
                    nextTail.splice(0, i + 1);

                    break;
                }
            }

            return {
                ...current,
                lastLine: lines[lines.length - 1],
                tailLines: nextTail,
            };
        });
    }

    /**
     * Fail every still-booting service at once. Used on Ctrl+C to mark
     * the dock as terminated rather than leaving services frozen mid-boot.
     */
    public abortBoot(reason: string): void {
        let changed = false;

        const next = new Map(this.#states);

        for (const [id, state] of next) {
            if (state.status === "pending" || state.status === "starting") {
                next.set(id, { ...state, errorMessage: reason, status: "failed" });
                changed = true;
            }
        }

        if (!changed) {
            return;
        }

        this.#states = next;
        this.#refreshSnapshot();
        this.#emit();
    }

    #updateState(id: string, transform: (current: ServiceState) => ServiceState): void {
        const current = this.#states.get(id);

        if (!current) {
            return;
        }

        this.#states.set(id, transform(current));
        this.#refreshSnapshot();
        this.#emit();
    }

    #refreshSnapshot(): void {
        this.#snapshot = new Map(this.#states);
    }

    #emit(): void {
        for (const listener of this.#listeners) {
            try {
                listener();
            } catch {
                // Isolate listener errors so a bad subscriber can't poison the dock.
            }
        }
    }
}
