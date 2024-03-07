import fsp from "node:fs/promises";
import { ensuredir } from "./ensuredir";

export const symlink = async (from: string, to: string, force = true): Promise<void> =>  {
  await ensuredir(to);

  if (force) {
    await fsp.unlink(to).catch(() => {});
  }

  await fsp.symlink(from, to, "junction");
}
