import { identifyInitiatingPackageManager } from "../../../dist/package-manager";

const pm = identifyInitiatingPackageManager();

if (pm.name !== "pnpm" || !pm.version) {
    process.exit(1);
}
