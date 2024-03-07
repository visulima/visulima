import fsp from "node:fs/promises";

export const rmdir = async (dir: string): Promise<void> => {
  await fsp.unlink(dir).catch(() => {});
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
}
