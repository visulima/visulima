/**
 * Classification of the role an MX host plays in the mail flow.
 *
 * - `mailbox` — a mailbox host that ultimately stores the recipient's mail (and typically hosts business/custom domains), e.g. Google Workspace, Microsoft 365, Zoho, Fastmail, Proton, Yandex 360.
 * - `free` — a free consumer webmail provider whose MX hosts are operated for end-user mailboxes rather than customer domains, e.g. Yahoo, iCloud, GMX, Mail.ru, Mail.com.
 * - `seg` — a Secure Email Gateway / inbound filtering service that fronts the real mailbox host, e.g. Proofpoint, Mimecast, Barracuda, Cisco, Trend Micro.
 */
export type MxProviderType = "free" | "mailbox" | "seg";

/**
 * A single curated provider entry: the canonical provider name, its role, a
 * human-friendly display label, and the registrable MX host suffixes that
 * identify it.
 *
 * `patterns` are matched as suffixes on a dot boundary, so `pphosted.com`
 * matches `mx0a-00000000.pphosted.com` but not `notpphosted.com`.
 */
export interface MxProviderEntry {
    /** Human-friendly label for display, e.g. `"Google Workspace"`. */
    display: string;

    /** Registrable MX host suffixes identifying the provider (lowercase). */
    patterns: string[];

    /** Stable provider identifier, e.g. `"google"`. */
    provider: string;

    /** Whether the host is a mailbox host, free consumer provider, or SEG. */
    type: MxProviderType;
}

/**
 * Curated map of MX host suffixes to their mail provider.
 *
 * This is a hand-maintained, static dataset — there is no network lookup and no
 * generated artifact. Patterns are intentionally registrable suffixes so that
 * the matcher stays robust against the per-customer/per-cluster prefixes mail
 * vendors put in front of them (e.g. `mx0a-00000000.pphosted.com`).
 *
 * Note: classification is by MX host, which cannot always separate a free
 * consumer tier from a paid business tier on the same infrastructure. For
 * example, consumer Gmail (`gmail-smtp-in.l.google.com`) and Google Workspace
 * (`aspmx.l.google.com`) both resolve under `google.com`, so both classify as
 * Google `mailbox`.
 *
 * This dataset is deep-frozen and cannot be mutated at runtime; the matcher
 * builds its lookup index once at module load, so pushing or editing entries
 * would have no effect anyway. Copy it if you need a customizable variant.
 * @see https://www.suped.com/learn/email-deliverability/how-can-i-identify-the-smtp-provider-from-an-mx-record
 */
