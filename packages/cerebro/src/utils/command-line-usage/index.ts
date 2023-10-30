import type { OptionList as IOptionList, Section } from "../../@types/command-line-usage";
import ContentSection from "./section/content-section";
import OptionList from "./section/option-list-section";

const commandLineUsage = (sections: Section[]): string => {
    const lines = Array.isArray(sections) ? sections : [sections];

    if (lines.length === 0) {
        return "";
    }

    return `\n${sections
        .map((section) => {
            if ((section as IOptionList).optionList) {
                return (new OptionList(section)).toString();
            }

            return (new ContentSection(section)).toString();
        })
        .join("\n")}`;
};

export default commandLineUsage;
