import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

/**
 * Minimal structural type for a `@google-cloud/storage` `File` as returned by
 * `firebase-admin`'s `getStorage(app).bucket().file()`. Declared locally so the
 * adapter type-checks without `firebase-admin` / `@google-cloud/storage`
 * installed (optional peer dependency).
 */
export interface FirebaseGcsFile {
    copy: (destination: FirebaseGcsFile | string) => Promise<unknown>;
    delete: (options?: { ignoreNotFound?: boolean }) => Promise<unknown>;
    download: () => Promise<[Buffer]>;
    exists: () => Promise<[boolean]>;
    getMetadata: () => Promise<[FirebaseGcsFileMetadata]>;
    getSignedUrl: (options: FirebaseSignedUrlOptions) => Promise<[string]>;
    move: (destination: FirebaseGcsFile | string) => Promise<unknown>;
    name: string;
    save: (data: Buffer, options?: { contentType?: string; resumable?: boolean }) => Promise<unknown>;
}

export interface FirebaseGcsFileMetadata {
    contentType?: string;
    etag?: string;
    md5Hash?: string;
    name?: string;
    size?: number | string;
    timeCreated?: string;
    updated?: string;
}

export interface FirebaseSignedUrlOptions {
    action: "delete" | "read" | "resumable" | "write";
    contentType?: string;
    expires: Date | number | string;
    version?: "v2" | "v4";
}

/**
 * Minimal structural type for a `@google-cloud/storage` `Bucket` as returned by
 * `firebase-admin`'s `getStorage(app).bucket()`.
 */
export interface FirebaseBucket {
    file: (key: string) => FirebaseGcsFile;
    getFiles: (options?: { maxResults?: number; prefix?: string }) => Promise<[FirebaseGcsFile[]]>;
    name?: string;
}

/**
 * Structural type for a `firebase-admin` `App`. Only the shape needed by
 * `getStorage()` is declared.
 */
export interface FirebaseApp {
    name: string;
}

export interface FirebaseStorageOptions extends BaseStorageOptions {
    /**
     * Pre-built `firebase-admin` {@link FirebaseApp} or an already-built
     * `@google-cloud/storage` `Bucket`. When a Bucket is supplied (detected by
     * the presence of `.file()` and `.getFiles()`), it is used directly and no
     * Firebase app is initialized. Use this to share an instance, run tests, or
     * customize the underlying GCS client.
     */
    app?: FirebaseApp | FirebaseBucket;

    /**
     * Named `firebase-admin` app to reuse/create. Defaults to the SDK default
     * app. Ignored when `app` is supplied.
     */
    appName?: string;

    /**
     * Storage bucket name (e.g. `my-project.appspot.com`). Falls back to
     * `FIREBASE_STORAGE_BUCKET`. Required unless a pre-built Bucket is passed
     * via `app`.
     */
    bucket?: string;

    /**
     * Service-account credentials. Ignored when `app` is supplied or
     * `serviceAccountPath` is used. Falls back to `FIREBASE_CLIENT_EMAIL` /
     * `FIREBASE_PRIVATE_KEY`.
     */
    credentials?: {
        clientEmail: string;
        privateKey: string;
    };

    /**
     * Default expiry, in seconds, for `getReadUrl` / `getUploadUrl` signed
     * URLs. Defaults to 3600 (1 hour).
     */
    defaultUrlExpiresIn?: number;

    /**
     * Configure metafiles storage. Used for TUS-style resumable upload
     * bookkeeping. Defaults to {@link LocalMetaStorage} under the OS tmp
     * directory.
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * Google Cloud project id. Falls back to `FIREBASE_PROJECT_ID`,
     * `GOOGLE_CLOUD_PROJECT`, or `GCLOUD_PROJECT`.
     */
    projectId?: string;

    /**
     * When set, `getReadUrl` returns `${publicBaseUrl}/${key}` instead of a
     * signed URL. Use for objects served through a public bucket or CDN.
     */
    publicBaseUrl?: string;

    /**
     * Path to a service-account JSON key file. Ignored when `app` or
     * `credentials` is supplied. Falls back to
     * `GOOGLE_APPLICATION_CREDENTIALS`.
     */
    serviceAccountPath?: string;
}
