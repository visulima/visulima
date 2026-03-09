import { ArrowRight, ExternalLink } from "lucide-react";

import Section from "@/components/sections/section";
import SectionTitle from "@/components/sections/section-title";
import FlickeringGrid from "@/components/ui/flickering-grid";

const SupportSection = () => (
    <>
        <Section classes={{ root: "pb-0" }}>
            <div className="col-span-2">
                <SectionTitle
                    description={
                        <span className="flex flex-col gap-4">
                            <span className="text-white/60">
                                Community is the heart of open source. The success of our packages wouldn't be possible without the incredible contributions of users,
                                testers, and developers who collaborate with us every day.
                            </span>
                            <span className="text-white/40">
                                Want to get involved? Here are some tips on how you can make a meaningful impact on our open source projects.
                            </span>
                        </span>
                    }
                    prefix="Support"
                    title="Contribute to our work and keep us going"
                />
            </div>
        </Section>
        <Section classes={{ root: "pt-20" }}>
            <div className="relative col-span-2 overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-sapphire/30 to-transparent" />
                <div className="flex flex-col gap-4 p-6">
                    <h3 className="text-lg font-bold text-white">Ready to help us out?</h3>
                    <span className="text-sm leading-relaxed text-white/50">
                        Be sure to check out the package's contribution guidelines first. They'll walk you through the process on how to properly submit an issue or
                        pull request to our repositories.
                    </span>
                </div>
            </div>
            <div className="relative col-span-2 mt-10 overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <FlickeringGrid className="ml-0.5 w-full" color="green" flickerChance={0.1} gridGap={2} height={45} maxOpacity={0.3} squareSize={2} />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                <div className="flex flex-col gap-4 p-6">
                    <h3 className="text-lg font-bold text-white">Good first issues</h3>
                    <span className="text-sm leading-relaxed text-white/50">
                        These are simple issues suited for people new to open source development, and often a good place to start working on a package.
                    </span>
                    <a
                        className="group/link inline-flex w-fit items-center gap-2 text-sm font-medium text-sky-sapphire transition-colors hover:text-white"
                        href="https://github.com/issues?q=is%3Aopen+is%3Aissue+user%3Avisulima+is%3Apublic+label%3A%22good+first+issue%22%2C%22help+wanted%22+"
                        rel="noreferrer"
                        target="_blank"
                    >
                        View good first issues
                        <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
                    </a>
                </div>
            </div>
        </Section>
    </>
);

export default SupportSection;
