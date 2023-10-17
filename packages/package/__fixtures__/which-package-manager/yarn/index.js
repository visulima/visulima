import { identifyInitiatingPackageManager } from "../../../dist/package-manager";

const pm = identifyInitiatingPackageManager();

if (pm.name !== "yarn" || !pm.version) {
    process.exit(1);
}
