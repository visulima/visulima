// eslint-disable-next-line import/no-extraneous-dependencies
import bracesIcon from "lucide-static/icons/braces.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import cookieIcon from "lucide-static/icons/cookie.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import fileTextIcon from "lucide-static/icons/file-text.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import globeIcon from "lucide-static/icons/globe.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import userIcon from "lucide-static/icons/user.svg?data-uri&encoding=css";

import getHighlighter from "../../../../../shared/utils/get-highlighter";
import copyButton from "../components/copy-button";
import type { ContentPage } from "../types";
import { sanitizeAttribute, sanitizeCodeHtml, sanitizeHtml, sanitizeUrlAttribute } from "../utils/sanitize";
import type { ContextContentOptions, HeadersInput, HeadersOutput, HeadersRecord, HeaderValue, RequestLike } from "./types";
import { isHeadersObject } from "./types";

const SENSITIVE_HEADER_PATTERNS = [/authorization/i, /cookie/i, /set-cookie/i, /x-api-key/i, /api-key/i, /x-auth/i, /token/i, /secret/i];

// Helper functions for safe property access on RequestLike union type
const safeGetProperty = <T>(object: unknown, property: string): T | undefined => {
    if (typeof object === "object" && object !== null && property in object) {
        return (object as Record<string, T>)[property];
    }

    return undefined;
};

const safeGetMethod = (object: unknown, property: string): ((...arguments_: unknown[]) => unknown) | undefined => {
    const method = safeGetProperty<(...arguments_: unknown[]) => unknown>(object, property);

    return typeof method === "function" ? method : undefined;
};

const safeGetString = (object: unknown, property: string): string | undefined => {
    const value = safeGetProperty(object, property);

    return typeof value === "string" ? value : undefined;
};

const isSensitiveHeader = (name: string, denylist: string[] | undefined): boolean => {
    if (denylist && denylist.some((d) => d.toLowerCase() === name.toLowerCase())) {
        return true;
    }

    return SENSITIVE_HEADER_PATTERNS.some((re) => re.test(name));
};

const normalizeHeadersToEntries = (headers: HeadersInput): [string, HeaderValue][] => {
    if (!headers) {
        return [];
    }

    if (isHeadersObject(headers)) {
        const entries = safeGetMethod(headers, "entries");

        if (entries) {
            const entriesResult = entries() as IterableIterator<[string, string]>;

            return [...entriesResult].map(([k, v]: [string, string]) => [k, v as HeaderValue]);
        }
    }

    return Object.entries(headers as HeadersRecord);
};

const shouldIncludeHeader = (key: string, allowlist?: string[]): boolean => {
    if (!allowlist || allowlist.length === 0) {
        return true;
    }

    return allowlist.some((a) => a.toLowerCase() === key.toLowerCase());
};

const maskHeaderValue = (value: HeaderValue, masked: string | undefined): string | string[] => {
    if (!value || !masked) {
        return value as string | string[];
    }

    return Array.isArray(value) ? value.map(() => masked) : masked;
};

const filterHeaders = (headers: HeadersInput, allowlist?: string[], denylist?: string[], maskValue = "[masked]"): HeadersOutput => {
    const entries = normalizeHeadersToEntries(headers);

    if (entries.length === 0) {
        return undefined;
    }

    const out: Record<string, string | string[]> = {};

    for (const [key, value] of entries) {
        if (!shouldIncludeHeader(key, allowlist)) {
            continue;
        }

        if (value === undefined) {
            continue;
        }

        const masked = isSensitiveHeader(key.toLowerCase(), denylist) ? maskValue : undefined;

        out[key] = maskHeaderValue(value, masked);
    }

    return out;
};

