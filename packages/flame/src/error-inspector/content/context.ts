import type { ContentPage, TemplateOptions, RequestContext } from "../types";
import getHighlighter from "../util/get-highlighter";
import copyButton from "../components/copy-button";
// eslint-disable-next-line import/no-extraneous-dependencies
import globeIcon from "lucide-static/icons/globe.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import bracesIcon from "lucide-static/icons/braces.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import fileTextIcon from "lucide-static/icons/file-text.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import cookieIcon from "lucide-static/icons/cookie.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import userIcon from "lucide-static/icons/user.svg?raw";

// Utility function to properly encode SVG content for CSS mask-image
const svgToDataUrl = (svgContent: string): string => {
    const cleanSvg = svgContent
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvg)}`;
};

const SENSITIVE_HEADER_PATTERNS = [/authorization/i, /cookie/i, /set-cookie/i, /x-api-key/i, /api-key/i, /x-auth/i, /token/i, /secret/i];

const isSensitiveHeader = (name: string, denylist: string[] | undefined): boolean => {
    if (denylist && denylist.some((d) => d.toLowerCase() === name.toLowerCase())) {
        return true;
    }
    return SENSITIVE_HEADER_PATTERNS.some((re) => re.test(name));
};

const filterHeaders = (
    headers: Record<string, string | string[]> | undefined,
    allowlist?: string[],
    denylist?: string[],
    maskValue = "[masked]",
): Record<string, string | string[]> | undefined => {
    if (!headers) {
        return undefined;
    }

    const out: Record<string, string | string[]> = {};

    for (const [key, value] of Object.entries(headers)) {
        const lower = key.toLowerCase();

        if (allowlist && allowlist.length > 0 && !allowlist.some((a) => a.toLowerCase() === lower)) {
            continue;
        }

        const masked = isSensitiveHeader(lower, denylist) ? maskValue : undefined;

        if (Array.isArray(value)) {
            out[key] = masked ? value.map(() => masked) : value;
        } else {
            out[key] = masked ? masked : value;
        }
    }

    return out;
};

const safeJsonStringify = (value: unknown): string => {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

export default async function buildContextContent(request: RequestContext, options: TemplateOptions): Promise<ContentPage | undefined> {
    const uniqueId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
    const { headerAllowlist, headerDenylist, maskValue = "[masked]" } = options.requestPanel || {};
    const filteredHeaders = filterHeaders(request.headers, headerAllowlist, headerDenylist, maskValue);

    const toSingle = (value: string | string[] | undefined): string | undefined => {
        if (value === undefined) {
            return undefined;
        }

        return Array.isArray(value) ? value.join(", ") : value;
    };

    const shellQuote = (input: string): string => `'${String(input).replace(/'/g, "'\\''")}'`;

    const buildCookieHeader = (cookies: Record<string, string | string[]> | undefined): string | undefined => {
        if (!cookies) {
            return undefined;
        }

        const parts: string[] = [];
        
        for (const [name, v] of Object.entries(cookies)) {
            const val = toSingle(v) ?? "";
            parts.push(`${name}=${val}`);
        }
        
        return parts.length ? parts.join("; ") : undefined;
    };

    const buildCurl = (): string => {
        const method = String(request?.method || "GET").toUpperCase();
        const url = String(request?.url || "");
        const headerLines: string[] = [];
        const headersForCurl: Record<string, string> = {};

        if (filteredHeaders) {
            for (const [k, v] of Object.entries(filteredHeaders)) {
                const value = toSingle(v);
                if (value !== undefined) headersForCurl[k] = value;
            }
        }

        const cookieHeader = buildCookieHeader(request?.cookies);
        if (cookieHeader && !headersForCurl["cookie"]) {
            headersForCurl["Cookie"] = cookieHeader;
        }

        for (const [k, v] of Object.entries(headersForCurl)) {
            headerLines.push(`-H ${shellQuote(`${k}: ${v}`)}`);
        }

        let dataFlag = "";
        if (request && request.body !== undefined && request.body !== null && method !== "GET") {
            const bodyString = typeof request.body === "string" ? request.body : safeJsonStringify(request.body);
            dataFlag = `--data ${shellQuote(bodyString)}`;
        }

        const parts = ["curl", "-X", method];
        if (headerLines.length > 0) {
            parts.push("\\");
            parts.push("  " + headerLines.join(" \\\n"));
        }
        if (dataFlag) {
            parts.push("\\");
            parts.push("  " + dataFlag);
        }
        parts.push("\\");
        parts.push("  " + shellQuote(url));
        return parts.join(" ");
    };

    const curl = buildCurl();
    const curlHtml = await (await getHighlighter()).codeToHtml(curl, { lang: "bash", themes: {
        light: "github-light",
        dark: "github-dark-default",
    }, });

    const attrEscape = (value: unknown): string => String(value ?? "").replaceAll("'", "&apos;");
    const escapeHtml = (str: string): string =>
        String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

    const renderKeyValueTable = (records: Record<string, string | string[]> | undefined): string => {
        if (!records || Object.keys(records).length === 0) {
            return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--flame-text-muted)]">(empty)</div>`;
        }
        const rows = Object.entries(records)
            .map(([k, v]) => {
                const value = Array.isArray(v) ? v.join(", ") : v;
                return `<div class="grid grid-cols-[200px_1fr] gap-3 items-start py-2 border-b border-[var(--flame-border)]">
  <div class="text-[11px] uppercase tracking-wide text-[var(--flame-text-muted)]">${escapeHtml(k)}</div>
  <div class="text-sm break-words whitespace-pre-wrap text-[var(--flame-text)]">${escapeHtml(String(value))}</div>
</div>`;
            })
            .join("");
        return `<div class="px-4 pb-4">${rows}</div>`;
    };

    const renderValue = (value: unknown, depth: number = 0): string => {
        if (value === null) {
            return '<span class="italic text-[var(--flame-text-muted)]">null</span>';
        }
        if (value === undefined) {
            return '<span class="italic text-[var(--flame-text-muted)]">undefined</span>';
        }
        if (typeof value === "string") {
            return `<span class="text-[var(--flame-red-orange)]">"${escapeHtml(value)}"</span>`;
        }
        if (typeof value === "number") {
            return `<span class="text-[var(--flame-red-orange)]">${value}</span>`;
        }
        if (typeof value === "boolean") {
            return `<span class="text-[var(--flame-red-orange)]">${value}</span>`;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '<span class="italic text-[var(--flame-text-muted)]">(empty array)</span>';
            }
            const maxDepth = 3;
            if (depth >= maxDepth) {
                return `<span class="italic text-[var(--flame-text-muted)]">[Array with ${value.length} items]</span>`;
            }
            const items = value
                .slice(0, 10)
                .map((item, index) => {
                    const itemHtml = renderValue(item, depth + 1);
                    return `
            <div class="ml-4 pl-3 py-1 border-l-2 border-[var(--flame-border)]">
              <span class="text-xs text-[var(--flame-text-muted)]">[${index}]:</span> ${itemHtml}
            </div>`;
                })
                .join("");
            const remaining =
                value.length > 10 ? `<div class="ml-4 text-sm italic text-[var(--flame-text-muted)]">... and ${value.length - 10} more items</div>` : "";
            return `<div class="space-y-1">${items}${remaining}</div>`;
        }

        if (typeof value === "object" && value !== null) {
            if (Object.keys(value as object).length === 0) {
                return '<span class="italic text-[var(--flame-text-muted)]">(empty object)</span>';
            }
            const maxDepth = 3;
            if (depth >= maxDepth) {
                return `<span class="italic text-[var(--flame-text-muted)]">{Object with ${Object.keys(value as object).length} keys}</span>`;
            }
            const entries = Object.entries(value as object)
                .slice(0, 10)
                .map(([key, val]) => {
                    const valHtml = renderValue(val, depth + 1);
                    return `
            <div class="ml-4 pl-3 py-1 border-l-2 border-[var(--flame-border)]">
              <span class="font-medium text-[var(--flame-text)]">${escapeHtml(key)}:</span> ${valHtml}
            </div>`;
                })
                .join("");
            const remaining =
                Object.keys(value as object).length > 10
                    ? `<div class="ml-4 italic text-[var(--flame-text-muted)]">... and ${Object.keys(value as object).length - 10} more keys</div>`
                    : "";
            return `<div class="space-y-1">${entries}${remaining}</div>`;
        }

        return `<span class="text-[var(--flame-text)]">${escapeHtml(String(value))}</span>`;
    };

    const renderObjectTable = (obj: Record<string, unknown> | undefined): string => {
        if (!obj || Object.keys(obj).length === 0) {
            return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--flame-text-muted)]">(empty)</div>`;
        }
        const rows = Object.entries(obj)
            .map(([k, v]) => {
                const displayValue = renderValue(v);
                return `<div class="grid grid-cols-[200px_1fr] gap-3 items-start py-2 border-b border-[var(--flame-border)]">
  <div class="text-[11px] uppercase tracking-wide text-[var(--flame-text-muted)]">${escapeHtml(k)}</div>
  <div class="text-sm break-words text-[var(--flame-text)]">${displayValue}</div>
</div>`;
            })
            .join("");
        return `<div class="px-4 pb-4">${rows}</div>`;
    };

    const renderBodyContent = (body: unknown): string => {
        if (body === undefined || body === null) {
            return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--flame-text-muted)]">(no body)</div>`;
        }
        if (typeof body === "string") {
            if (body.trim() === "") {
                return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--flame-text-muted)]">(empty string)</div>`;
            }
            return `<div class="px-4 pb-4">
  <div class="text-sm break-words whitespace-pre-wrap font-mono p-3 rounded border border-[var(--flame-border)] bg-[var(--flame-surface-muted)] text-[var(--flame-text)]">${escapeHtml(body)}</div>
</div>`;
        }
        if (typeof body === "object") {
            if (Array.isArray(body)) {
                if (body.length === 0) {
                    return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--flame-text-muted)]">(empty array)</div>`;
                }
                return `<div class="px-4 pb-4">
  <div class="text-sm break-words p-3 rounded border border-[var(--flame-border)] bg-[var(--flame-surface-muted)] text-[var(--flame-text)]">${renderValue(body)}</div>
</div>`;
            }
            if (Object.keys(body as object).length === 0) {
                return `<div class="px-4 pb-4 pt-2 text-xs text-[var(--flame-text-muted)]">(empty object)</div>`;
            }
            return `<div class="px-4 pb-4">
  <div class="text-sm break-words p-3 rounded border border-[var(--flame-border)] bg-[var(--flame-surface-muted)] text-[var(--flame-text)]">${renderValue(body)}</div>
</div>`;
        }
        return `<div class="px-4 pb-4">
  <div class="text-sm break-words whitespace-pre-wrap font-mono p-3 rounded border border-[var(--flame-border)] bg-[var(--flame-surface-muted)] text-[var(--flame-text)]">${escapeHtml(String(body))}</div>
</div>`;
    };

    const generateContextSections = (context: Record<string, unknown> | undefined): { sidebar: string; content: string } => {
        if (!context) {
            return { sidebar: "", content: "" };
        }
        const excludeKeys = ["request"];
        const contextKeys = Object.keys(context).filter((key) => !excludeKeys.includes(key));
        if (contextKeys.length === 0) {
            return { sidebar: "", content: "" };
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
      <div class="text-[11px] uppercase tracking-wide mb-2 text-[var(--flame-text-muted)]">${title}</div>
      <ul class="space-y-1 text-sm">
        <li>
          <a href="#${sectionId}" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--flame-text)] hover:bg-[var(--flame-surface-muted)] hs-scrollspy-active:bg-[var(--flame-surface-muted)] hs-scrollspy-active:font-semibold">
            <span class="dui size-3" style="-webkit-mask-image:url('${svgToDataUrl(fileTextIcon)}'); mask-image:url('${svgToDataUrl(fileTextIcon)}')"></span>
            <span>${title}</span>
          </a>
        </li>
      </ul>
    </div>`;
                contentSections += `
  <input type="hidden" id="clipboard-${sectionId}-${uniqueId}" value="${attrEscape(JSON.stringify(value))}">
  <section id="${sectionId}" class="mb-4 rounded-[var(--flame-radius-lg)] shadow-[var(--flame-elevation-2)] overflow-hidden bg-[var(--flame-surface)] border border-[var(--flame-border)]">
    <div class="px-4 py-3 flex items-center gap-2 bg-[var(--flame-surface-muted)] border-b border-[var(--flame-border)]">
      <h3 class="text-sm font-semibold text-[var(--flame-text)]">${title}</h3>
      <div class="grow"></div>
      <a href="#${sectionId}" class="text-xs text-[var(--flame-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ targetId: `clipboard-${sectionId}-${uniqueId}`, label: "Copy JSON" })}
    </div>
    <div class="max-w-full overflow-auto mt-2">${renderObjectTable(value as Record<string, unknown>)}</div>
  </section>`;
            }
        });
        return { sidebar: sidebarSections, content: contentSections };
    };

    const contextSections = generateContextSections(options.context);

    const sidebar = `
