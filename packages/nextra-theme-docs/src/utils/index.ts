import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export { default as getGitEditUrl } from "./get-git-edit-url";
export { default as getGitIssueUrl } from "./get-git-issue-url";
export { renderComponent, renderString } from "./render";
export { default as usePopper } from "./use-popper";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(...inputs));
