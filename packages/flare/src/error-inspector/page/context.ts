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
import { sanitizeAttr as sanitizeAttribute, sanitizeCodeHtml, sanitizeHtml, sanitizeUrlAttr as sanitizeUrlAttribute } from "../util/sanitize";

const SENSITIVE_HEADER_PATTERNS = [/authorization/i, /cookie/i, /set-cookie/i, /x-api-key/i, /api-key/i, /x-auth/i, /token/i, /secret/i];

const isSensitiveHeader = (name: string, denylist: string[] | undefined): boolean => {
    if (denylist && denylist.some((d) => d.toLowerCase() === name.toLowerCase())) {
        return true;
    }

    return SENSITIVE_HEADER_PATTERNS.some((re) => re.test(name));
};

const filterHeaders = (
    headers: Record<string, string | string[] | undefined> | Headers | undefined,
    allowlist?: string[],
    denylist?: string[],
    maskValue = "[masked]",
): Record<string, string | string[]> | undefined => {
    if (!headers) {
        return undefined;
    }

    const out: Record<string, string | string[]> = {};

    const entries: [string, string | string[] | undefined][]
        = typeof (headers as any)?.forEach === "function" && typeof (headers as any)?.get === "function"
            ? [...(headers as Headers).entries()].map(([k, v]) => [k, v])
            : Object.entries(headers as Record<string, string | string[] | undefined>);

    for (const [key, value] of entries) {
        const lower = key.toLowerCase();

        if (allowlist && allowlist.length > 0 && !allowlist.some((a) => a.toLowerCase() === lower)) {
            continue;
        }

        const masked = isSensitiveHeader(lower, denylist) ? maskValue : undefined;

        if (value === undefined) {
            continue;
        }

        if (Array.isArray(value)) {
            out[key] = masked ? value.map(() => masked) : value;
        } else {
            out[key] = masked || value;
        }
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

const readRequestBody = async (request: Request, capBytes: number): Promise<unknown> => {
    try {
        const method = String(request?.method || "GET").toUpperCase();

        if (method === "GET" || method === "HEAD") {
            return undefined;
        }

        const contentType = (request as any)?.headers?.get?.("content-type") || (request as any)?.headers?.["content-type"] || "";
        const cloned = (request as any).clone ? (request as any).clone() : request;

        if (typeof (cloned as any).json === "function" && String(contentType).includes("application/json")) {
            try {
                return await (cloned as any).json();
            } catch {
                try {
                    return await (cloned as any).text();
                } catch {
                    return undefined;
                }
            }
        }

        if (typeof (cloned as any).text === "function") {
            try {
                return await (cloned as any).text();
            } catch {
                return undefined;
            }
        }

        // Node.js IncomingMessage fallback with size cap
        if (typeof (request as any)?.on === "function") {
            return await new Promise<string | undefined>((resolve) => {
                try {
                    const request_: any = request as any;

                    let data = "";
                    let truncated = false;

                    if (typeof request_.setEncoding === "function") {
                        request_.setEncoding("utf8");
                    }

                    const onData = (chunk: any) => {
                        try {
                            if (truncated) {
                                return;
                            }

                            const chunkString = typeof chunk === "string" ? chunk : String(chunk);

                            if (data.length + chunkString.length > capBytes) {
                                const remaining = Math.max(0, capBytes - data.length);

                                data += chunkString.slice(0, remaining);
                                truncated = true;
                                cleanup();
                                resolve(`${data}\n… [truncated]`);

                                return;
                            }

                            data += chunkString;
                        } catch {}
                    };

                    const onEnd = () => {
                        cleanup();
                        resolve(data || undefined);
                    };

                    const onError = () => {
                        cleanup();
                        resolve(undefined);
                    };

                    const cleanup = () => {
                        try {
                            request_.off?.("data", onData);
                            request_.off?.("end", onEnd);
                            request_.off?.("error", onError);
                        } catch {}
                    };

                    request_.on("data", onData);
                    request_.on("end", onEnd);
                    request_.on("error", onError);
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

export type ContextContentOptions = {
    context?: Record<string, unknown>;
    headerAllowlist?: string[];
    headerDenylist?: string[];
    maskValue?: string; // replacement for sensitive values
    previewBytes?: number; // size of the pretty preview
    totalCapBytes?: number; // hard cap for showing a full copy button
};

export const createRequestContextPage = async (request: Request, options: ContextContentOptions): Promise<ContentPage | undefined> => {
    const uniqueId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    const { headerAllowlist, headerDenylist, maskValue = "[masked]" } = options || {};
    const filteredHeaders = filterHeaders(request.headers, headerAllowlist, headerDenylist, maskValue);

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

    const cookiesRecord: Record<string, string | string[]> | undefined = parseCookieString(
        ((request.headers as any)?.get && (request.headers as any).get("cookie"))
        || (Array.isArray((request as any)?.headers?.cookie) ? (request as any).headers.cookie[0] : (request as any)?.headers?.cookie),
    );

    const previewBytes = Math.max(0, Number(options?.previewBytes ?? 64_000));
    const requestBody: unknown = await readRequestBody(request, previewBytes);

    const buildCurl = (): string => {
        const method = String(request?.method || "GET").toUpperCase();
        const url = String(request?.url || "");
        const headerLines: string[] = [];
        const headersForCurl: Record<string, string> = {};

        if (filteredHeaders) {
            for (const [k, v] of Object.entries(filteredHeaders)) {
                const value = toSingle(v);

                if (value !== undefined)
                    headersForCurl[k] = value;
            }
        }

        const cookieHeader = buildCookieHeader(cookiesRecord);

        if (cookieHeader && !headersForCurl["cookie"]) {
            headersForCurl["Cookie"] = cookieHeader;
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
            parts.push("\\");
            parts.push(`  ${headerLines.join(" \\\n")}`);
        }

        if (dataFlag) {
            parts.push("\\", `  ${dataFlag}`);
        }

        parts.push("\\");
        parts.push(`  ${shellQuote(url)}`);

        return parts.join(" ");
    };

    const curl = buildCurl();
    const curlHtmlRaw = await (
        await getHighlighter()
    ).codeToHtml(curl, {
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
            return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--flare-text-muted)]">(empty)</div>`;
        }

        const rows = Object.entries(records)
            .map(([k, v]) => {
                const value = Array.isArray(v) ? v.join(", ") : v;

                return `<div class="grid grid-cols-[200px_1fr] gap-3 items-start py-2 border-b border-[var(--flare-border)]">
  <div class="text-[11px] uppercase tracking-wide text-[var(--flare-text-muted)]">${escapeHtml(k)}</div>
  <div class="text-sm break-words whitespace-pre-wrap text-[var(--flare-text)]">${escapeHtml(String(value))}</div>
</div>`;
            })
            .join("");

        return `<div class="px-4 pb-4">${rows}</div>`;
    };

    const renderValue = (value: unknown, depth: number = 0): string => {
        if (value === null) {
            return "<span class=\"italic text-[var(--flare-text-muted)]\">null</span>";
        }

        if (value === undefined) {
            return "<span class=\"italic text-[var(--flare-text-muted)]\">undefined</span>";
        }

        if (typeof value === "string") {
            return `<span class="text-[var(--flare-red-orange)]">"${escapeHtml(value)}"</span>`;
        }

        if (typeof value === "number") {
            return `<span class="text-[var(--flare-red-orange)]">${value}</span>`;
        }

        if (typeof value === "boolean") {
            return `<span class="text-[var(--flare-red-orange)]">${value}</span>`;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                return "<span class=\"italic text-[var(--flare-text-muted)]\">(empty array)</span>";
            }

            const maxDepth = 3;

            if (depth >= maxDepth) {
                return `<span class="italic text-[var(--flare-text-muted)]">[Array with ${value.length} items]</span>`;
            }

            const items = value
                .slice(0, 10)
                .map((item, index) => {
                    const itemHtml = renderValue(item, depth + 1);

                    return `
            <div class="ml-4 pl-3 py-1 border-l-2 border-[var(--flare-border)]">
              <span class="text-xs text-[var(--flare-text-muted)]">[${index}]:</span> ${itemHtml}
            </div>`;
                })
                .join("");
            const remaining
                = value.length > 10 ? `<div class="ml-4 text-sm italic text-[var(--flare-text-muted)]">... and ${value.length - 10} more items</div>` : "";

            return `<div class="space-y-1">${items}${remaining}</div>`;
        }

        if (typeof value === "object" && value !== null) {
            if (Object.keys(value as object).length === 0) {
                return "<span class=\"italic text-[var(--flare-text-muted)]\">(empty object)</span>";
            }

            const maxDepth = 3;

            if (depth >= maxDepth) {
                return `<span class="italic text-[var(--flare-text-muted)]">{Object with ${Object.keys(value as object).length} keys}</span>`;
            }

            const entries = Object.entries(value as object)
                .slice(0, 10)
                .map(([key, value_]) => {
                    const valueHtml = renderValue(value_, depth + 1);

                    return `
            <div class="ml-4 pl-3 py-1 border-l-2 border-[var(--flare-border)]">
              <span class="font-medium text-[var(--flare-text)]">${escapeHtml(key)}:</span> ${valueHtml}
            </div>`;
                })
                .join("");
            const remaining
                = Object.keys(value as object).length > 10
                    ? `<div class="ml-4 italic text-[var(--flare-text-muted)]">... and ${Object.keys(value as object).length - 10} more keys</div>`
                    : "";

            return `<div class="space-y-1">${entries}${remaining}</div>`;
        }

        return `<span class="text-[var(--flare-text)]">${escapeHtml(String(value))}</span>`;
    };

    const renderObjectTable = (object: Record<string, unknown> | undefined): string => {
        if (!object || Object.keys(object).length === 0) {
            return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--flare-text-muted)]">(empty)</div>`;
        }

        const rows = Object.entries(object)
            .map(([k, v]) => {
                const displayValue = renderValue(v);

                return `<div class="grid grid-cols-[200px_1fr] gap-3 items-start py-2 border-b border-[var(--flare-border)]">
  <div class="text-[11px] uppercase tracking-wide text-[var(--flare-text-muted)]">${escapeHtml(k)}</div>
  <div class="text-sm break-words text-[var(--flare-text)]">${displayValue}</div>
</div>`;
            })
            .join("");

        return `<div class="px-4 pb-4">${rows}</div>`;
    };

    const renderBodyContent = (body: unknown): string => {
        if (body === undefined || body === null) {
            return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--flare-text-muted)]">(no body)</div>`;
        }

        if (typeof body === "string") {
            if (body.trim() === "") {
                return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--flare-text-muted)]">(empty string)</div>`;
            }

            return `<div class="px-4 pb-4">
  <div class="text-sm break-words whitespace-pre-wrap font-mono p-3 rounded border border-[var(--flare-border)] bg-[var(--flare-surface-muted)] text-[var(--flare-text)]">${escapeHtml(body)}</div>
</div>`;
        }

        if (typeof body === "object") {
            if (Array.isArray(body)) {
                if (body.length === 0) {
                    return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--flare-text-muted)]">(empty array)</div>`;
                }

                return `<div class="px-4 pb-4">
  <div class="text-sm break-words p-3 rounded border border-[var(--flare-border)] bg-[var(--flare-surface-muted)] text-[var(--flare-text)]">${renderValue(body)}</div>
</div>`;
            }

            if (Object.keys(body as object).length === 0) {
                return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--flare-text-muted)]">(empty object)</div>`;
            }

            return `<div class="px-4 pb-4">
  <div class="text-sm break-words p-3 rounded border border-[var(--flare-border)] bg-[var(--flare-surface-muted)] text-[var(--flare-text)]">${renderValue(body)}</div>
</div>`;
        }

        return `<div class="px-4 pb-4">
  <div class="text-sm break-words whitespace-pre-wrap font-mono p-3 rounded border border-[var(--flare-border)] bg-[var(--flare-surface-muted)] text-[var(--flare-text)]">${escapeHtml(String(body))}</div>
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
      <div class="text-[11px] uppercase tracking-wide mb-2 text-[var(--flare-text-muted)]">${title}</div>
      <ul class="space-y-1 text-sm">
        <li>
          <a href="#${sectionId}" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--flare-text)] hover:bg-[var(--flare-surface-muted)] hs-scrollspy-active:bg-[var(--flare-surface-muted)] hs-scrollspy-active:font-semibold">
            <span class="dui size-3" style="-webkit-mask-image:url('${fileTextIcon}'); mask-image:url('${fileTextIcon}')"></span>
            <span>${title}</span>
          </a>
        </li>
      </ul>
    </div>`;
                contentSections += `
  <input type="hidden" id="clipboard-${sectionId}-${uniqueId}" value="${attributeEscape(JSON.stringify(value))}">
  <section id="${sectionId}" class="mb-4 rounded-[var(--flare-radius-lg)] shadow-[var(--flare-elevation-2)] overflow-hidden bg-[var(--flare-surface)] border border-[var(--flare-border)]">
    <div class="px-4 py-3 flex items-center gap-2 bg-[var(--flare-surface-muted)] border-b border-[var(--flare-border)]">
      <h3 class="text-sm font-semibold text-[var(--flare-text)]">${title}</h3>
      <div class="grow"></div>
      <a href="#${sectionId}" class="text-xs text-[var(--flare-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ label: "Copy JSON", targetId: `clipboard-${sectionId}-${uniqueId}` })}
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
  <nav aria-label="Context sections" class="p-3 rounded-[var(--flare-radius-md)] shadow-[var(--flare-elevation-1)] space-y-4 overflow-auto bg-[var(--flare-surface)] border border-[var(--flare-border)] max-h-[calc(100dvh-2rem)]">
    <div>
      <div class="text-[11px] uppercase tracking-wide mb-2 text-[var(--flare-text-muted)]">Request</div>
      <ul class="space-y-1 text-sm">
        <li>
          <a href="#context-request" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--flare-text)] hover:bg-[var(--flare-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${globeIcon}'); mask-image:url('${globeIcon}')"></span>
            <span>Overview</span>
          </a>
        </li>
        <li>
          <a href="#context-headers" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--flare-text)] hover:bg-[var(--flare-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${fileTextIcon}'); mask-image:url('${fileTextIcon}')"></span>
            <span>Headers</span>
          </a>
        </li>
        <li>
          <a href="#context-body" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--flare-text)] hover:bg-[var(--flare-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${bracesIcon}'); mask-image:url('${bracesIcon}')"></span>
            <span>Body</span>
          </a>
        </li>
        <li>
          <a href="#context-session" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--flare-text)] hover:bg-[var(--flare-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${userIcon}'); mask-image:url('${userIcon}')"></span>
            <span>Session</span>
          </a>
        </li>
        <li>
          <a href="#context-cookies" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--flare-text)] hover:bg-[var(--flare-surface-muted)]">
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
  <section id="context-request" class="mb-4 rounded-[var(--flare-radius-lg)] shadow-[var(--flare-elevation-2)] overflow-hidden bg-[var(--flare-surface)] border border-[var(--flare-border)]">
    <div class="px-4 py-4 flex items-center gap-3 min-w-0 bg-[var(--flare-surface-muted)] border-b border-[var(--flare-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${globeIcon}'); mask-image:url('${globeIcon}')"></span>
      <h2 class="text-sm font-semibold text-[var(--flare-text)]">Request</h2>
      <a class="text-sm truncate text-[var(--flare-red-orange)]" href="${sanitizeUrlAttribute(request.url || "#")}">${escapeHtml(request.url || "")}</a>
      <span class="inline-block text-[10px] px-2 py-0.5 rounded-full bg-[var(--flare-chip-bg)] text-[var(--flare-chip-text)]">${escapeHtml(String(request.method || "GET"))}</span>
      <div class="grow"></div>
      ${copyButton({ label: "Copy cURL", targetId: `clipboard-curl-${uniqueId}` })}
    </div>
    <div class="px-4 pb-4 overflow-auto mt-2">${curlHtml}</div>
  </section>

  <input type="hidden" id="clipboard-headers-${uniqueId}" value="${attributeEscape(JSON.stringify(filteredHeaders || {}))}">
  <section id="context-headers" class="mb-4 rounded-[var(--flare-radius-lg)] shadow-[var(--flare-elevation-2)] overflow-hidden bg-[var(--flare-surface)] border border-[var(--flare-border)]">
    <div class="px-4 py-3 flex items-center gap-2 bg-[var(--flare-surface-muted)] border-b border-[var(--flare-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${fileTextIcon}'); mask-image:url('${fileTextIcon}')"></span>
      <h3 class="text-sm font-semibold text-[var(--flare-text)]">Headers</h3>
      <div class="grow"></div>
      <a href="#context-headers" class="text-xs text-[var(--flare-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ label: "Copy JSON", targetId: `clipboard-headers-${uniqueId}` })}
    </div>
    <div class="max-w-full overflow-auto mt-2">${renderKeyValueTable(filteredHeaders)}</div>
  </section>

  <input type="hidden" id="clipboard-body-${uniqueId}" value="${attributeEscape(safeJsonStringify(requestBody ?? {}))}">
  <section id="context-body" class="mb-4 rounded-[var(--flare-radius-lg)] shadow-[var(--flare-elevation-2)] overflow-hidden bg-[var(--flare-surface)] border border-[var(--flare-border)]">
    <div class="px-4 py-3 flex items-center gap-2 bg-[var(--flare-surface-muted)] border-b border-[var(--flare-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${bracesIcon}'); mask-image:url('${bracesIcon}')"></span>
      <h3 class="text-sm font-semibold text-[var(--flare-text)]">Body</h3>
      <div class="grow"></div>
      <a href="#context-body" class="text-xs text-[var(--flare-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ label: "Copy JSON", targetId: `clipboard-body-${uniqueId}` })}
    </div>
    <div class="max-w-full overflow-auto mt-2">${renderBodyContent(requestBody)}</div>
  </section>

  <input type="hidden" id="clipboard-session-${uniqueId}" value="${attributeEscape(JSON.stringify((request as any)?.session ?? {}))}">
  <section id="context-session" class="mb-4 rounded-[var(--flare-radius-lg)] shadow-[var(--flare-elevation-2)] overflow-hidden bg-[var(--flare-surface)] border border-[var(--flare-border)]">
    <div class="px-4 py-3 flex items-center gap-2 bg-[var(--flare-surface-muted)] border-b border-[var(--flare-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${userIcon}'); mask-image:url('${userIcon}')"></span>
      <h3 class="text-sm font-semibold text-[var(--flare-text)]">Session</h3>
      <div class="grow"></div>
      <a href="#context-session" class="text-xs text-[var(--flare-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ label: "Copy JSON", targetId: `clipboard-session-${uniqueId}` })}
    </div>
            <div class="max-w-full overflow-auto mt-2">${renderObjectTable((request as any)?.session as Record<string, unknown>)}</div>
  </section>

  <input type="hidden" id="clipboard-cookies-${uniqueId}" value="${attributeEscape(JSON.stringify(cookiesRecord || {}))}">
  <section id="context-cookies" class="mb-4 rounded-[var(--flare-radius-lg)] shadow-[var(--flare-elevation-2)] overflow-hidden bg-[var(--flare-surface)] border border-[var(--flare-border)]">
    <div class="px-4 py-3 flex items-center gap-2 bg-[var(--flare-surface-muted)] border-b border-[var(--flare-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${cookieIcon}'); mask-image:url('${cookieIcon}')"></span>
      <h3 class="text-sm font-semibold text-[var(--flare-text)]">Cookies</h3>
      <div class="grow"></div>
      <a href="#context-cookies" class="text-xs text-[var(--flare-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ label: "Copy JSON", targetId: `clipboard-cookies-${uniqueId}` })}
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
