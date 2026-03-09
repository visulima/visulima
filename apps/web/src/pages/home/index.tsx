import type { FC } from "react";

import Github from "@/pages/home/components/github";
import Rules from "@/pages/home/sections/guideline";
import MainHero from "@/pages/home/sections/hero";
import OpenSource from "@/pages/home/sections/open-source";
import Packages from "@/pages/home/sections/packages";
import Support from "@/pages/home/sections/support";
import WhyVisulima from "@/pages/home/sections/why-visulima";

import WorksWhereYouWork from "./sections/works-where-you-work";

const Home: FC = () => (
    <>
        <MainHero />
        <WhyVisulima />
        <Packages />
        <WorksWhereYouWork />
        <Rules />
        <OpenSource />
        <Github />
        <Support />
    </>
);

export default Home;