const safeJsonStringify = (value: unknown): string => {
    try {
        // eslint-disable-next-line unicorn/no-null
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

const parseCookieString = (cookieHeader?: string | null): Record<string, string> => {
    if (!cookieHeader) {
        return {};
    }

    const result: Record<string, string> = {};

    cookieHeader
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((pair) => {
            const eqIndex = pair.indexOf("=");

            if (eqIndex === -1) {
                return;
            }

            const name = pair.slice(0, eqIndex).trim();
            const value = pair.slice(eqIndex + 1).trim();

            result[name] = value;
        });

    return result;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const readRequestBody = async (request: RequestLike, capBytes: number): Promise<unknown> => {
    try {
        const method = String(safeGetString(request, "method") || "GET").toUpperCase();

        if (method === "GET" || method === "HEAD") {
            return undefined;
        }

        const requestHeaders = safeGetProperty(request, "headers");
        const contentType = isHeadersObject(requestHeaders)
            ? safeGetMethod(requestHeaders, "get")?.("content-type") || ""
            : String((requestHeaders as Record<string, string | string[]>)?.["content-type"] || "");

        const cloneMethod = safeGetMethod(request, "clone");
        const cloned = (cloneMethod ? cloneMethod() : request) as RequestLike;

        if (safeGetMethod(cloned, "json") && String(contentType).includes("application/json")) {
            try {
                const jsonMethod = safeGetMethod(cloned, "json");

                return jsonMethod ? await jsonMethod() : undefined;
            } catch {
                try {
                    const textMethod = safeGetMethod(cloned, "text");

                    return textMethod ? await textMethod() || "" : undefined;
                } catch {
                    return undefined;
                }
            }
        }

        if (safeGetMethod(cloned, "text")) {
            try {
                const textMethod = safeGetMethod(cloned, "text");

                return textMethod ? await textMethod() : undefined;
            } catch {
                return undefined;
            }
        }

        // Node.js IncomingMessage fallback with size cap
        if (safeGetMethod(request, "on")) {
            return await new Promise<string | undefined>((resolve) => {
                try {
                    let data = "";
                    let truncated = false;

                    const setEncodingMethod = safeGetMethod(request, "setEncoding");

                    if (setEncodingMethod) {
                        setEncodingMethod("utf8");
                    }

                    const onData = (chunk: unknown) => {
                        if (truncated) {
                            return;
                        }

                        const chunkString = typeof chunk === "string" ? chunk : String(chunk);

                        if (data.length + chunkString.length > capBytes) {
                            const remaining = Math.max(0, capBytes - data.length);

                            data += chunkString.slice(0, remaining);
                            truncated = true;
                            // eslint-disable-next-line @typescript-eslint/no-use-before-define
                            cleanup();
                            resolve(`${data}\n… [truncated]`);

                            return;
                        }

                        data += chunkString;
                    };

                    const onEnd = () => {
                        // eslint-disable-next-line @typescript-eslint/no-use-before-define
                        cleanup();
                        resolve(data || undefined);
                    };

                    const onError = () => {
                        // eslint-disable-next-line @typescript-eslint/no-use-before-define
                        cleanup();
                        resolve(undefined);
                    };

                    const cleanup = () => {
                        const offMethod = safeGetMethod(request, "off");

                        offMethod?.("data", onData);
                        offMethod?.("end", onEnd);
                        offMethod?.("error", onError);
                    };

                    const onMethod = safeGetMethod(request, "on");

                    onMethod?.("data", onData);
                    onMethod?.("end", onEnd);
                    onMethod?.("error", onError);
                } catch {
                    resolve(undefined);
                }
            });
        }

        return undefined;
    } catch {
        return undefined;
    }
};

const createRequestContext = async (request: RequestLike, options: ContextContentOptions): Promise<ContentPage | undefined> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const uniqueId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    const { headerAllowlist, headerDenylist, maskValue = "[masked]" } = options || {};
    const filteredHeaders = filterHeaders(safeGetProperty(request, "headers"), headerAllowlist, headerDenylist, maskValue);

    const toSingle = (value: string | string[] | undefined): string | undefined => {
        if (value === undefined) {
            return undefined;
        }

        return Array.isArray(value) ? value.join(", ") : value;
    };

    const shellQuote = (input: string): string => `'${String(input).replaceAll("'", String.raw`'\''`)}'`;

    const buildCookieHeader = (cookies: Record<string, string | string[]> | undefined): string | undefined => {
        if (!cookies) {
            return undefined;
        }

        const parts: string[] = [];

        for (const [name, v] of Object.entries(cookies)) {
            const value = toSingle(v) ?? "";

            parts.push(`${name}=${value}`);
        }

        return parts.length > 0 ? parts.join("; ") : undefined;
    };

    let cookieHeader: string | undefined;

    const requestHeaders = safeGetProperty(request, "headers");

    if (isHeadersObject(requestHeaders)) {
        const getMethod = safeGetMethod(requestHeaders, "get");
        const cookieValue = getMethod?.("cookie");

        cookieHeader = typeof cookieValue === "string" ? cookieValue : undefined;
    } else if (Array.isArray((requestHeaders as Record<string, string | string[]>)?.cookie)) {
        cookieHeader = (requestHeaders as Record<string, string | string[]>)?.cookie?.[0] as string;
    } else {
        const cookieValue = (requestHeaders as Record<string, string | string[]>)?.cookie;

        cookieHeader = typeof cookieValue === "string" ? cookieValue : undefined;
    }

    const cookiesRecord: Record<string, string | string[]> | undefined = parseCookieString(cookieHeader);

    const previewBytes = Math.max(0, Number(options?.previewBytes ?? 64_000));
    const requestBody: unknown = await readRequestBody(request, previewBytes);

    const buildCurl = (): string => {
        const method = String(safeGetString(request, "method") || "GET").toUpperCase();
        const url = String(safeGetString(request, "url") || "");
        const headerLines: string[] = [];
        const headersForCurl: Record<string, string> = {};

        if (filteredHeaders) {
            for (const [k, v] of Object.entries(filteredHeaders)) {
                const value = toSingle(v);

                if (value !== undefined)
                    headersForCurl[k] = value;
            }
        }

        const cookieHeaderForCurl = buildCookieHeader(cookiesRecord);

        if (cookieHeaderForCurl && !headersForCurl["cookie"]) {
            headersForCurl["Cookie"] = cookieHeaderForCurl;
        }

        for (const [k, v] of Object.entries(headersForCurl)) {
            headerLines.push(`-H ${shellQuote(`${k}: ${v}`)}`);
        }

        let dataFlag = "";

        if (request && requestBody !== undefined && requestBody !== null && method !== "GET") {
            const bodyString = typeof requestBody === "string" ? requestBody : safeJsonStringify(requestBody);

            dataFlag = `--data ${shellQuote(bodyString)}`;
        }

        const parts = ["curl", "-X", method];

        if (headerLines.length > 0) {
            parts.push("\\", `  ${headerLines.join(" \\\n")}`);
        }

        if (dataFlag) {
            parts.push("\\", `  ${dataFlag}`);
        }

        parts.push("\\", `  ${shellQuote(url)}`);

        return parts.join(" ");
    };

    const curl = buildCurl();
    const highlighter = await getHighlighter();
    const curlHtmlRaw = await highlighter.codeToHtml(curl, {
        lang: "bash",
        themes: {
            dark: "github-dark-default",
            light: "github-light",
        },
    });
    const curlHtml = sanitizeCodeHtml(curlHtmlRaw);

    const attributeEscape = (value: unknown): string => sanitizeAttribute(value);
    const escapeHtml = (string_: string): string => sanitizeHtml(string_);

    const renderKeyValueTable = (records: Record<string, string | string[]> | undefined): string => {
        if (!records || Object.keys(records).length === 0) {
            return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--ono-text-muted)]">(empty)</div>`;
        }

        const rows = Object.entries(records)
            .map(([k, v]) => {
                const value = Array.isArray(v) ? v.join(", ") : v;

                return `<div class="grid grid-cols-[200px_1fr] gap-3 items-start py-2 border-b border-[var(--ono-border)]">
  <div class="text-[11px] uppercase tracking-wide text-[var(--ono-text-muted)]">${escapeHtml(k)}</div>
  <div class="text-sm break-words whitespace-pre-wrap text-[var(--ono-text)]">${escapeHtml(String(value))}</div>
</div>`;
            })
            .join("");

        return `<div class="px-4 pb-4">${rows}</div>`;
    };

    const renderPrimitiveValue = (value: string | number | boolean): string => {
        const className = "text-[var(--ono-red-orange)]";

        return `<span class="${className}">${typeof value === "string" ? `"${escapeHtml(value)}"` : String(value)}</span>`;
    };

    const renderNullishValue = (value: null | undefined): string => {
        const text = value === null ? "null" : "undefined";

        return `<span class="italic text-[var(--ono-text-muted)]">${text}</span>`;
    };

    const renderObjectValue = (object: Record<string, unknown>, depth: number): string => {
        if (Object.keys(object).length === 0) {
            return "<span class=\"italic text-[var(--ono-text-muted)]\">(empty object)</span>";
        }

        if (depth >= 3) {
            return `<span class="italic text-[var(--ono-text-muted)]">{Object with ${Object.keys(object).length} keys}</span>`;
        }

        const entries = Object.entries(object)
            .slice(0, 10)
            .map(([key, value]) => {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                const valueHtml = renderValue(value, depth + 1);

                return `
            <div class="ml-4 pl-3 py-1 border-l-2 border-[var(--ono-border)]">
              <span class="font-medium text-[var(--ono-text)]">${escapeHtml(key)}:</span> ${valueHtml}
            </div>`;
            })
            .join("");

        const remaining
            = Object.keys(object).length > 10
                ? `<div class="ml-4 italic text-[var(--ono-text-muted)]">... and ${Object.keys(object).length - 10} more keys</div>`
                : "";

        return `<div class="space-y-1">${entries}${remaining}</div>`;
    };

    const renderValue = (value: unknown, depth: number = 0): string => {
        if (value === null || value === undefined) {
            return renderNullishValue(value);
        }

        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return renderPrimitiveValue(value as string | number | boolean);
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                return "<span class=\"italic text-[var(--ono-text-muted)]\">(empty array)</span>";
            }

            if (depth >= 3) {
                return `<span class="italic text-[var(--ono-text-muted)]">[Array with ${value.length} items]</span>`;
            }

            const items = value
                .slice(0, 10)
                .map((item, index) => {
                    const itemHtml = renderValue(item, depth + 1);

                    return `
            <div class="ml-4 pl-3 py-1 border-l-2 border-[var(--ono-border)]">
              <span class="text-xs text-[var(--ono-text-muted)]">[${index}]:</span> ${itemHtml}
            </div>`;
                })
                .join("");

            const remaining
                = value.length > 10 ? `<div class="ml-4 text-sm italic text-[var(--ono-text-muted)]">... and ${value.length - 10} more items</div>` : "";

            return `<div class="space-y-1">${items}${remaining}</div>`;
        }

        if (typeof value === "object") {
            return renderObjectValue(value as Record<string, unknown>, depth);
        }

        return `<span class="text-[var(--ono-text)]">${escapeHtml(String(value))}</span>`;
    };

    const renderObjectTable = (object: Record<string, unknown> | undefined): string => {
        if (!object || Object.keys(object).length === 0) {
            return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--ono-text-muted)]">(empty)</div>`;
        }

        const rows = Object.entries(object)
            .map(([k, v]) => {
                const displayValue = renderValue(v);

                return `<div class="grid grid-cols-[200px_1fr] gap-3 items-start py-2 border-b border-[var(--ono-border)]">
  <div class="text-[11px] uppercase tracking-wide text-[var(--ono-text-muted)]">${escapeHtml(k)}</div>
  <div class="text-sm break-words text-[var(--ono-text)]">${displayValue}</div>
</div>`;
            })
            .join("");

        return `<div class="px-4 pb-4">${rows}</div>`;
    };

    const renderBodyContent = (body: unknown): string => {
        if (body === undefined || body === null) {
            return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--ono-text-muted)]">(no body)</div>`;
        }

        if (typeof body === "string") {
            if (body.trim() === "") {
                return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--ono-text-muted)]">(empty string)</div>`;
            }

            return `<div class="px-4 pb-4">
  <div class="text-sm break-words whitespace-pre-wrap font-mono p-3 rounded border border-[var(--ono-border)] bg-[var(--ono-surface-muted)] text-[var(--ono-text)]">${escapeHtml(body)}</div>
</div>`;
        }

        if (typeof body === "object") {
            if (Array.isArray(body)) {
                if (body.length === 0) {
                    return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--ono-text-muted)]">(empty array)</div>`;
                }

                return `<div class="px-4 pb-4">
  <div class="text-sm break-words p-3 rounded border border-[var(--ono-border)] bg-[var(--ono-surface-muted)] text-[var(--ono-text)]">${renderValue(body)}</div>
</div>`;
            }

            if (Object.keys(body as object).length === 0) {
                return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--ono-text-muted)]">(empty object)</div>`;
            }

            return `<div class="px-4 pb-4">
  <div class="text-sm break-words p-3 rounded border border-[var(--ono-border)] bg-[var(--ono-surface-muted)] text-[var(--ono-text)]">${renderValue(body)}</div>
</div>`;
        }

        return `<div class="px-4 pb-4">
  <div class="text-sm break-words whitespace-pre-wrap font-mono p-3 rounded border border-[var(--ono-border)] bg-[var(--ono-surface-muted)] text-[var(--ono-text)]">${escapeHtml(String(body))}</div>
</div>`;
    };

    const generateContextSections = (context: Record<string, unknown> | undefined): { content: string; sidebar: string } => {
        if (!context) {
            return { content: "", sidebar: "" };
        }

        const excludeKeys = new Set(["request"]);
        const contextKeys = Object.keys(context).filter((key) => !excludeKeys.has(key));

        if (contextKeys.length === 0) {
            return { content: "", sidebar: "" };
        }

        let sidebarSections = "";
        let contentSections = "";

        contextKeys.forEach((key) => {
            const value = context[key];

            if (value && typeof value === "object" && (Array.isArray(value) || Object.keys(value as object).length > 0)) {
                const title = key.charAt(0).toUpperCase() + key.slice(1);
                const sectionId = `context-${key}`;

                sidebarSections += `
    <div>
      <div class="text-[11px] uppercase tracking-wide mb-2 text-[var(--ono-text-muted)]">${title}</div>
      <ul class="space-y-1 text-sm">
        <li>
          <a href="#${sectionId}" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--ono-text)] hover:bg-[var(--ono-surface-muted)] ono-scrollspy-active:bg-[var(--ono-surface-muted)] ono-scrollspy-active:font-semibold">
            <span class="dui size-3" style="-webkit-mask-image:url('${fileTextIcon}'); mask-image:url('${fileTextIcon}')"></span>
            <span>${title}</span>
          </a>
        </li>
      </ul>
    </div>`;
                contentSections += `
  <input type="hidden" id="clipboard-${sectionId}-${uniqueId}" value="${attributeEscape(JSON.stringify(value))}">
  <section id="${sectionId}" class="mb-4 rounded-[var(--ono-radius-lg)] shadow-[var(--ono-elevation-1)] overflow-hidden bg-[var(--ono-surface)] border border-[var(--ono-border)]">
    <div class="px-4 py-2 flex items-center gap-2 bg-[var(--ono-surface-muted)] border-b border-[var(--ono-border)]">
      <h3 class="text-sm font-semibold text-[var(--ono-text)]">${title}</h3>
      <div class="grow"></div>
      <a href="#${sectionId}" class="text-xs text-[var(--ono-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ label: "Copy JSON", targetId: `clipboard-${sectionId}-${uniqueId}` }).html}
    </div>
    <div class="max-w-full overflow-auto mt-2">${renderObjectTable(value as Record<string, unknown>)}</div>
  </section>`;
            }
        });

        return { content: contentSections, sidebar: sidebarSections };
    };

    const contextSections = generateContextSections(options.context);

    const sidebar = `
<aside class="shrink-0 w-64 sticky top-4 self-start">
  <nav aria-label="Context sections" class="p-3 rounded-[var(--ono-radius-md)] shadow-[var(--ono-elevation-1)] space-y-4 overflow-auto bg-[var(--ono-surface)] border border-[var(--ono-border)] max-h-[calc(100dvh-2rem)]">
    <div>
      <div class="text-[11px] uppercase tracking-wide mb-2 text-[var(--ono-text-muted)]">Request</div>
      <ul class="space-y-1 text-sm">
        <li>
          <a href="#context-request" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--ono-text)] hover:bg-[var(--ono-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${globeIcon}'); mask-image:url('${globeIcon}')"></span>
            <span>Overview</span>
          </a>
        </li>
        <li>
          <a href="#context-headers" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--ono-text)] hover:bg-[var(--ono-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${fileTextIcon}'); mask-image:url('${fileTextIcon}')"></span>
            <span>Headers</span>
          </a>
        </li>
        <li>
          <a href="#context-body" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--ono-text)] hover:bg-[var(--ono-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${bracesIcon}'); mask-image:url('${bracesIcon}')"></span>
            <span>Body</span>
          </a>
        </li>
        <li>
          <a href="#context-session" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--ono-text)] hover:bg-[var(--ono-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${userIcon}'); mask-image:url('${userIcon}')"></span>
            <span>Session</span>
          </a>
        </li>
        <li>
          <a href="#context-cookies" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--ono-text)] hover:bg-[var(--ono-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${cookieIcon}'); mask-image:url('${cookieIcon}')"></span>
            <span>Cookies</span>
          </a>
        </li>
      </ul>
    </div>${contextSections.sidebar}
  </nav>
</aside>`;

    const content = `
<div class="grow min-w-0">
  <input type="hidden" id="clipboard-curl-${uniqueId}" value="${attributeEscape(curl)}">
  <section id="context-request" class="mb-4 rounded-[var(--ono-radius-lg)] shadow-[var(--ono-elevation-1)] overflow-hidden bg-[var(--ono-surface)] border border-[var(--ono-border)]">
    <div class="px-4 py-2 flex items-center gap-3 min-w-0 bg-[var(--ono-surface-muted)] border-b border-[var(--ono-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${globeIcon}'); mask-image:url('${globeIcon}')"></span>
      <h2 class="text-sm font-semibold text-[var(--ono-text)]">Request</h2>
      <a class="text-sm truncate text-[var(--ono-red-orange)]" href="${sanitizeUrlAttribute(safeGetString(request, "url") || "#")}">${escapeHtml(safeGetString(request, "url") || "")}</a>
      <span class="inline-block text-[10px] px-2 py-0.5 rounded-full bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)]">${escapeHtml(String(safeGetString(request, "method") || "GET"))}</span>
      <div class="grow"></div>
      ${copyButton({ label: "Copy cURL", targetId: `clipboard-curl-${uniqueId}` }).html}
    </div>
    <div class="px-4 pb-4 overflow-auto mt-2">${curlHtml}</div>
  </section>

  <input type="hidden" id="clipboard-headers-${uniqueId}" value="${attributeEscape(JSON.stringify(filteredHeaders || {}))}">
  <section id="context-headers" class="mb-4 rounded-[var(--ono-radius-lg)] shadow-[var(--ono-elevation-1)] overflow-hidden bg-[var(--ono-surface)] border border-[var(--ono-border)]">
    <div class="px-4 py-2 flex items-center gap-2 bg-[var(--ono-surface-muted)] border-b border-[var(--ono-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${fileTextIcon}'); mask-image:url('${fileTextIcon}')"></span>
      <h3 class="text-sm font-semibold text-[var(--ono-text)]">Headers</h3>
      <div class="grow"></div>
      <a href="#context-headers" class="text-xs text-[var(--ono-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ label: "Copy JSON", targetId: `clipboard-headers-${uniqueId}` }).html}
    </div>
    <div class="max-w-full overflow-auto mt-2">${renderKeyValueTable(filteredHeaders)}</div>
  </section>

  <input type="hidden" id="clipboard-body-${uniqueId}" value="${attributeEscape(safeJsonStringify(requestBody ?? {}))}">
  <section id="context-body" class="mb-4 rounded-[var(--ono-radius-lg)] shadow-[var(--ono-elevation-1)] overflow-hidden bg-[var(--ono-surface)] border border-[var(--ono-border)]">
    <div class="px-4 py-2 flex items-center gap-2 bg-[var(--ono-surface-muted)] border-b border-[var(--ono-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${bracesIcon}'); mask-image:url('${bracesIcon}')"></span>
      <h3 class="text-sm font-semibold text-[var(--ono-text)]">Body</h3>
      <div class="grow"></div>
      <a href="#context-body" class="text-xs text-[var(--ono-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ label: "Copy JSON", targetId: `clipboard-body-${uniqueId}` }).html}
    </div>
    <div class="max-w-full overflow-auto mt-2">${renderBodyContent(requestBody)}</div>
  </section>

  <input type="hidden" id="clipboard-session-${uniqueId}" value="${attributeEscape(JSON.stringify((request as RequestLike & { session?: Record<string, unknown> })?.session ?? {}))}">
  <section id="context-session" class="mb-4 rounded-[var(--ono-radius-lg)] shadow-[var(--ono-elevation-1)] overflow-hidden bg-[var(--ono-surface)] border border-[var(--ono-border)]">
    <div class="px-4 py-2 flex items-center gap-2 bg-[var(--ono-surface-muted)] border-b border-[var(--ono-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${userIcon}'); mask-image:url('${userIcon}')"></span>
      <h3 class="text-sm font-semibold text-[var(--ono-text)]">Session</h3>
      <div class="grow"></div>
      <a href="#context-session" class="text-xs text-[var(--ono-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ label: "Copy JSON", targetId: `clipboard-session-${uniqueId}` }).html}
    </div>
            <div class="max-w-full overflow-auto mt-2">${renderObjectTable((request as RequestLike & { session?: Record<string, unknown> })?.session as Record<string, unknown>)}</div>
  </section>

  <input type="hidden" id="clipboard-cookies-${uniqueId}" value="${attributeEscape(JSON.stringify(cookiesRecord || {}))}">
  <section id="context-cookies" class="mb-4 rounded-[var(--ono-radius-lg)] shadow-[var(--ono-elevation-1)] overflow-hidden bg-[var(--ono-surface)] border border-[var(--ono-border)]">
    <div class="px-4 py-2 flex items-center gap-2 bg-[var(--ono-surface-muted)] border-b border-[var(--ono-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${cookieIcon}'); mask-image:url('${cookieIcon}')"></span>
      <h3 class="text-sm font-semibold text-[var(--ono-text)]">Cookies</h3>
      <div class="grow"></div>
      <a href="#context-cookies" class="text-xs text-[var(--ono-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ label: "Copy JSON", targetId: `clipboard-cookies-${uniqueId}` }).html}
    </div>
    <div class="max-w-full overflow-auto mt-2">${renderKeyValueTable(cookiesRecord as Record<string, string | string[]>)}
    </div>
  </section>${contextSections.content}
</div>`;

    const html = `
<div class="w-full flex gap-4 relative">
  ${sidebar}
  ${content}
</div>`;

    return { code: { html, script: "" }, id: "context", name: "Context" };
};

export default createRequestContext;
