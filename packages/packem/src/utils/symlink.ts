import fsp from "node:fs/promises";

import { ensureDir } from "@visulima/fs";

export const symlink = async (from: string, to: string, force = true): Promise<void> =>  {
  await ensureDir(to);

  if (force) {
    await fsp.unlink(to).catch(() => {});
  }

  await fsp.symlink(from, to, "junction");
}
