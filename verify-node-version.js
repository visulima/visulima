import { readFile } from "node:fs/promises";

try {
    let requiredVersion = await readFile(".nvmrc", { encoding: "utf8" });
    requiredVersion = requiredVersion.trim();

    if (!requiredVersion.includes("v")) {
        requiredVersion = `v${requiredVersion}`;
    }

    if (process.env.SKIP_CHECK !== undefined) {
        process.exit(0);
    }

    const [requiredMajor] = requiredVersion.split(".");
    const [currentMajor] = process.version.split(".");

    if (Number(requiredMajor.slice(1)) > Number(currentMajor.slice(1))) {
        console.error(`[!] This project requires Node.js ${requiredVersion}, current version is ${process.version}`);
        process.exit(1);
    }
} catch (error) {
    console.error("[!] Failed to verify Node.js version:", error.message);
    process.exit(1);
}
