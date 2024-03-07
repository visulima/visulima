import fsp from "node:fs/promises";
import { dirname } from "pathe";

export const ensuredir = async (path: string): Promise<void> => {
  await fsp.mkdir(dirname(path), { recursive: true });
}
