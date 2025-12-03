import type { Content as IContent, OptionList as IOptionList, Section as ISection } from "../../types/command-line-usage";
import ContentSection from "./section/content-section";
import OptionList from "./section/option-list-section";

const commandLineUsage = (sections: ISection[]): string => {
    const lines = Array.isArray(sections) ? sections : [sections];

    if (lines.length === 0) {
        return "";
    }

    return `\n${sections
        .map((section) => {
            if ((section as IOptionList).optionList) {
                return new OptionList(section).toString();
            }

            return new ContentSection(section as IContent).toString();
        })
        .join("\n")}`;
};

export default commandLineUsage;
