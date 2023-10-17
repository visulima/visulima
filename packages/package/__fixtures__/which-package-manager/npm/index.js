import { identifyInitiatingPackageManager } from "../../../dist/package-manager";

const pm = identifyInitiatingPackageManager();

if (pm.name !== "npm" || !pm.version) {
    process.exit(1);
}
