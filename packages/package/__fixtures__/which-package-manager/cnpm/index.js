import { identifyInitiatingPackageManager } from "../../../dist/package-manager";

const pm = identifyInitiatingPackageManager();

if (pm.name !== "cnpm" || !pm.version) {
    process.exit(1);
}
