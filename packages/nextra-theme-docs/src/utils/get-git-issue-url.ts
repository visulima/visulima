import gitUrlParse from "git-url-parse";

const getGitIssueUrl = ({ labels, repository = "", title }: { labels?: string; repository?: string; title: string }): string => {
    const repo = gitUrlParse(repository);

    if (repo.resource.includes("gitlab")) {
        return `${repo.protocol}://${repo.resource}/${repo.owner}/${repo.name}/-/issues/new?issue[title]=${encodeURIComponent(title)}&labels=${labels ?? ""}`;
    }

    if (repo.resource.includes("github")) {
        return `${repo.protocol}://${repo.resource}/${repo.owner}/${repo.name}/-/issues/new?issue[title]=${encodeURIComponent(title)}${
            labels ? `&issue[description]=/label${encodeURIComponent(` ~${labels}\n`)}` : ""
        }`;
    }

    return "#";
};

export default getGitIssueUrl;
