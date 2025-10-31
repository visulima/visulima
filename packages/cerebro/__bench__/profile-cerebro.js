// packages/cerebro/__bench__/profile-cerebro.js
import { Cerebro } from "@visulima/cerebro";

const iterations = 100; // Reduced for profiling

console.time("Total execution");

for (let i = 0; i < iterations; i++) {
    const cli = new Cerebro("test-cli", {
        argv: ["deploy", "--env", "production", "--verbose"],
        packageVersion: "1.0.0",
    });

    cli.addCommand({
        description: "Deploy command",
        execute: () => {},
        name: "deploy",
        options: [
            { alias: "e", name: "env", type: String },
            { alias: "r", name: "region", type: String },
            { alias: "v", name: "verbose", type: Boolean },
            { alias: "f", name: "force", type: Boolean },
            { name: "dry-run", type: Boolean },
            { alias: "w", name: "workers", type: Number },
            { alias: "t", name: "timeout", type: Number },
            { alias: "c", name: "config", type: String },
        ],
    });

    await cli.run({ shouldExitProcess: false });
}

console.timeEnd("Total execution");
console.log(`Average per iteration: ${(process.uptime() * 1000) / iterations}ms`);
