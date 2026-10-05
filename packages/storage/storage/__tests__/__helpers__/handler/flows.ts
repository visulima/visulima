import { expect } from "vitest";

/**
 * Sends a request to the handler under test. `path` is relative to the server root (e.g. `/files`).
 */
export type Send = (path: string, init?: RequestInit) => Promise<Response>;

const toPath = (location: string): string => {
    const url = new URL(location, "http://localhost");

    return url.pathname + url.search;
};

const TUS_HEADERS = { "Tus-Resumable": "1.0.0" };

const toBase64 = (value: string): string => Buffer.from(value).toString("base64");

export const REST_FLOW_ASSERTIONS = 16;

/**
 * Create → HEAD → GET → metadata → download → PUT replace → DELETE through the REST handler mounted at `base`.
 */
export const restFlow = async (send: Send, base: string): Promise<void> => {
    const created = await send(base, {
        body: "hello world",
        headers: {
            "content-disposition": "attachment; filename=\"hello.txt\"",
            "content-length": "11",
            "content-type": "text/plain",
            "x-file-metadata": JSON.stringify({ _internal: "dropped", tag: "kept" }),
        },
        method: "POST",
    });
    const file = (await created.json()) as { id: string; metadata: Record<string, unknown>; originalName: string };

    expect(created.status).toBe(201);
    expect(file.originalName).toBe("hello.txt");
    expect(file.metadata).toStrictEqual(expect.objectContaining({ tag: "kept" }));
    expect(file.metadata).not.toHaveProperty("_internal");

    const location = toPath(created.headers.get("location") as string);

    expect(location).toContain(file.id);

    const head = await send(`${base}/${file.id}`, { method: "HEAD" });

    expect(head.status).toBe(200);

    const get = await send(`${base}/${file.id}`);

    expect(get.status).toBe(200);
    await expect(get.text()).resolves.toBe("hello world");

    const metadata = await send(`${base}/${file.id}/metadata`);

    await expect(metadata.json()).resolves.toMatchObject({ id: file.id, originalName: "hello.txt" });

    const download = await send(`${base}/${file.id}/download`);

    expect(download.headers.get("content-disposition")).toMatch(/^attachment;.*hello\.txt/);
    await expect(download.text()).resolves.toBe("hello world");

    const replaced = await send(`${base}/${file.id}`, { body: "replaced", headers: { "content-length": "8", "content-type": "text/plain" }, method: "PUT" });

    expect(replaced.status).toBe(200);

    const afterPut = await send(`${base}/${file.id}`);

    await expect(afterPut.text()).resolves.toBe("replaced");

    const deleted = await send(`${base}/${file.id}`, { method: "DELETE" });

    expect(deleted.status).toBe(204);

    const gone = await send(`${base}/${file.id}`);

    expect(gone.status).toBe(404);

    const preflight = await send(base, { method: "OPTIONS" });

    expect(preflight.status).toBe(204);
};

export const TUS_FLOW_ASSERTIONS = 14;

/**
 * OPTIONS → create → HEAD → PATCH → HEAD → GET (metadata) → unsupported PUT → DELETE through the TUS handler mounted at `base`.
 */
export const tusFlow = async (send: Send, base: string): Promise<void> => {
    const options = await send(base, { method: "OPTIONS" });

    expect(options.status).toBe(204);
    expect(options.headers.get("tus-version")).toContain("1.0.0");

    const created = await send(base, {
        headers: {
            ...TUS_HEADERS,
            "Upload-Length": "11",
            "Upload-Metadata": `filename ${toBase64("hello.txt")},filetype ${toBase64("text/plain")}`,
        },
        method: "POST",
    });

    expect(created.status).toBe(201);

    const location = toPath(created.headers.get("location") as string);

    const head = await send(location, { headers: TUS_HEADERS, method: "HEAD" });

    expect(head.headers.get("upload-offset")).toBe("0");

    const patched = await send(location, {
        body: "hello world",
        headers: { ...TUS_HEADERS, "Content-Type": "application/offset+octet-stream", "Upload-Offset": "0" },
        method: "PATCH",
    });

    expect(patched.status).toBe(204);
    expect(patched.headers.get("upload-offset")).toBe("11");
    expect(patched.headers.get("tus-resumable")).toBe("1.0.0");

    const headAfter = await send(location, { headers: TUS_HEADERS, method: "HEAD" });

    expect(headAfter.headers.get("upload-offset")).toBe("11");
    expect(headAfter.headers.get("upload-length")).toBe("11");

    const get = await send(location, { headers: TUS_HEADERS });

    expect(get.status).toBe(200);
    await expect(get.json()).resolves.toMatchObject({ originalName: "hello.txt", status: "completed" });

    const put = await send(location, { body: "x", headers: TUS_HEADERS, method: "PUT" });

    expect(put.status).toBe(405);

    const deleted = await send(location, { headers: TUS_HEADERS, method: "DELETE" });

    expect(deleted.status).toBe(204);

    const gone = await send(location, { headers: TUS_HEADERS, method: "HEAD" });

    expect(gone.status).toBe(404);
};

export const MULTIPART_FLOW_ASSERTIONS = 13;

/**
 * POST form → GET → metadata → download → unsupported PUT → OPTIONS → DELETE by Location through the multipart handler mounted at `base`.
 */
export const multipartFlow = async (send: Send, base: string): Promise<void> => {
    const form = new FormData();

    form.append("file", new Blob(["hello world"], { type: "text/plain" }), "hello.txt");
    form.append("label", "Greeting");
    form.append("metadata", JSON.stringify({ _internal: "dropped", tag: "kept" }));
    form.append("_secret", "dropped");

    const created = await send(base, { body: form, method: "POST" });
    const file = (await created.json()) as { id: string; metadata: Record<string, unknown>; originalName: string };

    expect(created.status).toBe(200);
    expect(file.originalName).toBe("hello.txt");
    expect(file.metadata).toStrictEqual(expect.objectContaining({ label: "Greeting", tag: "kept" }));
    expect(Object.keys(file.metadata).filter((key) => key.startsWith("_"))).toStrictEqual([]);

    // The Location carries the extension of the stored content type.
    const location = toPath(created.headers.get("location") as string);

    expect(location).toMatch(new RegExp(String.raw`/${file.id}\.txt$`));

    const get = await send(location);

    expect(get.status).toBe(200);
    await expect(get.text()).resolves.toBe("hello world");

    const metadata = await send(`${base}/${file.id}/metadata`);

    await expect(metadata.json()).resolves.toMatchObject({ id: file.id, metadata: { label: "Greeting", tag: "kept" } });

    const download = await send(`${base}/${file.id}/download`);

    expect(download.headers.get("content-disposition")).toMatch(/^attachment;.*hello\.txt/);

    const put = await send(location, { body: "x", method: "PUT" });

    expect(put.status).toBe(405);

    const preflight = await send(base, { method: "OPTIONS" });

    expect(preflight.status).toBe(204);

    const deleted = await send(location, { method: "DELETE" });

    expect(deleted.status).toBe(204);

    const gone = await send(`${base}/${file.id}`);

    expect(gone.status).toBe(404);
};
