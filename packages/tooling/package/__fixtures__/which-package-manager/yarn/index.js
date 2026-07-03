import { identifyInitiatingPackageManager } from "../../../dist/package-manager.cjs";

const pm = await identifyInitiatingPackageManager();

if (pm.name !== "yarn" || !pm.version) {
    process.exit(1);
}
