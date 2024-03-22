import { identifyInitiatingPackageManager } from "../../../dist/package-manager.js";

const pm = await identifyInitiatingPackageManager();

if (pm.name !== "cnpm" || !pm.version) {
    process.exit(1);
}
