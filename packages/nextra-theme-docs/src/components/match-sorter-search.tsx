import { matchSorter } from "match-sorter";
import type { Item as NormalItem } from "nextra/normalize-pages";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";

import type { SearchResult } from "../types";
import HighlightMatches from "./highlight-matches";
import Search from "./search";

const MatchSorterSearch = ({ className = undefined, directories = [] }: { className?: string; directories: NormalItem[] }): ReactElement => {
    const [search, setSearch] = useState("");
    const results = useMemo<SearchResult[]>(
        // Will need to scrape all the headers from each page and search through them here
        // (similar to what we already do to render the hash links in sidebar)
        // We could also try to search the entire string text from each page
        // prettier-ignore
        () =>
            (search
                ? matchSorter(directories, search, { keys: ["title"] }).map(({ route, title }) => {
                      return {
                          children: <HighlightMatches match={search} value={title} />,
                          id: route + title,
                          route,
                      };
                  })
                : []),
        [search, directories],
    );

    return (
        <Search
            /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
            onChange={async (value) => {
                setSearch(value);
            }}
            className={className}
            overlayClassName="w-full"
            results={results}
            value={search}
        />
    );
};

export default MatchSorterSearch;
