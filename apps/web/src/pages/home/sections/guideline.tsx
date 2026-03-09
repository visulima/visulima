import type { FC } from "react";

import bgStones from "@/assets/images/bg-stones.png";
import Section from "@/components/sections/section";
import SectionTitle from "@/components/sections/section-title";

const GuidelineSection: FC = () => (
    <div className="bg-coal bg-bottom-left bg-no-repeat" style={{ backgroundImage: `url(${bgStones})` }}>
        <Section mode="dark" patternColor="royal-amethyst" patternPosition="top">
            <div className="col-span-1 mb-16 md:mb-0">
                <SectionTitle
                    description="We follow a set of guidelines to ensure that our open-source contributions maintain exceptional quality."
                    mode="dark"
                    prefix="Guideline"
                    title="The balancing act of open source."
                />
            </div>
            <div className="hidden lg:col-span-1 lg:block" />
            <div className="col-span-1 flex flex-col gap-20 text-white lg:mt-24">
                <div className="flex flex-col gap-5">
                    <h3 className="border-l-lime -ml-[1px] border-l px-10 text-lg font-bold">Make it simple and enjoyable</h3>
                    <p className="px-10 text-base/6 text-gray-300">
                        At Visulima, we believe coding should be as enjoyable as it is productive. Our Node.js packages are designed with simplicity and
                        elegance, ensuring that every line of code feels intuitive and creative.
                    </p>
                </div>
                <div className="flex flex-col gap-5">
                    <h3 className="border-l-lime -ml-[1px] border-l px-10 text-lg font-bold">Provide robust testing</h3>
                    <p className="px-10 text-base/6 text-gray-300">
                        Reliability is at the core of everything we build. Each package is backed by a comprehensive test suite to guarantee seamless
                        performance in every environment, saving you time and building trust in production.
                    </p>
                </div>
                <div className="flex flex-col gap-5">
                    <h3 className="border-l-lime -ml-[1px] border-l px-10 text-lg font-bold">Be adaptable</h3>
                    <p className="px-10 text-base/6 text-gray-300">
                        We understand that every project is unique. That’s why our packages are modular and extensible, with customizable functions, hooks, and
                        configurations that allow you to adapt them to your exact requirements.
                    </p>
                </div>
            </div>
            <div className="col-span-1 mt-20 flex flex-col gap-20 text-white md:mt-0">
                <div className="flex flex-col gap-5">
                    <h3 className="border-l-lime -ml-[1px] border-l px-10 text-lg font-bold">Craft clear documentation</h3>
                    <p className="px-10 text-base/6 text-gray-300">
                        Great tools deserve great documentation. We invest in creating clear, detailed guides so you can quickly understand how to use our
                        packages and unlock their full potential.
                    </p>
                </div>
                <div className="flex flex-col gap-5">
                    <h3 className="border-l-lime -ml-[1px] border-l px-10 text-lg font-bold">Write clean and readable code</h3>
                    <p className="px-10 text-base/6 text-gray-300">
                        Code should speak for itself. We write clean, readable code with thoughtfully named variables and functions, making collaboration easier
                        and maintenance a breeze.
                    </p>
                </div>
                <div className="flex flex-col gap-5">
                    <h3 className="border-l-lime -ml-[1px] border-l px-10 text-lg font-bold">Focus on a small, polished scope</h3>
                    <p className="px-10 text-base/6 text-gray-300">
                        Less is more. Our packages are intentionally focused on delivering one polished feature, ensuring simplicity, efficiency, and
                        reliability for your projects without unnecessary complexity.
                    </p>
                </div>
                <div className="flex flex-col gap-5">
                    <h3 className="border-l-lime -ml-[1px] border-l px-10 text-lg font-bold">Stay current</h3>
                    <p className="px-10 text-base/6 text-gray-300">
                        The Node.js ecosystem evolves fast, and so do we. Our team ensures every package stays compatible with the latest updates and
                        frameworks, so your projects always remain cutting-edge.
                    </p>
                </div>
            </div>
        </Section>
    </div>
);

export default GuidelineSection;
