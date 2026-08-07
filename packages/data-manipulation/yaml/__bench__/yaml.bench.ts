/* eslint-disable import/no-extraneous-dependencies */
import jsYaml from "js-yaml";
import * as visulima from "@visulima/yaml";
import { bench, describe } from "vitest";
import * as yaml from "yaml";

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
    bench("@visulima/yaml", () => {
        visulima.parse(SMALL);
    });

    bench("yaml", () => {
        yaml.parse(SMALL);
    });

    bench("js-yaml", () => {
        jsYaml.load(SMALL);
    });
});

describe("parse › medium config", () => {
    bench("@visulima/yaml", () => {
        visulima.parse(CONFIG);
    });

    bench("yaml", () => {
        yaml.parse(CONFIG);
    });

    bench("js-yaml", () => {
        jsYaml.load(CONFIG);
    });
});

describe("parse › anchors + merge keys", () => {
    bench("@visulima/yaml", () => {
        visulima.parse(ANCHORS);
    });

    bench("yaml", () => {
        yaml.parse(ANCHORS);
    });

    bench("js-yaml", () => {
        jsYaml.load(ANCHORS);
    });
});

describe("parse › large document (200 records)", () => {
    bench("@visulima/yaml", () => {
        visulima.parse(LARGE);
    });

    bench("yaml", () => {
        yaml.parse(LARGE);
    });

    bench("js-yaml", () => {
        jsYaml.load(LARGE);
    });
});

describe("stringify › medium config", () => {
    bench("@visulima/yaml", () => {
        visulima.stringify(parsedConfig);
    });

    bench("yaml", () => {
        yaml.stringify(parsedConfig);
    });

    bench("js-yaml", () => {
        jsYaml.dump(parsedConfig);
    });
});
