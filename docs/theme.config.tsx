import type { DocumentationThemeConfig } from "@visulima/nextra-theme-docs";
import { Anchor } from "@visulima/nextra-theme-docs";
import cn from "clsx";
import { useRouter } from "next/router";
import { DiscordIcon } from "nextra/icons";
import type { ReactElement } from "react";

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

const config: DocumentationThemeConfig = {
    project: {
        // eslint-disable-next-line @next/next/no-img-element
        icon: () => <img src="https://img.shields.io/github/stars/visulima/visulima?style=social" alt="Visulima" />,
        link: visulimaGitHubUrl,
    },
    docsRepositoryBase: "https://github.com/visulima/visulima/blob/main/docs",
    feedback: {
        labels: "feedback",
        content: () => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { locale } = useRouter();
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-return
            return FEEDBACK_LINK_WITH_TRANSLATIONS[locale as string] || FEEDBACK_LINK_WITH_TRANSLATIONS["en-US"];
        },
    },
    logo: () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { locale } = useRouter();
        return (
            <>
                {/* <Logo height={12} /> */}
                <span className="mx-2 inline select-none font-extrabold" title={`Visulima: ${TITLE_WITH_TRANSLATIONS[locale as string] || ""}`}>
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
    sidebar: {
        defaultMenuCollapseLevel: 1,
    },
    editLink: {
        content: ({ locale }): ReactElement => {
            // eslint-disable-next-line sonarjs/no-small-switch
            switch (locale) {
                default: {
                    return "Edit this page on GitHub →";
                }
            }
        },
    },
    footer: {
        copyright: ({ activeType }) => (
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            <span className={cn("text-sm text-gray-500 dark:text-gray-400", ["page", "hidden"].includes(activeType as string) ? "w-full" : "")}>
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
                            href: `${visulimaGitHubUrl}/discussions/categories/q-a`,
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
                <div className="grid grid-cols-12 gap-y-12 md:gap-x-8 md:border-0 md:p-0">
                    {menu.map((item, index) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <div key={`group-${index}-${item.title}`} className="col-span-6 text-sm md:col-span-3 lg:col-span-2">
                            {/* eslint-disable-next-line tailwindcss/no-custom-classname */}
                            <p className="text-sm uppercase tracking-widest text-gray-400">{item.title}</p>
                            <ul className="mt-3 space-y-2">
                                {item.links.map((link) => (
                                    // eslint-disable-next-line react/no-array-index-key
                                    <li key={`li-${link.title}`}>
                                        <Anchor href={link.href} title={link.title} className={linkClasses} newWindow={!link.href.startsWith("/")}>
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
        pages: ({ locale }) => {
            if (locale === "en-US") {
                return [
                    {
                        title: "Documentation",
                        subtitle: "Learn how to use Visulima",
                        url: "/docs/getting-started",
                    },
                ];
            }

            return [];
        },
    },
    search: {
        placeholder: ({ locale }) => {
            // eslint-disable-next-line sonarjs/no-small-switch
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
    i18n: [{ locale: "en-US", name: "English" }],

    comments: process.env.NEXT_PUBLIC_COMMENTS_REPO ? {
        repository: process.env.NEXT_PUBLIC_COMMENTS_REPO,
        repositoryId: process.env.NEXT_PUBLIC_COMMENTS_REPO_ID as string,
        categoryId: process.env.NEXT_PUBLIC_COMMENTS_CATEGORY_ID as string,
    } : undefined,
};

export default config;
