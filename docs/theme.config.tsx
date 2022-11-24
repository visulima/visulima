import { BookOpenIcon } from "@heroicons/react/24/outline";
import cn from "clsx";
import { useRouter } from "next/router";
import { DiscordIcon } from "nextra/icons";

import Anchor from "./src/components/anchor";

// const Logo = ({ height }) => (
//
// );

const TITLE_WITH_TRANSLATIONS = {
    "en-US": "Visulima is the next-gen JavaScript framework for JAMStack blogs, sites & apps.",
};

const FEEDBACK_LINK_WITH_TRANSLATIONS = {
    "en-US": "Question? Give us feedback →",
};

const visulimaGitHubUrl = "https://github.com/visulima/visulima";

export default {
    project: {
        // eslint-disable-next-line @next/next/no-img-element
        icon: () => <img src="https://img.shields.io/github/stars/visulima/visulima?style=social" alt="Visulima" />,
        link: visulimaGitHubUrl,
    },
    docsRepositoryBase: "https://github.com/visulima/visulima/blob/main/docs",
    titleSuffix: " – Visulima",
    unstable_flexsearch: true,
    toc: {
        float: true,
    },
    feedback: {
        labels: "feedback",
        content: () => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { locale } = useRouter();
            return FEEDBACK_LINK_WITH_TRANSLATIONS[locale] || FEEDBACK_LINK_WITH_TRANSLATIONS["en-US"];
        },
    },
    logo: () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { locale } = useRouter();
        return (
            <>
                {/* <Logo height={12} /> */}
                <span className="mx-2 font-extrabold hidden md:inline select-none" title={`Visulima: ${TITLE_WITH_TRANSLATIONS[locale] || ""}`}>
                    Visulima
                </span>
            </>
        );
    },
    chat: {
        icon: (
            <Anchor className="p-2 text-current" href="" newWindow>
                    <DiscordIcon />
                    <span className="sr-only">Discord</span>
                </Anchor>
        ),
    },
    head: ({ title, meta }) => {
        const ogImage = meta?.image || `https://visulima.com${title === "home" ? "" : `?title=${encodeURIComponent(title)}`}`;

        return (
            <>
                {/* Favicons, meta */}
                <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
                <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
                <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
                <link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />
                <link rel="manifest" href="/favicon/site.webmanifest" />
                <link rel="mask-icon" href="/favicon/safari-pinned-tab.svg" color="#000000" />
                <meta name="msapplication-TileColor" content="#ffffff" />
                <meta httpEquiv="Content-Language" content="en" />
                <meta name="description" content={meta?.description || TITLE_WITH_TRANSLATIONS["en-US"]} />
                <meta name="og:description" content={meta?.description || TITLE_WITH_TRANSLATIONS["en-US"]} />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:site" content="@visulima" />
                <meta name="twitter:image" content={ogImage} />
                <meta name="og:title" content={title ? `${title} – Visulima` : TITLE_WITH_TRANSLATIONS["en-US"]} />
                <meta name="og:image" content={ogImage} />
                <meta name="apple-mobile-web-app-title" content="Visulima" />
            </>
        );
    },
    editLink: {
        text: ({ locale }) => {
            // eslint-disable-next-line radar/no-small-switch
            switch (locale) {
                default: {
                    return "Edit this page on GitHub →";
                }
            }
        },
    },
    footer: {
        copyright: ({ activeType }) => (
                <span className={cn("text-sm text-gray-500 dark:text-gray-400", ["page", "hidden"].includes(activeType) ? "w-full" : "")}>
                    © {new Date().getFullYear()} Visulima <br /> All Rights Reserved.
                </span>
        ),
        component: () => {
            // eslint-disable-next-line max-len
            const linkClasses = "my-1 scroll-my-6 scroll-py-6 inline-block w-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 contrast-more:text-gray-900 contrast-more:underline contrast-more:dark:text-gray-50";

            const menu = [
                {
                    title: "Highlights",
                    links: [
                        {
                            title: "Getting Started",
                            href: "/impress",
                        },
                    ],
                },
                {
                    title: "Support",
                    links: [
                        {
                            title: "GitHub",
                            href: visulimaGitHubUrl,
                        },
                        {
                            title: "Discord",
                            href: "#",
                        },
                    ],
                },
                {
                    title: "Company",
                    links: [
                        {
                            title: "GitHub",
                            href: visulimaGitHubUrl,
                        },
                        {
                            title: "Twitter",
                            href: "https://twitter.com/visulima",
                        },
                    ],
                },
                {
                    title: "Legal",
                    links: [
                        {
                            title: "Impress",
                            href: "/impress",
                        },
                    ],
                },
            ];

            // eslint-disable-next-line react/no-array-index-key
            return (
                <div className="grid grid-cols-12 md:gap-x-8 gap-y-12 pt-8 md:p-0 footer-border dark:footer-border md:border-0">
                    {menu.map((item, index) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <div key={`group-${index}-${item.title}`} className="text-ms col-span-6 md:col-span-3 lg:col-span-2">
                            <p className="text-sm tracking-widest text-gray-400 uppercase">{item.title}</p>
                            <ul className="mt-3 space-y-2">
                                {item.links.map((link) => (
                                    // eslint-disable-next-line react/no-array-index-key
                                    <li key={`li-${link.title}`}>
                                        <Anchor href={link.href} title={link.title} className={linkClasses} newWindow={link.href[0] !== "/"}>
                                            {" "}
                                            {link.title}{" "}
                                        </Anchor>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            );
        },
    },
    notFound: {
        pages: (local) => {
            if (local === "en-US") {
                return [
                    {
                        title: "Documentation",
                        subtitle: "Learn how to use Visulima",
                        href: "/docs/getting-started",
                        icon: <BookOpenIcon className="h-6 w-6 lg:h-8 lg:w-8 mx-auto text-primary-700 text-2xl md:text-3xl" />,
                    },
                ];
            }

            return [];
        },
    },
    search: {
        placeholder: ({ locale }) => {
            // eslint-disable-next-line radar/no-small-switch
            switch (locale) {
                default: {
                    return "Search";
                }
            }
        },
    },
    // hero: {
    //     height: 300,
    //     component: ({ route }) => {
    //         console.log(route);
    //
    //         if (route === "/index.en-US") {
    //              return (<div></div>);
    //         }
    //
    //         return null;
    //     },
    // },
    i18n: [{ locale: "en-US", text: "English" }],
};
