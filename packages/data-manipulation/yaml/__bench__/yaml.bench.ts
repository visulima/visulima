/* eslint-disable import/no-extraneous-dependencies */
import { createRequire } from "node:module";

import jsYaml from "js-yaml";
import * as visulima from "@visulima/yaml";
import { describe, test } from "vitest";
import * as yaml from "yaml";

// `yamljs` (a widely-used, older pure-JS YAML 1.1 parser) is an optional third
// comparison target — it is required lazily so the suite still runs where the
// dependency could not be installed.
const require_ = createRequire(import.meta.url);

let yamlJs: { parse: (source: string) => unknown; stringify: (value: unknown) => string } | undefined;

try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    yamlJs = require_("yamljs") as typeof yamlJs;
} catch (error) {
    // Only "not installed" is expected. Anything else means yamljs is present
    // but broken, and silently dropping it would report a complete comparison
    // that is missing a target.
    if ((error as NodeJS.ErrnoException).code !== "MODULE_NOT_FOUND") {
        throw error;
    }

    yamlJs = undefined;
}

const SMALL = ["name: my-app", "version: 1.0.0", "private: true", "scripts:", "  build: packem build", "  test: vitest run"].join("\n");

const CONFIG = [
    "server:",
    "  host: 0.0.0.0",
    "  port: 8080",
    "  ssl:",
    "    enabled: true",
    "    ciphers: [ECDHE-RSA-AES128-GCM-SHA256, ECDHE-RSA-AES256-GCM-SHA384]",
    "database:",
    "  adapter: postgres",
    "  pool: { min: 2, max: 10 }",
    "  replicas:",
    "    - host: db1.internal",
    "      weight: 1",
    "    - host: db2.internal",
    "      weight: 2",
    "features:",
    "  - name: search",
    "    enabled: true",
    "  - name: billing",
    "    enabled: false",
    "notes: |",
    "  This is a multi-line",
    "  literal block scalar",
    "  used to describe the config.",
].join("\n");

const ANCHORS = [
    "defaults: &defaults",
    "  adapter: postgres",
    "  host: localhost",
    "  timeout: 30",
    "development:",
    "  <<: *defaults",
    "  database: dev",
    "test:",
    "  <<: *defaults",
    "  database: test",
    "production:",
    "  <<: *defaults",
    "  database: prod",
    "  host: prod.internal",
].join("\n");

const buildLarge = (): string => {
    const lines: string[] = ["items:"];

    for (let index = 0; index < 200; index++) {
        lines.push(
            `  - id: ${index}`,
            `    name: item-${index}`,
            `    active: ${index % 2 === 0}`,
            "    tags: [alpha, beta, gamma]",
            `    score: ${(index * 1.5).toFixed(2)}`,
        );
    }

    return lines.join("\n");
};

const LARGE = buildLarge();

const parsedConfig = visulima.parse(CONFIG);

describe("parse › small document", () => {
    test("@visulima/yaml", async ({ bench }) => {
        await bench("@visulima/yaml", () => {
            visulima.parse(SMALL);
        }).run();
    });

    test("yaml", async ({ bench }) => {
        await bench("yaml", () => {
            yaml.parse(SMALL);
        }).run();
    });

    test("js-yaml", async ({ bench }) => {
        await bench("js-yaml", () => {
            jsYaml.load(SMALL);
        }).run();
    });

    if (yamlJs) {
        test("yamljs", async ({ bench }) => {
            await bench("yamljs", () => {
                yamlJs!.parse(SMALL);
            }).run();
        });
    }
});

describe("parse › medium config", () => {
    test("@visulima/yaml", async ({ bench }) => {
        await bench("@visulima/yaml", () => {
            visulima.parse(CONFIG);
        }).run();
    });

    test("yaml", async ({ bench }) => {
        await bench("yaml", () => {
            yaml.parse(CONFIG);
        }).run();
    });

    test("js-yaml", async ({ bench }) => {
        await bench("js-yaml", () => {
            jsYaml.load(CONFIG);
        }).run();
    });

    if (yamlJs) {
        test("yamljs", async ({ bench }) => {
            await bench("yamljs", () => {
                yamlJs!.parse(CONFIG);
            }).run();
        });
    }
});

describe("parse › anchors + merge keys", () => {
    test("@visulima/yaml", async ({ bench }) => {
        await bench("@visulima/yaml", () => {
            visulima.parse(ANCHORS);
        }).run();
    });

    test("yaml", async ({ bench }) => {
        await bench("yaml", () => {
            yaml.parse(ANCHORS);
        }).run();
    });

    test("js-yaml", async ({ bench }) => {
        await bench("js-yaml", () => {
            jsYaml.load(ANCHORS);
        }).run();
    });

    if (yamlJs) {
        test("yamljs", async ({ bench }) => {
            await bench("yamljs", () => {
                yamlJs!.parse(ANCHORS);
            }).run();
        });
    }
});

describe("parse › large document (200 records)", () => {
    test("@visulima/yaml", async ({ bench }) => {
        await bench("@visulima/yaml", () => {
            visulima.parse(LARGE);
        }).run();
    });

    test("yaml", async ({ bench }) => {
        await bench("yaml", () => {
            yaml.parse(LARGE);
        }).run();
    });

    test("js-yaml", async ({ bench }) => {
        await bench("js-yaml", () => {
            jsYaml.load(LARGE);
        }).run();
    });

    if (yamlJs) {
        test("yamljs", async ({ bench }) => {
            await bench("yamljs", () => {
                yamlJs!.parse(LARGE);
            }).run();
        });
    }
});

describe("stringify › medium config", () => {
    test("@visulima/yaml", async ({ bench }) => {
        await bench("@visulima/yaml", () => {
            visulima.stringify(parsedConfig);
        }).run();
    });

    test("yaml", async ({ bench }) => {
        await bench("yaml", () => {
            yaml.stringify(parsedConfig);
        }).run();
    });

    test("js-yaml", async ({ bench }) => {
        await bench("js-yaml", () => {
            jsYaml.dump(parsedConfig);
        }).run();
    });

    if (yamlJs) {
        test("yamljs", async ({ bench }) => {
            await bench("yamljs", () => {
                yamlJs!.stringify(parsedConfig);
            }).run();
        });
    }
});
