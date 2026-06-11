import { describe, expect, it, vi } from "vitest";

import type { UploadControlSnapshot } from "../../src/core/upload-control";
import { UploadControl } from "../../src/core/upload-control";

const makeMeta = () => {
    return {
        endpoint: "http://localhost/api/upload",
        fingerprint: "tus::http://localhost/api/upload::test.bin::100::application/octet-stream::0",
        protocol: "tus" as const,
        uploadUrl: "http://localhost/api/upload/123",
    };
};

describe(UploadControl, () => {
    it("starts with all metadata undefined and offset 0", () => {
        expect.assertions(6);

        const control = new UploadControl();

        expect(control.protocol).toBeUndefined();
        expect(control.endpoint).toBeUndefined();
        expect(control.fingerprint).toBeUndefined();
        expect(control.uploadUrl).toBeUndefined();
        expect(control.offset).toBe(0);
        expect(control.snapshot).toBeUndefined();
    });

    it("throws on toJSON() if never attached", () => {
        expect.assertions(1);

        const control = new UploadControl();

        expect(() => control.toJSON()).toThrow(/not yet attached/);
    });

    it("exposes attached metadata after _attach", () => {
        expect.assertions(4);

        const control = new UploadControl();
        const meta = makeMeta();

        control._attach({ abort: vi.fn(), pause: vi.fn(), resume: vi.fn().mockResolvedValue(undefined) }, meta);

        expect(control.protocol).toBe(meta.protocol);
        expect(control.endpoint).toBe(meta.endpoint);
        expect(control.fingerprint).toBe(meta.fingerprint);
        expect(control.uploadUrl).toBe(meta.uploadUrl);
    });

    it("forwards pause/resume/abort to the attached binding", async () => {
        expect.assertions(3);

        const pause = vi.fn();
        const resume = vi.fn().mockResolvedValue(undefined);
        const abort = vi.fn();
        const control = new UploadControl();

        control._attach({ abort, pause, resume }, makeMeta());

        control.pause();
        await control.resume();
        control.abort();

        expect(pause).toHaveBeenCalledTimes(1);
        expect(resume).toHaveBeenCalledTimes(1);
        expect(abort).toHaveBeenCalledTimes(1);
    });

    it("silently no-ops pause/resume/abort after _detach", async () => {
        expect.assertions(3);

        const pause = vi.fn();
        const resume = vi.fn().mockResolvedValue(undefined);
        const abort = vi.fn();
        const control = new UploadControl();

        control._attach({ abort, pause, resume }, makeMeta());
        control._detach();

        control.pause();
        await control.resume();
        control.abort();

        expect(pause).not.toHaveBeenCalled();
        expect(resume).not.toHaveBeenCalled();
        expect(abort).not.toHaveBeenCalled();
    });

    it("tracks offset through _updateOffset", () => {
        expect.assertions(2);

        const control = new UploadControl();

        control._attach({ abort: vi.fn(), pause: vi.fn(), resume: vi.fn().mockResolvedValue(undefined) }, makeMeta());

        control._updateOffset(42);

        expect(control.offset).toBe(42);

        control._updateOffset(100);

        expect(control.offset).toBe(100);
    });

    it("toJSON() returns a snapshot reflecting the current offset", () => {
        expect.assertions(1);

        const control = new UploadControl();
        const meta = makeMeta();

        control._attach({ abort: vi.fn(), pause: vi.fn(), resume: vi.fn().mockResolvedValue(undefined) }, meta);
        control._updateOffset(50);

        expect(control.toJSON()).toStrictEqual({
            endpoint: meta.endpoint,
            fingerprint: meta.fingerprint,
            offset: 50,
            protocol: meta.protocol,
            uploadUrl: meta.uploadUrl,
            v: 1,
        });
    });

    it("round-trips through JSON.stringify + UploadControl.from", () => {
        expect.assertions(5);

        const original = new UploadControl();
        const meta = makeMeta();

        original._attach({ abort: vi.fn(), pause: vi.fn(), resume: vi.fn().mockResolvedValue(undefined) }, meta);
        original._updateOffset(50);

        const token = JSON.stringify(original);
        const restored = UploadControl.from(token);

        expect(restored.protocol).toBe(meta.protocol);
        expect(restored.endpoint).toBe(meta.endpoint);
        expect(restored.fingerprint).toBe(meta.fingerprint);
        expect(restored.uploadUrl).toBe(meta.uploadUrl);
        expect(restored.offset).toBe(50);
    });

    it("uploadControl.from accepts an already-parsed snapshot object", () => {
        expect.assertions(1);

        const snapshot: UploadControlSnapshot = {
            endpoint: "http://localhost/api/upload",
            fingerprint: "fp",
            offset: 25,
            protocol: "chunked-rest",
            uploadUrl: "abc123",
            v: 1,
        };

        const control = UploadControl.from(snapshot);

        expect(control.snapshot).toStrictEqual(snapshot);
    });

    it("uploadControl.from throws on an unknown snapshot version", () => {
        expect.assertions(1);

        const future = JSON.stringify({
            endpoint: "x",
            fingerprint: "x",
            protocol: "tus",
            uploadUrl: "x",
            v: 999,
        });

        expect(() => UploadControl.from(future)).toThrow(/unsupported snapshot version 999/);
    });

    it("a control created via UploadControl.from exposes snapshot until reattached", () => {
        expect.assertions(2);

        const snapshot: UploadControlSnapshot = {
            endpoint: "http://localhost/api/upload",
            fingerprint: "fp",
            offset: 25,
            protocol: "tus",
            uploadUrl: "http://localhost/api/upload/123",
            v: 1,
        };

        const control = UploadControl.from(snapshot);

        expect(control.snapshot).toStrictEqual(snapshot);

        // Re-attaching does not erase the snapshot — adapters rely on it to decide whether to resume.
        control._attach(
            { abort: vi.fn(), pause: vi.fn(), resume: vi.fn().mockResolvedValue(undefined) },
            { endpoint: snapshot.endpoint, fingerprint: snapshot.fingerprint, protocol: snapshot.protocol, uploadUrl: snapshot.uploadUrl },
        );

        expect(control.snapshot).toStrictEqual(snapshot);
    });
});
