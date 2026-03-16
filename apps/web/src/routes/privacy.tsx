import { createFileRoute } from "@tanstack/react-router";
import { DocsBody } from "fumadocs-ui/page";

import Section from "@/components/sections/section";
import SectionSeparator from "@/components/sections/section-separator";
import { createSeoHead } from "@/lib/seo";
import SupportSection from "../pages/home/sections/support";

const RouteComponent = () => (
    <>
        <DocsBody className="bg-coal">
            <Section mode="dark" gridLength={1} classes={{ root: "", childrenWrapper: "sm:grid-cols-1 lg:grid-cols-1" }}>
                <p>
                    <em>Last updated: 16.03.2026</em>
                </p>

                <h1>Privacy Policy</h1>

                <p>
                    This privacy policy explains how visulima.com ("we", "us", "our"), operated by Daniel Bannert, collects, uses, and protects information when
                    you visit our website. Visulima is an open source project — we collect minimal data and do not sell any personal information.
                </p>

                <h2>1. Responsible Party</h2>
                <p>
                    Daniel Bannert
                    <br />
                    c/o Online-Impressum.de #22125
                    <br />
                    Europaring 90
                    <br />
                    53757 Sankt Augustin, Germany
                    <br />
                    E-Mail: d.bannert[at]anolilab[dot]de
                </p>

                <h2>2. What Data We Collect</h2>

                <h3>2.1 Server Logs (Hosting)</h3>
                <p>
                    Our website is hosted on <strong>Netlify</strong> (Netlify, Inc., San Francisco, USA). When you visit our site, Netlify automatically
                    collects standard server log data including your IP address, browser type, referring page, and timestamp. This data is processed by Netlify
                    under their{" "}
                    <a href="https://www.netlify.com/privacy/" rel="noopener noreferrer" target="_blank">
                        Privacy Policy
                    </a>
                    . The legal basis is Art. 6(1)(f) GDPR (legitimate interest in providing a secure, functional website).
                </p>

                <h3>2.2 Analytics (PostHog)</h3>
                <p>
                    We use <strong>PostHog</strong> (PostHog, Inc.) for privacy-friendly website analytics to understand how visitors use our site. PostHog is
                    configured to use the <strong>EU data region</strong> (eu.posthog.com) and is proxied through our own domain to avoid third-party cookie
                    issues. We collect:
                </p>
                <ul>
                    <li>Page views and navigation patterns</li>
                    <li>Anonymized device and browser information</li>
                    <li>Approximate geographic location (country level, derived from IP)</li>
                </ul>
                <p>
                    IP addresses are not stored in full. We do not use PostHog for advertising or user profiling. The legal basis is Art. 6(1)(f) GDPR
                    (legitimate interest in improving our website).
                </p>

                <h3>2.3 Content Delivery (Cloudinary)</h3>
                <p>
                    We use <strong>Cloudinary</strong> (Cloudinary Ltd.) to serve optimized images and videos. When your browser loads these assets, Cloudinary
                    may receive your IP address and standard request headers. See Cloudinary's{" "}
                    <a href="https://cloudinary.com/privacy" rel="noopener noreferrer" target="_blank">
                        Privacy Policy
                    </a>
                    .
                </p>

                <h3>2.4 Fonts</h3>
                <p>
                    All fonts (Geist Sans, Geist Mono) are self-hosted on our domain. No external font services (such as Google Fonts) are used, so no data is
                    transmitted to third parties for font loading.
                </p>

                <h2>3. Cookies</h2>
                <p>
                    We do not use advertising or tracking cookies. PostHog analytics may use functional cookies or local storage to distinguish unique visitors.
                    These are first-party only and are not shared with third parties.
                </p>

                <h2>4. Third-Party Links</h2>
                <p>
                    Our website contains links to external sites (GitHub, npm, Discord). We are not responsible for the privacy practices of these sites. We
                    encourage you to read their respective privacy policies.
                </p>

                <h2>5. Your Rights (GDPR)</h2>
                <p>Under the General Data Protection Regulation (GDPR), you have the right to:</p>
                <ul>
                    <li>
                        <strong>Access</strong> — request a copy of the data we hold about you
                    </li>
                    <li>
                        <strong>Rectification</strong> — request correction of inaccurate data
                    </li>
                    <li>
                        <strong>Erasure</strong> — request deletion of your data
                    </li>
                    <li>
                        <strong>Restriction</strong> — request we limit processing of your data
                    </li>
                    <li>
                        <strong>Objection</strong> — object to processing based on legitimate interest
                    </li>
                    <li>
                        <strong>Data portability</strong> — request your data in a machine-readable format
                    </li>
                </ul>
                <p>
                    To exercise any of these rights, contact us at d.bannert[at]anolilab[dot]de. You also have the right to lodge a complaint with a supervisory
                    authority (in Germany: the data protection authority of your federal state).
                </p>

                <h2>6. Data Retention</h2>
                <p>
                    Server logs are retained according to Netlify's standard retention policy. PostHog analytics data is retained for 12 months. We do not
                    maintain user accounts or store personal data beyond what is described above.
                </p>

                <h2>7. Data Transfers</h2>
                <p>
                    Some of our service providers (Netlify, Cloudinary) are based in the United States. Data transfers to the US are conducted under appropriate
                    safeguards, including Standard Contractual Clauses (SCCs) as required by GDPR. PostHog data remains in the EU.
                </p>

                <h2>8. Changes to This Policy</h2>
                <p>
                    We may update this privacy policy from time to time. Changes will be posted on this page with an updated "Last updated" date. We encourage
                    you to review this page periodically.
                </p>
            </Section>
        </DocsBody>
        <div className="relative">
            <SectionSeparator bgColor="bg-ivory" fillColor="fill-ivory" position="top" />
            <SupportSection />
        </div>
    </>
);

export const Route = createFileRoute("/privacy")({
    component: RouteComponent,
    head: () => ({
        ...createSeoHead({
            description: "Visulima privacy policy detailing how we collect, use, and protect your personal data.",
            path: "/privacy",
            title: "Privacy Policy",
        }),
    }),
});
