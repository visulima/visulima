import { fileURLToPath } from "node:url";

const toPath = (urlOrPath: URL | string): string => (urlOrPath instanceof URL ? fileURLToPath(urlOrPath) : urlOrPath);

export default toPath;
