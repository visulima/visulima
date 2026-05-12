import { isAccessibleSync } from "@visulima/fs";
import { join } from "@visulima/path";

/** Detects yarn berry vs classic via .yarnrc.yml presence. */
const isYarnBerry = (cwd: string): boolean => isAccessibleSync(join(cwd, ".yarnrc.yml"));

export { isYarnBerry };
