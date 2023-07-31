import type { DocumentationThemeConfig } from "@visulima/nextra-theme-docs";
import { Anchor } from "@visulima/nextra-theme-docs";
import cn from "clsx";
import { useRouter } from "next/router";
import { DiscordIcon } from "nextra/icons";
import {
    ChevronDownSquare,
    Club,
    Footprints,
    Frame,
    Info,
    LayoutDashboard,
    ListTree,
    MessageSquare,
    MessageSquareDashed,
    PanelTop,
    Rows,
    Edit,
} from "lucide-react";

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
    chat: {
        icon: (
            <Anchor className="p-2 text-current" href="" newWindow>
                <DiscordIcon />
                <span className="sr-only">Discord</span>
            </Anchor>
        ),
    },
    comments: process.env.NEXT_PUBLIC_COMMENTS_REPO
        ? {
              categoryId: process.env.NEXT_PUBLIC_COMMENTS_CATEGORY_ID as string,
              repository: process.env.NEXT_PUBLIC_COMMENTS_REPO,
              repositoryId: process.env.NEXT_PUBLIC_COMMENTS_REPO_ID as string,
          }
        : undefined,
    docsRepositoryBase: "https://github.com/visulima/visulima/blob/main/docs",
    editLink: {
        content: ({ locale }) => {
            // eslint-disable-next-line sonarjs/no-small-switch
            switch (locale) {
                default: {
                    return "Edit this page on GitHub →";
                }
            }
        },
    },
    feedback: {
        content: () => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { locale } = useRouter();
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-return
            return FEEDBACK_LINK_WITH_TRANSLATIONS[locale as string] || FEEDBACK_LINK_WITH_TRANSLATIONS["en-US"];
        },
        labels: "feedback",
    },
    footer: {
        component: () => {
            const linkClasses =
                "my-1 scroll-my-6 scroll-py-6 inline-block w-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 contrast-more:text-gray-900 contrast-more:underline contrast-more:dark:text-gray-50";

            const menu = [
                {
                    links: [
                        {
                            href: "/impress",
                            title: "Getting Started",
                        },
                    ],
                    title: "Highlights",
                },
                {
                    links: [
                        {
                            href: `${visulimaGitHubUrl}/discussions/categories/q-a`,
                            title: "GitHub",
                        },
                        {
                            href: "#",
                            title: "Discord",
                        },
                    ],
                    title: "Support",
                },
                {
                    links: [
                        {
                            href: visulimaGitHubUrl,
                            title: "GitHub",
                        },
                        {
                            href: "https://twitter.com/visulima",
                            title: "Twitter",
                        },
                    ],
                    title: "Company",
                },
                {
                    links: [
                        {
                            href: "/impress",
                            title: "Impress",
                        },
                    ],
                    title: "Legal",
                },
            ];

            return (
                <div className="grid grid-cols-12 gap-y-12 md:gap-x-8 md:border-0 md:p-0">
                    {menu.map((item, index) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <div className="col-span-6 text-sm md:col-span-3 lg:col-span-2" key={`group-${index}-${item.title}`}>
                            {}
                            <p className="text-sm uppercase tracking-widest text-gray-400">{item.title}</p>
                            <ul className="mt-3 space-y-2">
                                {item.links.map((link) => (
                                    <li key={`li-${link.title}`}>
                                        <Anchor className={linkClasses} href={link.href} newWindow={!link.href.startsWith("/")} title={link.title}>
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
        copyright: ({ activeType }) => (
            <span className={cn("text-sm text-gray-500 dark:text-gray-400", ["hidden", "page"].includes(activeType as string) ? "w-full" : "")}>
                © {new Date().getFullYear()} Visulima <br /> All Rights Reserved.
            </span>
        ),
    },
    i18n: [{ locale: "en-US", name: "English" }],
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
    notFound: {
        pages: ({ locale }) => {
            if (locale === "en-US") {
                return [
                    {
                        subtitle: "Learn how to use Visulima",
                        title: "Documentation",
                        url: "/docs/getting-started",
                    },
                ];
            }

            return [];
        },
    },
    project: {
        // eslint-disable-next-line @next/next/no-img-element
        icon: () => <img alt="Visulima" src="https://img.shields.io/github/stars/visulima/visulima?style=social" />,
        link: visulimaGitHubUrl,
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
    sidebar: {
        defaultMenuCollapseLevel: 1,
        icon: ({ className, route }) => {
            switch (route) {
                case "/docs/nextra-theme-docs/writing-content/components/accordion": {
                    return <ChevronDownSquare className={className} />;
                }
                case "/docs/nextra-theme-docs/writing-content/components/accordion-group": {
                    return <Rows className={className} />;
                }
                case "/docs/nextra-theme-docs/writing-content/components/card": {
                    return <Club className={className} />;
                }
                case "/docs/nextra-theme-docs/writing-content/components/card-group": {
                    return <LayoutDashboard className={className} />;
                }
                case "/docs/nextra-theme-docs/writing-content/components/tabs": {
                    return <PanelTop className={className} />;
                }
                case "/docs/nextra-theme-docs/writing-content/components/steps": {
                    return <Footprints className={className} />;
                }
                case "/docs/nextra-theme-docs/writing-content/components/file-tree": {
                    return <ListTree className={className} />;
                }
                case "/docs/nextra-theme-docs/writing-content/components/callout": {
                    return <Info className={className} />;
                }
                case "/docs/nextra-theme-docs/writing-content/components/image-frame": {
                    return <Frame className={className} />;
                }
                case "/docs/nextra-theme-docs/writing-content/components/tooltip": {
                    return <MessageSquare className={className} />;
                }
                case "/docs/nextra-theme-docs/writing-content/components/toast": {
                    return <MessageSquareDashed className={className} />;
                }
                case "/docs/nextra-theme-docs/writing-content/components/live-editor": {
                    return <Edit className={className} />;
                }
                default: {
                    return null;
                }
            }
        },
    },

    useNextSeoProps: () => {
        return { titleTemplate: "Visulima – %s" };
    },
};

export default config;
