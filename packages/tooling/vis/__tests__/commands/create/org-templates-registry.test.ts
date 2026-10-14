import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { IncomingHttpHeaders, Server } from "node:http";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveOrgTemplate } from "../../../src/commands/create/org-templates";

// Unlike org-templates.test.ts, nothing here is mocked: `.npmrc` scope-registry
// and token resolution (src/util/catalog) and the HTTP request are the real ones,
// talking to a local registry.

const manifest = {
    createConfig: { templates: [{ description: "Web app", name: "app", source: { kind: "npm", package: "@acme/create-app" } }] },
    dist: { tarball: "https://registry.example.test/@acme/create/-/create-1.0.0.tgz" },
};

interface Seen {
    headers: IncomingHttpHeaders;
    url: string | undefined;
}

describe("organization manifest fetch with a real .npmrc", () => {
    let server: Server;
    let port: number;
    let seen: Seen[];
    let respond: (url: string) => { body?: unknown; status: number };
    let cwd: string;
    let home: string;
    const savedHome = process.env.HOME;
    const savedUserProfile = process.env.USERPROFILE;

    beforeEach(async () => {
        seen = [];
        respond = () => { return { body: manifest, status: 200 }; };
        server = createServer((request, response) => {
            seen.push({ headers: request.headers, url: request.url });

            const { body, status } = respond(request.url ?? "");

            response.writeHead(status, { "content-type": "application/json" });
            response.end(body === undefined ? undefined : JSON.stringify(body));
        });

        await new Promise<void>((resolve) => {
            server.listen(0, "127.0.0.1", resolve);
        });
        port = (server.address() as { port: number }).port;

        // A throwaway HOME keeps the developer's own ~/.npmrc out of the test.
        home = mkdtempSync(join(tmpdir(), "vis-org-home-"));
        cwd = mkdtempSync(join(tmpdir(), "vis-org-cwd-"));
        process.env.HOME = home;
        process.env.USERPROFILE = home;
        writeFileSync(join(cwd, ".npmrc"), `@acme:registry=http://127.0.0.1:${String(port)}/\n//127.0.0.1:${String(port)}/:_authToken=s3cret\n`);
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });
        process.env.HOME = savedHome;

        if (savedUserProfile === undefined) {
            delete process.env.USERPROFILE;
        } else {
            process.env.USERPROFILE = savedUserProfile;
        }

        rmSync(home, { force: true, recursive: true });
        rmSync(cwd, { force: true, recursive: true });
    });

    it("requests @scope/create from the .npmrc scope registry with its auth token", async () => {
        expect.assertions(4);

        const choice = await resolveOrgTemplate("@acme:app", { args: [], cwd, interactive: false });

        expect(seen).toHaveLength(1);
        expect(seen[0]?.url).toBe("/@acme%2Fcreate/latest");
        expect(seen[0]?.headers.authorization).toBe("Bearer s3cret");
        expect(choice?.config).toMatchObject({ source: "@acme/create-app", type: "remote:npm" });
    });

    it("falls back to running @scope/create when the registry has no such package", async () => {
        expect.assertions(2);

        respond = () => { return { status: 404 }; };

        const choice = await resolveOrgTemplate("@acme", { args: ["--x"], cwd, interactive: false });

        expect(choice?.config).toStrictEqual({ args: ["--x"], source: "@acme/create", type: "remote:npm" });
        expect(seen).toHaveLength(1);
    });

    it("surfaces a registry error instead of silently falling back", async () => {
        expect.assertions(1);

        respond = () => { return { status: 500 }; };

        await expect(resolveOrgTemplate("@acme", { args: [], cwd, interactive: false })).rejects.toThrow("registry responded 500 for @acme/create");
    });

    it("sends no token to a registry the .npmrc has no credentials for", async () => {
        expect.assertions(2);

        writeFileSync(join(cwd, ".npmrc"), `@acme:registry=http://127.0.0.1:${String(port)}/\n`);

        await resolveOrgTemplate("@acme:app", { args: [], cwd, interactive: false });

        expect(seen).toHaveLength(1);
        expect(seen[0]?.headers.authorization).toBeUndefined();
    });
});
