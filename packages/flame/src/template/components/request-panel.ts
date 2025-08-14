import type { DisplayerOptions, RequestContext } from "../../types";
import getHighlighter from "../util/getHighlighter";

const SENSITIVE_HEADER_PATTERNS = [/authorization/i, /cookie/i, /set-cookie/i, /x-api-key/i, /api-key/i, /x-auth/i, /token/i, /secret/i];

const isSensitiveHeader = (name: string, denylist: string[] | undefined): boolean => {
    if (denylist && denylist.some((d) => d.toLowerCase() === name.toLowerCase())) return true;
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

const requestPanel = async (request: RequestContext | undefined, options: DisplayerOptions): Promise<{ html: string; script: string }> => {
    if (!request) {
        return { html: "", script: "" };
    }

    const { headerAllowlist, headerDenylist, maskValue = "[masked]" } = options.requestPanel || {};

    const filteredHeaders = filterHeaders(request.headers, headerAllowlist, headerDenylist, maskValue);

    const toSingle = (value: string | string[] | undefined): string | undefined => {
        if (value === undefined) {
            return undefined;
        }

        return Array.isArray(value) ? value.join(", ") : value;
    };

    const shellQuote = (input: string): string => {
        return `'${String(input).replace(/'/g, "'\\''")}'`;
    };

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

        // Build a nicely formatted cURL command
        const parts = ["curl", "-X", method];

        // Add headers with proper line breaks
        if (headerLines.length > 0) {
            parts.push("\\");
            parts.push("  " + headerLines.join(" \\\n  "));
        }

        // Add data flag if present
        if (dataFlag) {
            parts.push("\\");
            parts.push("  " + dataFlag);
        }

        // Add URL
        parts.push("\\");
        parts.push("  " + shellQuote(url));

        return parts.join(" ");
    };

    const curl = buildCurl();
    const curlHtml = await (await getHighlighter()).codeToHtml(curl, { lang: "bash", theme: "nord" });

    const attrEscape = (value: unknown): string => {
        return String(value ?? "").replaceAll("'", "&apos;");
    };

    const escapeHtml = (str: string): string => {
        return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    };

    const renderKeyValueTable = (records: Record<string, string | string[]> | undefined): string => {
        if (!records || Object.keys(records).length === 0) {
            return `<div class="px-4 pb-4 text-xs text-gray-500">(empty)</div>`;
        }
        const rows = Object.entries(records)
            .map(([k, v]) => {
                const value = Array.isArray(v) ? v.join(", ") : v;
                return `<div class="grid grid-cols-[200px_1fr] gap-3 items-start py-2 border-b border-gray-100 dark:border-gray-800">
  <div class="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">${escapeHtml(k)}</div>
  <div class="text-sm break-words whitespace-pre-wrap">${escapeHtml(String(value))}</div>
</div>`;
            })
            .join("");
        return `<div class="px-4 pb-4">${rows}</div>`;
    };

    const renderValue = (value: unknown, depth: number = 0): string => {
        if (value === null) return '<span class="text-gray-500 italic">null</span>';
        if (value === undefined) return '<span class="text-gray-500 italic">undefined</span>';

        if (typeof value === "string") {
            return `<span class="text-green-600 dark:text-green-400">"${escapeHtml(value)}"</span>`;
        }

        if (typeof value === "number") {
            return `<span class="text-blue-600 dark:text-blue-400">${value}</span>`;
        }

        if (typeof value === "boolean") {
            return `<span class="text-purple-600 dark:text-purple-400">${value}</span>`;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) return '<span class="text-gray-500 italic">(empty array)</span>';

            const maxDepth = 3; // Limit nesting depth for performance
            if (depth >= maxDepth) {
                return `<span class="text-gray-500 italic">[Array with ${value.length} items]</span>`;
            }

            const items = value
                .slice(0, 10)
                .map((item, index) => {
                    const itemHtml = renderValue(item, depth + 1);
                    return `
            <div class="ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-3 py-1">
              <span class="text-gray-500 text-xs">[${index}]:</span> ${itemHtml}
            </div>`;
                })
                .join("");

            const remaining = value.length > 10 ? `<div class="ml-4 text-gray-500 text-sm italic">... and ${value.length - 10} more items</div>` : "";

            return `<div class="space-y-1">${items}${remaining}</div>`;
        }

        if (typeof value === "object" && value !== null) {
            if (Object.keys(value as object).length === 0) return '<span class="text-gray-500 italic">(empty object)</span>';

            const maxDepth = 3; // Limit nesting depth for performance
            if (depth >= maxDepth) {
                return `<span class="text-gray-500 italic">{Object with ${Object.keys(value as object).length} keys}</span>`;
            }

            const entries = Object.entries(value as object)
                .slice(0, 10)
                .map(([key, val]) => {
                    const valHtml = renderValue(val, depth + 1);
                    return `
            <div class="ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-3 py-1">
              <span class="text-gray-600 dark:text-gray-400 font-medium">${escapeHtml(key)}:</span> ${valHtml}
            </div>`;
                })
                .join("");

            const remaining =
                Object.keys(value as object).length > 10
                    ? `<div class="ml-4 text-gray-500 text-sm italic">... and ${Object.keys(value as object).length - 10} more keys</div>`
                    : "";

            return `<div class="space-y-1">${entries}${remaining}</div>`;
        }

        return `<span class="text-gray-600 dark:text-gray-400">${escapeHtml(String(value))}</span>`;
    };

    const renderObjectTable = (obj: Record<string, unknown> | undefined): string => {
        if (!obj || Object.keys(obj).length === 0) {
            return `<div class="px-4 pb-4 text-xs text-gray-500">(empty)</div>`;
        }
        const rows = Object.entries(obj)
            .map(([k, v]) => {
                const displayValue = renderValue(v);
                return `<div class="grid grid-cols-[200px_1fr] gap-3 items-start py-2 border-b border-gray-100 dark:border-gray-800">
  <div class="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">${escapeHtml(k)}</div>
  <div class="text-sm break-words">${displayValue}</div>
</div>`;
            })
            .join("");
        return `<div class="px-4 pb-4">${rows}</div>`;
    };

    const renderBodyContent = (body: unknown): string => {
        if (body === undefined || body === null) {
            return `<div class="px-4 pb-4 text-xs text-gray-500">(no body)</div>`;
        }

        if (typeof body === "string") {
            if (body.trim() === "") {
                return `<div class="px-4 pb-4 text-xs text-gray-500">(empty string)</div>`;
            }
            return `<div class="px-4 pb-4">
  <div class="text-sm break-words whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-3 rounded border">${escapeHtml(body)}</div>
</div>`;
        }

        if (typeof body === "object") {
            if (Array.isArray(body)) {
                if (body.length === 0) {
                    return `<div class="px-4 pb-4 text-xs text-gray-500">(empty array)</div>`;
                }
                return `<div class="px-4 pb-4">
  <div class="text-sm break-words bg-gray-50 dark:bg-gray-900 p-3 rounded border">${renderValue(body)}</div>
</div>`;
            }

            if (Object.keys(body as object).length === 0) {
                return `<div class="px-4 pb-4 text-xs text-gray-500">(empty object)</div>`;
            }

            return `<div class="px-4 pb-4">
  <div class="text-sm break-words bg-gray-50 dark:bg-gray-900 p-3 rounded border">${renderValue(body)}</div>
</div>`;
        }

        return `<div class="px-4 pb-4">
  <div class="text-sm break-words whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-3 rounded border">${escapeHtml(String(body))}</div>
</div>`;
    };

    const generateContextSections = (context: Record<string, unknown> | undefined): { sidebar: string; content: string } => {
        if (!context) return { sidebar: "", content: "" };

        const excludeKeys = ["request"]; // Exclude the special request key
        const contextKeys = Object.keys(context).filter((key) => !excludeKeys.includes(key));

        if (contextKeys.length === 0) return { sidebar: "", content: "" };

        let sidebarSections = "";
        let contentSections = "";

        contextKeys.forEach((key) => {
            const value = context[key];
            if (value && typeof value === "object" && (Array.isArray(value) || Object.keys(value as object).length > 0)) {
                const title = key.charAt(0).toUpperCase() + key.slice(1);
                const sectionId = `context-${key}`;

                sidebarSections += `
    <div>
      <div class="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">${title}</div>
      <ul class="space-y-1 text-sm">
        <li><a href="#${sectionId}" class="text-blue-600 hover:underline">${title}</a></li>
      </ul>
    </div>`;

                contentSections += `
  <section id="${sectionId}" class="mb-4 dark:bg-gray-800/50 dark:ring-1 dark:ring-inset dark:ring-white/5 bg-white rounded-lg shadow-md overflow-hidden">
    <div class="px-4 py-3 flex items-center gap-2">
      <h3 class="text-sm font-semibold">${title}</h3>
      <div class="grow"></div>
      <a href="#${sectionId}" class="text-gray-400 hover:text-gray-600 text-xs" aria-label="Anchor">#</a>
      <button type="button" class="copy-btn cursor-pointer px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs" data-clipboard-text="${attrEscape(
          JSON.stringify(value),
      )}" aria-label="Copy JSON">Copy</button>
    </div>
    <div class="max-w-full overflow-auto">${renderObjectTable(value as Record<string, unknown>)}</div>
  </section>`;
            }
        });

        return { sidebar: sidebarSections, content: contentSections };
    };

    const contextSections = generateContextSections(options.context);

    const sidebar = `
<aside class="shrink-0 w-64 relative">
  <nav class="sticky top-4 p-3 dark:bg-gray-800/50 dark:ring-1 dark:ring-inset dark:ring-white/5 bg-white rounded-lg shadow-md space-y-4 overflow-auto">
    <div>
      <div class="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Request</div>
      <ul class="space-y-1 text-sm">
        <li><a href="#context-request" class="text-blue-600 hover:underline">Overview</a></li>
        <li><a href="#context-headers" class="text-blue-600 hover:underline">Headers</a></li>
        <li><a href="#context-body" class="text-blue-600 hover:underline">Body</a></li>
        <li><a href="#context-session" class="text-blue-600 hover:underline">Session</a></li>
        <li><a href="#context-cookies" class="text-blue-600 hover:underline">Cookies</a></li>
      </ul>
    </div>${contextSections.sidebar}
  </nav>
  <div class="mt-3"></div>
</aside>`;

    const content = `
<div class="grow min-w-0">
  <section id="context-request" class="mb-4 dark:bg-gray-800/50 dark:ring-1 dark:ring-inset dark:ring-white/5 bg-white rounded-lg shadow-md overflow-hidden">
    <div class="px-4 py-4 flex items-center gap-3 min-w-0">
      <h2 class="text-sm font-semibold">Request</h2>
      <a class="text-blue-600 hover:underline text-sm truncate" href="${escapeHtml(request.url || "#")}">${escapeHtml(request.url || "")}</a>
      <span class="inline-block text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">${escapeHtml(
          String(request.method || "GET"),
      )}</span>
      <div class="grow"></div>
      <button type="button" class="copy-btn cursor-pointer px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs" data-clipboard-text="${attrEscape(curl)}" aria-label="Copy cURL">Copy cURL</button>
    </div>
    <div class="px-4 pb-4 overflow-auto">${curlHtml}</div>
  </section>

  <section id="context-headers" class="mb-4 dark:bg-gray-800/50 dark:ring-1 dark:ring-inset dark:ring-white/5 bg-white rounded-lg shadow-md overflow-hidden">
    <div class="px-4 py-3 flex items-center gap-2">
      <h3 class="text-sm font-semibold">Headers</h3>
      <div class="grow"></div>
      <a href="#context-headers" class="text-gray-400 hover:text-gray-600 text-xs" aria-label="Anchor">#</a>
      <button type="button" class="copy-btn cursor-pointer px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs" data-clipboard-text="${attrEscape(
          JSON.stringify(filteredHeaders || {}),
      )}" aria-label="Copy JSON">Copy</button>
    </div>
    <div class="max-w-full overflow-auto">${renderKeyValueTable(filteredHeaders)}</div>
  </section>

  <section id="context-body" class="mb-4 dark:bg-gray-800/50 dark:ring-1 dark:ring-inset dark:ring-white/5 bg-white rounded-lg shadow-md overflow-hidden">
    <div class="px-4 py-3 flex items-center gap-2">
      <h3 class="text-sm font-semibold">Body</h3>
      <div class="grow"></div>
      <a href="#context-body" class="text-gray-400 hover:text-gray-600 text-xs" aria-label="Anchor">#</a>
      <button type="button" class="copy-btn cursor-pointer px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs" data-clipboard-text="${attrEscape(
          JSON.stringify(request?.body || {}),
      )}" aria-label="Copy JSON">Copy</button>
    </div>
    <div class="max-w-full overflow-auto">${renderBodyContent(request?.body)}</div>
  </section>

  <section id="context-session" class="mb-4 dark:bg-gray-800/50 dark:ring-1 dark:ring-inset dark:ring-white/5 bg-white rounded-lg shadow-md overflow-hidden">
    <div class="px-4 py-3 flex items-center gap-2">
      <h3 class="text-sm font-semibold">Session</h3>
      <div class="grow"></div>
      <a href="#context-session" class="text-gray-400 hover:text-gray-600 text-xs" aria-label="Anchor">#</a>
      <button type="button" class="copy-btn cursor-pointer px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs" data-clipboard-text="${attrEscape(
          JSON.stringify(request?.session ?? {}),
      )}" aria-label="Copy JSON">Copy</button>
    </div>
            <div class="max-w-full overflow-auto">${renderObjectTable(request?.session as Record<string, unknown>)}</div>
  </section>

  <section id="context-cookies" class="mb-4 dark:bg-gray-800/50 dark:ring-1 dark:ring-inset dark:ring-white/5 bg-white rounded-lg shadow-md overflow-hidden">
    <div class="px-4 py-3 flex items-center gap-2">
      <h3 class="text-sm font-semibold">Cookies</h3>
      <div class="grow"></div>
      <a href="#context-cookies" class="text-gray-400 hover:text-gray-600 text-xs" aria-label="Anchor">#</a>
      <button type="button" class="copy-btn cursor-pointer px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs" data-clipboard-text="${attrEscape(
          JSON.stringify(request?.cookies || {}),
      )}" aria-label="Copy JSON">Copy</button>
    </div>
    <div class="max-w-full overflow-auto">${renderKeyValueTable((request?.cookies || {}) as Record<string, string | string[]>)}
    </div>
  </section>${contextSections.content}
</div>`;

    const html = `
<div class="w-full flex gap-4">
  ${sidebar}
  ${content}
</div>`;

    const script = `
(function(){
  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function() {
        showCopySuccess();
      }).catch(function() {
        fallbackCopyTextToClipboard(text);
      });
    } else {
      fallbackCopyTextToClipboard(text);
    }
  }

  function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      var successful = document.execCommand('copy');
      if (successful) showCopySuccess();
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  }

  function showCopySuccess() {
    var btn = document.activeElement;
    if (btn && btn.classList.contains('copy-btn')) {
      var originalText = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('bg-green-100', 'dark:bg-green-800', 'text-green-700', 'dark:text-green-200');
      btn.classList.remove('bg-gray-100', 'dark:bg-gray-800');
      setTimeout(function() {
        btn.textContent = originalText;
        btn.classList.remove('bg-green-100', 'dark:bg-green-800', 'text-green-700', 'dark:text-green-200');
        btn.classList.add('bg-gray-100', 'dark:bg-gray-800');
      }, 1500);
    }
  }

  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('copy-btn')) {
      var text = e.target.getAttribute('data-clipboard-text');
      if (text) {
        copyToClipboard(text);
      }
    }
  });
})();`;

    return { html, script };
};

export default requestPanel;