export const MX_PROVIDERS: MxProviderEntry[] = [
    // ── Mailbox hosts ──────────────────────────────────────────────────────
    {
        display: "Google Workspace",
        // aspmx.l.google.com, alt1.aspmx.l.google.com, gmail-smtp-in.l.google.com …
        patterns: ["google.com", "googlemail.com"],
        provider: "google",
        type: "mailbox",
    },
    {
        display: "Microsoft 365",
        // <tenant>.mail.protection.outlook.com
        patterns: ["mail.protection.outlook.com", "outlook.com"],
        provider: "microsoft",
        type: "mailbox",
    },
    {
        display: "Zoho Mail",
        // mx.zoho.com, mx2.zoho.com, mx.zoho.eu, mx.zoho.in
        patterns: ["zoho.com", "zoho.eu", "zoho.in", "zohomail.com"],
        provider: "zoho",
        type: "mailbox",
    },
    {
        display: "Fastmail",
        // in1-smtp.messagingengine.com, in2-smtp.messagingengine.com
        patterns: ["messagingengine.com", "fastmail.com"],
        provider: "fastmail",
        type: "mailbox",
    },
    {
        display: "Proton Mail",
        // mail.protonmail.ch, mailsec.protonmail.ch
        patterns: ["protonmail.ch", "protonmail.com", "proton.me"],
        provider: "proton",
        type: "mailbox",
    },
    {
        display: "Yandex 360",
        // mx.yandex.net, mx.yandex.ru
        patterns: ["yandex.net", "yandex.ru"],
        provider: "yandex",
        type: "mailbox",
    },

    // ── Free consumer webmail ──────────────────────────────────────────────
    {
        display: "Outlook.com",
        // hotmail-com.olc.protection.outlook.com, outlook-com.olc.protection.outlook.com
        // (consumer Outlook.com/Hotmail/Live tier, distinct from the business M365 mail.protection.* host)
        patterns: ["olc.protection.outlook.com"],
        provider: "outlook",
        type: "free",
    },
    {
        display: "Yahoo Mail",
        // mta5.am0.yahoodns.net (also fronts AOL after the Yahoo/AOL merger)
        patterns: ["yahoodns.net", "yahoo.com"],
        provider: "yahoo",
        type: "free",
    },
    {
        display: "Apple iCloud Mail",
        // mx01.mail.icloud.com, mx02.mail.icloud.com
        patterns: ["icloud.com", "mail.me.com"],
        provider: "icloud",
        type: "free",
    },
    {
        display: "GMX",
        // mx00.gmx.net, mx01.gmx.net
        patterns: ["gmx.net", "gmx.com"],
        provider: "gmx",
        type: "free",
    },
    {
        display: "Mail.ru",
        // mxs.mail.ru
        patterns: ["mail.ru"],
        provider: "mailru",
        type: "free",
    },
    {
        display: "Mail.com",
        // mx00.mail.com, mx01.mail.com
        patterns: ["mail.com"],
        provider: "mailcom",
        type: "free",
    },
    {
        display: "Web.de",
        // mx-ha.web.de, mx00.web.de
        patterns: ["web.de"],
        provider: "webde",
        type: "free",
    },

    // ── Secure Email Gateways (SEGs) ───────────────────────────────────────
    {
        display: "Proofpoint",
        // mx0a-00000000.pphosted.com, mx0b-00000000.pphosted.com, *.ppe-hosted.com
        patterns: ["pphosted.com", "pphosted.net", "ppe-hosted.com"],
        provider: "proofpoint",
        type: "seg",
    },
    {
        display: "Mimecast",
        // <region>-smtp-inbound-1.mimecast.com, *.mimecast.co.za
        patterns: ["mimecast.com", "mimecast.co.za", "mimecast.org"],
        provider: "mimecast",
        type: "seg",
    },
    {
        display: "Barracuda",
        // Email Security Service MX: *.ess.barracudanetworks.com; *.cudasvc.com.
        // The bare corporate barracuda.com / barracudanetworks.com domains are NOT
        // the product MX, so they are intentionally excluded to avoid false SEGs.
        patterns: ["ess.barracudanetworks.com", "cudasvc.com"],
        provider: "barracuda",
        type: "seg",
    },
    {
        display: "Cisco Secure Email",
        // Cisco Ironport / ESA / Cloud Email Security MX: mx*.iphmx.com. The
        // corporate cisco.com domain is not the product MX, so it is excluded.
        patterns: ["iphmx.com"],
        provider: "cisco",
        type: "seg",
    },
    {
        display: "Trend Micro Email Security",
        // Hosted Email Security MX: *.in.tmes.trendmicro.com, *.in.tmes.trendmicro.eu,
        // *.in.hes.trendmicro.com. The bare trendmicro.com / trendmicro.eu corporate
        // domains are not the product MX, so they are excluded.
        patterns: ["tmes.trendmicro.com", "hes.trendmicro.com", "tmes.trendmicro.eu"],
        provider: "trendmicro",
        type: "seg",
    },
    {
        display: "Sophos Email",
        // Sophos Email Security MX: *.prod.hydra.sophos.com. The bare sophos.com
        // corporate domain is not the product MX, so it is excluded.
        patterns: ["hydra.sophos.com"],
        provider: "sophos",
        type: "seg",
    },
    {
        display: "Forcepoint",
        // *.mailcontrol.com
        patterns: ["mailcontrol.com"],
        provider: "forcepoint",
        type: "seg",
    },
    {
        display: "Symantec Email Security.cloud (MessageLabs)",
        // cluster*.eu.messagelabs.com — Broadcom/Symantec, formerly MessageLabs
        patterns: ["messagelabs.com"],
        provider: "symantec",
        type: "seg",
    },
    {
        display: "Cloudflare Area 1",
        // *.mx.cloudflare.net
        patterns: ["mx.cloudflare.net"],
        provider: "cloudflare",
        type: "seg",
    },
];

// Deep-freeze so the exported dataset is immutable: mutation throws in strict
// mode instead of silently no-op'ing against the load-time matcher index.
for (const entry of MX_PROVIDERS) {
    Object.freeze(entry.patterns);
    Object.freeze(entry);
}

Object.freeze(MX_PROVIDERS);
