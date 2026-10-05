import { Transform } from "node:stream";

import type { UploadControlState, UploadControlToken } from "./types";

/**
 * Pause / resume / abort handle threaded into {@link Files.upload} via {@link UploadOptions.control}.
 *
 * `pause()` applies backpressure to the body stream; `resume()` releases it. This is effective for
 * streaming bodies feeding streaming adapters (S3, GCS, Azure, FTP/SFTP). Buffered adapters
 * (memory, disk) read the whole body in one shot and cannot be paused mid-transfer.
 * `abort()` cancels the operation through the merged {@link OperationOptions.signal}; the
 * adapter's upload session is kept, so the upload can still be resumed.
 *
 * On adapters with `capabilities.resumable`, an upload with a control is written in parts and
 * {@link UploadControl.toJSON} describes the adapter's upload session. Persist the token and pass
 * `UploadControl.from(token)` to `files.upload()` in another process to continue from the bytes
 * the adapter confirmed. That process needs the same backend and metadata store.
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

    /** Upload session of a resumable upload, from {@link UploadControl.from} or recorded when it starts. */
    private session?: Omit<UploadControlToken, "key" | "loaded" | "version">;

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
     * Rehydrate a control from a {@link UploadControl.toJSON} token (object or JSON string). The
     * returned control is `idle` with its `loaded` counter pre-seeded. Passed to `files.upload()`,
     * a token that carries an upload session (version 2) resumes that upload; a version 1 token
     * only restores the progress display.
     */
    public static from(token: UploadControlToken | string): UploadControl {
        const { key, loaded, version, ...session } = typeof token === "string" ? (JSON.parse(token) as UploadControlToken) : token;
        const control = new UploadControl({ key, loaded });

        if (version === 2 && session.uploadId !== undefined) {
            control.session = session;
        }

        return control;
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

    /**
     * Serializable resume token. Once a resumable upload has started it carries the upload session
     * and the bytes the adapter confirmed; `JSON.stringify(control)` produces the same object.
     */
    public toJSON(): UploadControlToken {
        return { key: this.key, loaded: this.loadedBytes, version: 2, ...this.session };
    }

    /** @deprecated Use {@link UploadControl.toJSON}. */
    public serialize(): UploadControlToken {
        return this.toJSON();
    }

    /**
     * The upload session this control resumes, if any.
     * @internal
     */
    public get _session(): Omit<UploadControlToken, "key" | "loaded" | "version"> | undefined {
        return this.session;
    }

    /**
     * Record the session of a resumable upload that just started.
     * @internal
     */
    public _startSession(session: Omit<UploadControlToken, "key" | "loaded" | "version">): void {
        this.session = session;
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
