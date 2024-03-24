import { identifyInitiatingPackageManager } from "../../../dist/package-manager.js";

const pm = await identifyInitiatingPackageManager();

if (pm.name !== "pnpm" || !pm.version) {
    process.exit(1);
}
