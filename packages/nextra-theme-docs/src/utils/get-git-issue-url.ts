import gitUrlParse from "git-url-parse";

const getGitIssueUrl = ({ labels, repository = "", title }: { labels?: string; repository?: string; title: string }): string => {
    const repo = gitUrlParse(repository);

    if (repo.resource.includes("gitlab")) {
        return `${repo.protocol}://${repo.resource}/${repo.owner}/${repo.name}/-/issues/new?issue[title]=${encodeURIComponent(title)}`;
    }

    if (repo.resource.includes("github")) {
        return `${repo.protocol}://${repo.resource}/${repo.owner}/${repo.name}/issues/new?title=${encodeURIComponent(title)}&labels=${labels ?? ""}`;
    }

    return "#";
};

export default getGitIssueUrl;
