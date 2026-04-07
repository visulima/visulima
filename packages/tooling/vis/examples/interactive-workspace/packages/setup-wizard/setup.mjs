import { confirm, input, select } from "@inquirer/prompts";

console.log("=== Setup Wizard ===\n");

const env = await select({
    message: "Which environment?",
    choices: [
        { name: "Development", value: "dev" },
        { name: "Staging", value: "staging" },
        { name: "Production", value: "prod" },
    ],
});

const appName = await input({
    message: "Application name:",
    default: `my-app-${env}`,
});

const proceed = await confirm({
    message: `Deploy "${appName}" to ${env}?`,
});

if (!proceed) {
    console.log("\nSetup cancelled.");
    process.exit(1);
}

console.log(`\nDeploying "${appName}" to ${env}...`);
await new Promise((r) => setTimeout(r, 2000));
console.log("[OK] Setup complete!\n");
process.exit(0);
