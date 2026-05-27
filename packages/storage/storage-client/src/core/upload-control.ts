import type { FingerprintProtocol } from "./fingerprint";

const SNAPSHOT_VERSION = 1;

/**
 * Serializable description of an in-flight upload. Pass `toJSON()` through any
 * transport (localStorage, server, query param) and rehydrate with
 * `UploadControl.from(token)` in a different process to resume the upload.
 */
export interface UploadControlSnapshot {
    /** Endpoint the upload was created against. */
    endpoint: string;
    /** Stable per-file fingerprint — see `defaultFingerprint`. */
    fingerprint: string;
    /** Bytes uploaded at the time of serialization. Advisory — adapters re-query the server. */
    offset?: number;
    /** Adapter that owns the upload. */
    protocol: FingerprintProtocol;
    /**
     * Server-issued resume key. For TUS this is the `Location` header from the
     * initial POST (an absolute or relative URL). For chunked-REST this is the
     * `X-Upload-ID` value (an opaque identifier the adapter slots into
     * `${endpoint}/${id}`). The field is named for the TUS case for historical
     * reasons; treat it as `string` and let the adapter interpret it.
     */
    uploadUrl: string;
    /** Snapshot format version — bumped on incompatible changes. */
    v: typeof SNAPSHOT_VERSION;
}

/**
 * Internal contract — every adapter implementation passes one of these to
 * `_attach()` so the control object can drive the in-flight upload.
 */
export interface UploadControlBinding {
    abort: () => void;
    pause: () => void;
    resume: () => Promise<void>;
}

export interface UploadControlAttachMeta {
    endpoint: string;
    fingerprint: string;
    protocol: FingerprintProtocol;
    uploadUrl: string;
}

/**
 * Unified pause/resume/abort handle for an upload.
 *
 * Lifecycle:
 *  1. Construct empty (`new UploadControl()`) and pass into `adapter.upload(file, { control })`.
 *  2. The adapter calls `_attach()` once the upload identifier is known.
 *  3. Callers drive the upload via `pause/resume/abort`.
 *  4. `toJSON()` returns a serializable snapshot.
 *  5. In a future process, `UploadControl.from(snapshot)` returns a control
 *     pre-loaded with the snapshot — pass it to `adapter.upload(file, { control })`
 *     and the adapter resumes the in-flight upload instead of starting a new one.
 */
export class UploadControl {
    static from(token: string | UploadControlSnapshot): UploadControl {
        const snapshot = typeof token === "string" ? (JSON.parse(token) as UploadControlSnapshot) : token;

        if (snapshot.v !== SNAPSHOT_VERSION) {
            throw new Error(`UploadControl: unsupported snapshot version ${String(snapshot.v)}`);
        }

        const control = new UploadControl();

        control.#hydrate(snapshot);

        return control;
    }

    #binding: UploadControlBinding | undefined;

    #endpoint: string | undefined;

    #fingerprint: string | undefined;

    #offset = 0;

    #protocol: FingerprintProtocol | undefined;

    #snapshot: UploadControlSnapshot | undefined;

    #uploadUrl: string | undefined;

    abort(): void {
        this.#binding?.abort();
    }

    get endpoint(): string | undefined {
        return this.#endpoint;
    }

    get fingerprint(): string | undefined {
        return this.#fingerprint;
    }

    get offset(): number {
        return this.#offset;
    }

    pause(): void {
        this.#binding?.pause();
    }

    get protocol(): FingerprintProtocol | undefined {
        return this.#protocol;
    }

    async resume(): Promise<void> {
        if (this.#binding) {
            await this.#binding.resume();
        }
    }

    /**
     * Snapshot loaded via `UploadControl.from(token)` — adapters read this to
     * decide whether to skip the create step and resume an existing upload.
     */
    get snapshot(): UploadControlSnapshot | undefined {
        return this.#snapshot;
    }

    toJSON(): UploadControlSnapshot {
        if (this.#protocol === undefined || this.#endpoint === undefined || this.#fingerprint === undefined || this.#uploadUrl === undefined) {
            throw new Error("UploadControl.toJSON: control is not yet attached to an upload");
        }

        return {
            endpoint: this.#endpoint,
            fingerprint: this.#fingerprint,
            offset: this.#offset,
            protocol: this.#protocol,
            uploadUrl: this.#uploadUrl,
            v: SNAPSHOT_VERSION,
        };
    }

    get uploadUrl(): string | undefined {
        return this.#uploadUrl;
    }

    /**
     * Adapter-internal. Wires the in-flight upload's pause/resume/abort into this control.
     * @internal
     */
    _attach(binding: UploadControlBinding, meta: UploadControlAttachMeta): void {
        this.#binding = binding;
        this.#protocol = meta.protocol;
        this.#endpoint = meta.endpoint;
        this.#fingerprint = meta.fingerprint;
        this.#uploadUrl = meta.uploadUrl;
    }

    /**
     * Adapter-internal. Called when the upload finishes or is aborted.
     * @internal
     */
    _detach(): void {
        this.#binding = undefined;
    }

    /**
     * Adapter-internal. Keeps `toJSON()`'s `offset` field current.
     * @internal
     */
    _updateOffset(offset: number): void {
        this.#offset = offset;
    }

    #hydrate(snapshot: UploadControlSnapshot): void {
        this.#snapshot = snapshot;
        this.#protocol = snapshot.protocol;
        this.#endpoint = snapshot.endpoint;
        this.#fingerprint = snapshot.fingerprint;
        this.#uploadUrl = snapshot.uploadUrl;
        this.#offset = snapshot.offset ?? 0;
    }
}
