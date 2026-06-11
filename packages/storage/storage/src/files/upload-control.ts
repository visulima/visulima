import type { Readable } from "node:stream";

import type { UploadControlState, UploadControlToken } from "./types";

/**
 * Pause / resume / abort handle threaded into {@link Files.upload} via {@link UploadOptions.control}.
 *
 * `pause()` applies backpressure to the body stream; `resume()` releases it. This is effective for
 * streaming bodies feeding streaming adapters (S3, GCS, Azure, FTP/SFTP). Buffered adapters
 * (memory, disk) read the whole body in one shot and cannot be paused mid-transfer.
 * `abort()` cancels the operation through the merged {@link OperationOptions.signal}.
 * `serialize()` / {@link UploadControl.from} round-trip the key + bytes observed for UI continuity.
 * @example
 * ```ts
 * const control = new UploadControl();
 * const promise = files.upload("big.bin", stream, { size, control });
 * pauseButton.onclick = () => control.pause();
 * resumeButton.onclick = () => control.resume();
 * cancelButton.onclick = () => control.abort();
 * await promise;
 * ```
 */
export class UploadControl {
    /** Caller-facing key being uploaded; populated once the upload starts. */
    public key?: string;

    private readonly controller = new AbortController();

    private internalState: UploadControlState = "idle";

    private loadedBytes: number;

    private startPaused = false;

    private boundStream?: Readable;

    public constructor(initial?: { key?: string; loaded?: number }) {
        this.loadedBytes = initial?.loaded ?? 0;
        this.key = initial?.key;
    }

    /**
     * Rehydrate a control from a {@link serialize} token (object or JSON string). The returned
     * control is `idle` with its `loaded` counter pre-seeded for progress display.
     */
    public static from(token: UploadControlToken | string): UploadControl {
        const parsed = typeof token === "string" ? (JSON.parse(token) as UploadControlToken) : token;

        return new UploadControl({ key: parsed.key, loaded: parsed.loaded });
    }

    /** Abort signal merged into the upload operation. */
    public get signal(): AbortSignal {
        return this.controller.signal;
    }

    public get state(): UploadControlState {
        return this.internalState;
    }

    /** Bytes observed leaving the facade so far. */
    public get loaded(): number {
        return this.loadedBytes;
    }

    public pause(): void {
        if (this.internalState === "uploading" || this.internalState === "idle") {
            this.internalState = "paused";
            this.startPaused = true;
            this.boundStream?.pause();
        }
    }

    public resume(): void {
        if (this.internalState === "paused") {
            this.internalState = "uploading";
            this.startPaused = false;
            this.boundStream?.resume();
        }
    }

    public abort(reason?: unknown): void {
        if (this.internalState !== "completed" && this.internalState !== "aborted") {
            this.internalState = "aborted";
            this.controller.abort(reason);
        }
    }

    public serialize(): UploadControlToken {
        return { key: this.key, loaded: this.loadedBytes, version: 1 };
    }

    /**
     * Attach the live body stream so `pause()`/`resume()` can drive its backpressure. Called by
     * {@link Files.upload}; not part of the stable public surface.
     * @internal
     */
    public _bind(stream: Readable, key: string): void {
        this.boundStream = stream;
        this.key ??= key;

        if (this.internalState !== "aborted") {
            this.internalState = this.startPaused ? "paused" : "uploading";
        }

        if (this.startPaused) {
            stream.pause();
        }
    }

    /**
     * Record bytes observed by the facade's progress meter.
     * @internal
     */
    public _progress(loaded: number): void {
        this.loadedBytes = loaded;
    }

    /**
     * Mark the upload finished; releases the stream reference.
     * @internal
     */
    public _complete(): void {
        if (this.internalState !== "aborted") {
            this.internalState = "completed";
        }

        this.boundStream = undefined;
    }
}
