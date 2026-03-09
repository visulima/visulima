import { ExternalLink } from "lucide-react";

import Section from "@/components/sections/section";
import SectionTitle from "@/components/sections/section-title";
import FlickeringGrid from "@/components/ui/flickering-grid";

const Icon = ({ className, ...rest }: any) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...rest}>
        <path d="M12 6v12m6-6H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const SupportSection = () => (
    <>
        <Section classes={{ root: "pb-0" }}>
            <div className="col-span-2">
                <SectionTitle
                    description={
                        <span className="flex flex-col gap-5">
                            <span>
                                Community is the heart of open source. The success of our packages wouldn’t be possible without the incredible contributions of
                                users, testers, and developers who collaborate with us every day.
                            </span>
                            <span>Want to get involved? Here are some tips on how you can make a meaningful impact on our open source projects.</span>
                        </span>
                    }
                    prefix="Support"
                    title="Contribute to our work and keep us going"
                />
            </div>
        </Section>
        <Section classes={{ root: "pt-20" }}>
            <div className="bg-ivory border-coal/10 relative col-span-2 border-y border-r">
                <Icon className="absolute -top-3 -left-3 size-6 text-gray-400" />
                <div className="flex flex-col gap-5 p-5">
                    <h3 className="text-lg font-bold">Ready to help us out?</h3>
                    <span>
                        Be sure to check out the package's contribution guidelines first. They’ll walk you through the process on how to properly submit an
                        issue or pull request to our repositories.
                    </span>
                </div>
            </div>
            <div className="bg-ivory border-coal/10 relative col-span-2 mt-10 border-y">
                <FlickeringGrid className="ml-0.5 w-full" color="green" flickerChance={0.1} gridGap={2} height={45} maxOpacity={0.5} squareSize={2} />
                <Icon className="absolute -right-3 -bottom-3 size-6 text-gray-400" />
                <div className="flex flex-col gap-5 p-5">
                    <h3 className="text-lg font-bold">Good first issues</h3>
                    <span>These are simple issues suited for people new to open source development, and often a good place to start working on a package.</span>

                    <a
                        className="border-lime hover:text-lime inline-flex w-44 items-center justify-center gap-1 border-b border-dashed text-sm font-medium text-gray-950 transition duration-300 before:duration-300 hover:border-transparent"
                        href="https://github.com/issues?q=is%3Aopen+is%3Aissue+user%3Avisulima+is%3Apublic+label%3A%22good+first+issue%22%2C%22help+wanted%22+"
                        rel="noreferrer"
                        target="_blank"
                    >
                        View good first issues
                        <ExternalLink className="h-4 w-4" />
                    </a>
                </div>
            </div>
        </Section>
    </>
);

export default SupportSection;
