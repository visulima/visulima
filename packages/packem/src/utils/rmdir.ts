import fsp from "node:fs/promises";

export const rmdir = async (dir: string): Promise<void> => {
  await fsp.unlink(dir).catch(() => {});
  await fsp.rm(dir, { force: true, recursive: true }).catch(() => {});
}
