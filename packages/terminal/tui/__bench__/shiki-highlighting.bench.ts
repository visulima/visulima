/* eslint-disable import/no-extraneous-dependencies */
import { bench, describe } from "vitest";

import getHighlighter, { disposeHighlighter, getCachedTokens, resolveLanguage } from "../src/ink/highlighter";

const SMALL_CODE = `const x = 42;`;

const MEDIUM_CODE = `interface Config {
    port: number;
    host: string;
    debug?: boolean;
}

function createServer(config: Config): void {
    const { port, host, debug } = config;

    if (debug) {
        console.log(\`Starting server on \${host}:\${port}\`);
    }

    for (let i = 0; i < 10; i++) {
        console.log(\`Worker \${i} ready\`);
    }
}

const defaultConfig: Config = {
    port: 3000,
    host: "localhost",
    debug: true,
};

createServer(defaultConfig);`;

const LARGE_CODE = Array.from(
    { length: 50 },
    (_, i) =>
        `function handler${i}(req: Request, res: Response): void {
    const id = req.params.id;
    const data = db.find(id);
    if (!data) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    res.json({ data, timestamp: Date.now() });
}`,
).join("\n\n");

describe("Shiki Highlighting", () => {
    let highlighter: Awaited<ReturnType<typeof getHighlighter>>;

    bench(
        "highlighter initialization (cold start)",
        async () => {
            disposeHighlighter();
            highlighter = await getHighlighter(["typescript"]);
        },
        { iterations: 5, warmup: 0 },
    );

    bench("highlighter get (warm, already loaded)", async () => {
        highlighter = await getHighlighter(["typescript"]);
    });

    describe("codeToTokens", () => {
        bench("small (1 line)", () => {
            highlighter.codeToTokens(SMALL_CODE, { lang: "typescript", theme: "github-dark-default" });
        });

        bench("medium (30 lines)", () => {
            highlighter.codeToTokens(MEDIUM_CODE, { lang: "typescript", theme: "github-dark-default" });
        });

        bench("large (400 lines)", () => {
            highlighter.codeToTokens(LARGE_CODE, { lang: "typescript", theme: "github-dark-default" });
        });
    });

    describe("getCachedTokens (LRU cache)", () => {
        bench("cache miss", () => {
            // Use unique code each time to avoid cache hits
            const code = `const x = ${Math.random()};`;

            getCachedTokens(highlighter, code, "typescript", "github-dark-default");
        });

        bench("cache hit", () => {
            // Same code every time — should hit cache
            getCachedTokens(highlighter, MEDIUM_CODE, "typescript", "github-dark-default");
        });
    });
});

describe("Language resolution", () => {
    const aliases = ["js", "ts", "py", "rb", "rs", "sh", "yml", "md", "c++", "c#", "docker"];

    bench("resolveLanguage (11 aliases)", () => {
        for (const alias of aliases) {
            resolveLanguage(alias);
        }
    });
});