<aside class="shrink-0 w-64 sticky top-4 self-start">
  <nav aria-label="Context sections" class="p-3 rounded-[var(--flame-radius-md)] shadow-[var(--flame-elevation-1)] space-y-4 overflow-auto bg-[var(--flame-surface)] border border-[var(--flame-border)] max-h-[calc(100dvh-2rem)]">
    <div>
      <div class="text-[11px] uppercase tracking-wide mb-2 text-[var(--flame-text-muted)]">Request</div>
      <ul class="space-y-1 text-sm">
        <li>
          <a href="#context-request" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--flame-text)] hover:bg-[var(--flame-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${svgToDataUrl(globeIcon)}'); mask-image:url('${svgToDataUrl(globeIcon)}')"></span>
            <span>Overview</span>
          </a>
        </li>
        <li>
          <a href="#context-headers" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--flame-text)] hover:bg-[var(--flame-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${svgToDataUrl(fileTextIcon)}'); mask-image:url('${svgToDataUrl(fileTextIcon)}')"></span>
            <span>Headers</span>
          </a>
        </li>
        <li>
          <a href="#context-body" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--flame-text)] hover:bg-[var(--flame-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${svgToDataUrl(bracesIcon)}'); mask-image:url('${svgToDataUrl(bracesIcon)}')"></span>
            <span>Body</span>
          </a>
        </li>
        <li>
          <a href="#context-session" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--flame-text)] hover:bg-[var(--flame-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${svgToDataUrl(userIcon)}'); mask-image:url('${svgToDataUrl(userIcon)}')"></span>
            <span>Session</span>
          </a>
        </li>
        <li>
          <a href="#context-cookies" class="flex items-center gap-2 px-2 py-1 rounded text-[var(--flame-text)] hover:bg-[var(--flame-surface-muted)]">
            <span class="dui size-3" style="-webkit-mask-image:url('${svgToDataUrl(cookieIcon)}'); mask-image:url('${svgToDataUrl(cookieIcon)}')"></span>
            <span>Cookies</span>
          </a>
        </li>
      </ul>
    </div>${contextSections.sidebar}
  </nav>
</aside>`;

    const content = `
<div class="grow min-w-0">
  <input type="hidden" id="clipboard-curl-${uniqueId}" value="${attrEscape(curl)}">
  <section id="context-request" class="mb-4 rounded-[var(--flame-radius-lg)] shadow-[var(--flame-elevation-2)] overflow-hidden bg-[var(--flame-surface)] border border-[var(--flame-border)]">
    <div class="px-4 py-4 flex items-center gap-3 min-w-0 bg-[var(--flame-surface-muted)] border-b border-[var(--flame-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${svgToDataUrl(globeIcon)}'); mask-image:url('${svgToDataUrl(globeIcon)}')"></span>
      <h2 class="text-sm font-semibold text-[var(--flame-text)]">Request</h2>
      <a class="text-sm truncate text-[var(--flame-red-orange)]" href="${escapeHtml(request.url || "#")}">${escapeHtml(request.url || "")}</a>
      <span class="inline-block text-[10px] px-2 py-0.5 rounded-full bg-[var(--flame-chip-bg)] text-[var(--flame-chip-text)]">${escapeHtml(String(request.method || "GET"))}</span>
      <div class="grow"></div>
      ${copyButton({ targetId: `clipboard-curl-${uniqueId}`, label: "Copy cURL" })}
    </div>
    <div class="px-4 pb-4 overflow-auto mt-2">${curlHtml}</div>
  </section>

  <input type="hidden" id="clipboard-headers-${uniqueId}" value="${attrEscape(JSON.stringify(filteredHeaders || {}))}">
  <section id="context-headers" class="mb-4 rounded-[var(--flame-radius-lg)] shadow-[var(--flame-elevation-2)] overflow-hidden bg-[var(--flame-surface)] border border-[var(--flame-border)]">
    <div class="px-4 py-3 flex items-center gap-2 bg-[var(--flame-surface-muted)] border-b border-[var(--flame-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${svgToDataUrl(fileTextIcon)}'); mask-image:url('${svgToDataUrl(fileTextIcon)}')"></span>
      <h3 class="text-sm font-semibold text-[var(--flame-text)]">Headers</h3>
      <div class="grow"></div>
      <a href="#context-headers" class="text-xs text-[var(--flame-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ targetId: `clipboard-headers-${uniqueId}`, label: "Copy JSON" })}
    </div>
    <div class="max-w-full overflow-auto mt-2">${renderKeyValueTable(filteredHeaders)}</div>
  </section>

  <input type="hidden" id="clipboard-body-${uniqueId}" value="${attrEscape(JSON.stringify(request?.body || {}))}">
  <section id="context-body" class="mb-4 rounded-[var(--flame-radius-lg)] shadow-[var(--flame-elevation-2)] overflow-hidden bg-[var(--flame-surface)] border border-[var(--flame-border)]">
    <div class="px-4 py-3 flex items-center gap-2 bg-[var(--flame-surface-muted)] border-b border-[var(--flame-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${svgToDataUrl(bracesIcon)}'); mask-image:url('${svgToDataUrl(bracesIcon)}')"></span>
      <h3 class="text-sm font-semibold text-[var(--flame-text)]">Body</h3>
      <div class="grow"></div>
      <a href="#context-body" class="text-xs text-[var(--flame-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ targetId: `clipboard-body-${uniqueId}`, label: "Copy JSON" })}
    </div>
    <div class="max-w-full overflow-auto mt-2">${renderBodyContent(request?.body)}</div>
  </section>

  <input type="hidden" id="clipboard-session-${uniqueId}" value="${attrEscape(JSON.stringify(request?.session ?? {}))}">
  <section id="context-session" class="mb-4 rounded-[var(--flame-radius-lg)] shadow-[var(--flame-elevation-2)] overflow-hidden bg-[var(--flame-surface)] border border-[var(--flame-border)]">
    <div class="px-4 py-3 flex items-center gap-2 bg-[var(--flame-surface-muted)] border-b border-[var(--flame-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${svgToDataUrl(userIcon)}'); mask-image:url('${svgToDataUrl(userIcon)}')"></span>
      <h3 class="text-sm font-semibold text-[var(--flame-text)]">Session</h3>
      <div class="grow"></div>
      <a href="#context-session" class="text-xs text-[var(--flame-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ targetId: `clipboard-session-${uniqueId}`, label: "Copy JSON" })}
    </div>
            <div class="max-w-full overflow-auto mt-2">${renderObjectTable(request?.session as Record<string, unknown>)}</div>
  </section>

  <input type="hidden" id="clipboard-cookies-${uniqueId}" value="${attrEscape(JSON.stringify(request?.cookies || {}))}">
  <section id="context-cookies" class="mb-4 rounded-[var(--flame-radius-lg)] shadow-[var(--flame-elevation-2)] overflow-hidden bg-[var(--flame-surface)] border border-[var(--flame-border)]">
    <div class="px-4 py-3 flex items-center gap-2 bg-[var(--flame-surface-muted)] border-b border-[var(--flame-border)]">
      <span class="dui size-4" style="-webkit-mask-image:url('${svgToDataUrl(cookieIcon)}'); mask-image:url('${svgToDataUrl(cookieIcon)}')"></span>
      <h3 class="text-sm font-semibold text-[var(--flame-text)]">Cookies</h3>
      <div class="grow"></div>
      <a href="#context-cookies" class="text-xs text-[var(--flame-text-muted)]" aria-label="Anchor">#</a>
      ${copyButton({ targetId: `clipboard-cookies-${uniqueId}`, label: "Copy JSON" })}
    </div>
    <div class="max-w-full overflow-auto mt-2">${renderKeyValueTable((request?.cookies || {}) as Record<string, string | string[]>)}
    </div>
  </section>${contextSections.content}
</div>`;

    const html = `
<div class="w-full flex gap-4 relative">
  ${sidebar}
  ${content}
</div>`;

    return { id: "context", name: "Context", code: { html, script: "" } };
}
