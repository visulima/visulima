/**
 * A modified version from `https://github.com/unjs/pathe/blob/main/src/_internal.ts`
 *
 * MIT License
 * Copyright (c) Pooya Parsa <pooya@pi0.io> - Daniel Roe <daniel@roe.dev>
 */
const DRIVE_LETTER_START_RE = /^[A-Z]:\//i;

// Util to normalize windows paths to posix
const normalizeWindowsPath = (input = ""): string => {
  if (!input) {
    return input;
  }

  return input
    .replaceAll('\\', "/")
    .replace(DRIVE_LETTER_START_RE, (r) => r.toUpperCase());
}

export default normalizeWindowsPath;
