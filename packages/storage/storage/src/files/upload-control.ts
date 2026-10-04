import { Transform } from "node:stream";

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

    /** Chunks held by the gate while paused; released in order on `resume()`. */
    private heldChunks: (() => void)[] = [];

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
        }
    }

    public resume(): void {
        if (this.internalState === "paused") {
            this.internalState = "uploading";
            this.releaseHeldChunks();
        }
    }

    public abort(reason?: unknown): void {
        if (this.internalState !== "completed" && this.internalState !== "aborted") {
            this.internalState = "aborted";
            this.controller.abort(reason);
            this.releaseHeldChunks();
        }
    }

    public serialize(): UploadControlToken {
        return { key: this.key, loaded: this.loadedBytes, version: 1 };
    }

    /**
     * Start the upload and return a gate stream to pipe the body through. While paused, the gate
     * holds the next chunk, so backpressure stops the source no matter how the adapter consumes the
     * stream (`pipe()` and async iteration both bypass `Readable#pause()`). A pause issued before
     * the upload starts therefore holds too. Called by {@link Files.upload}; not part of the stable
     * public surface.
     * @internal
     */
    public _bind(key: string): Transform {
        this.key ??= key;

        if (this.internalState === "idle") {
            this.internalState = "uploading";
        }

        return new Transform({
            transform: (chunk: Buffer, _encoding, callback) => {
                if (this.internalState === "paused") {
                    this.heldChunks.push(() => {
                        callback(undefined, chunk);
                    });
                } else {
                    callback(undefined, chunk);
                }
            },
        });
    }

    private releaseHeldChunks(): void {
        const held = this.heldChunks;

        this.heldChunks = [];

        for (const release of held) {
            release();
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
     * Mark the upload finished.
     * @internal
     */
    public _complete(): void {
        if (this.internalState !== "aborted") {
            this.internalState = "completed";
        }
    }
}
