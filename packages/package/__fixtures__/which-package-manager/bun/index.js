import { identifyInitiatingPackageManager } from "../../../dist/package-manager";

const pm = identifyInitiatingPackageManager();

if (pm.name !== "bun" || !pm.version) {
    process.exit(1);
}
