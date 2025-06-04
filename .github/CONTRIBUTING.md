# How to Contribute

If you're reading this, you're awesome!
Thank you for being a part of the community and helping us make these projects great.
Here are a few guidelines that will help you along the way.

## How do I... <a name="toc"></a>

-   [Use This Guide](#introduction)?
-   Ask or Say Something?
    -   [Request Support](#request-support)
    -   [Report an Error or Bug](#report-an-error-or-bug)
    -   [Request a Feature](#request-a-feature)
-   Make Something?
    -   [Your First Pull Request](#first-pull-request)
    -   [Project Setup](#project-setup)
    -   [Contribute Documentation](#contribute-documentation)
    -   [Contribute Code](#contribute-code)
        -   [Deprecation workflow](#deprecation-workflow)
        -   [Documenting changes for new major versions](#major-version-docs)
        -   [JSDocs](#js-docs)
    -   [Commit Message Guidelines](#committing)
-   Manage Something
    -   [Provide Support on Issues](#provide-support-on-issues)
    -   [Label Issues](#label-issues)
    -   [Clean Up Issues and PRs](#clean-up-issues-and-prs)
    -   [Review Pull Requests](#review-pull-requests)
    -   [Merge Pull Requests](#merge-pull-requests)
    -   [Release process](#release process)
    -   [Join the Project Team](#join-the-project-team)

## [Code of Conduct](https://github.com/visulima/visulima/blob/main/.github/CODE_OF_CONDUCT.md)

**Visulima** has adopted the [Contributor Covenant](https://www.contributor-covenant.org/) as its Code of Conduct, and we expect project participants to adhere to it.
Please read [the full text](https://github.com/visulima/visulima/blob/main/.github/CODE_OF_CONDUCT.md) so that you can understand what actions will and will not be tolerated.

## Introduction

Thank you so much for your interest in contributing!. All types of contributions are encouraged and valued. See the [table of contents](#toc) for different ways to help and details about how this project handles them!📝

Please make sure to read the relevant section before making your contribution! It will make it a lot easier for us maintainers to make the most of it and smooth out the experience for all involved. 💚

The [Project Team](#join-the-project-team) looks forward to your contributions. 🙌🏾✨

## Request Support

If you have a question about this project, how to use it, or just need clarification about something:

-   First, search the issues to see if someone else already had the same problem as you.
-   If not, open an GitHub Discussion at [Q&A](https://github.com/visulima/visulima/discussions/categories/q-a)
-   Provide as much context as you can about what you're running into.
-   Provide project and platform versions (nodejs, npm, etc) you can use `npx envinfo --system --npmPackages '@visulima/*' --binaries --browsers`, depending on what seems relevant. If not, please be ready to provide that information if maintainers ask for it.

Once it's filed:

-   Someone will try to have a response soon.
-   The project team will decide if an open discussion is a bug and will transform it to an issue.
-   If you or the maintainers don't respond to an issue for 30 days, the [issue will be closed](#clean-up-issues-and-prs). If you want to come back to it, reply (once, please), and we'll reopen the existing issue. Please avoid filing new issues as extensions of one you already made.

## Report an Error or Bug

If you run into an error or bug with the project:

-   First, search the open issues to see if someone else already reported this error or bug.
-   If it's the case, add a +1 (thumb up reaction) to the issue and reply to the thread if you have something useful to add.
-   If nobody submitted this error or bug, open an issue as [Bug report](https://github.com/visulima/visulima/issues/new?assignees=&labels=s%3A+pending+triage%2Cc%3A+bug&projects=&template=bug_report.yml) and follow the steps to create the report.
    > Include _reproduction steps_ that someone else can follow to recreate the bug or error on their own.

Once it's filed:

-   The project team will [label the issue](#label-issues).
-   A team member will try to reproduce the issue with your provided steps.
    If there are no repro steps or no obvious way to reproduce the issue, the team will ask you for those steps and mark the issue as `s: awaiting more info`.
    Bugs with the `s: awaiting more info` tag will not be addressed until they are reproduced.
-   If the team is able to reproduce the issue, it will be marked `p: 1-normal`, `p: 2-high` or `p: 3-urgent`, as well as possibly other tags (such as `has workaround`), and the issue will be left to be [implemented by someone](#contribute-code).
-   If you or the maintainers don't respond to an issue for 30 days, the [issue will be closed](#clean-up-issues-and-prs). If you want to come back to it, reply (once, please), and we'll reopen the existing issue. Please avoid filing new issues as extensions of one you already made.
-   `p: 2-high`, `p: 3-urgent`, `do NOT merge yet`, `good first issue` issues may be left open, depending on perceived immediacy and severity, even past the 30 day deadline.

## Request a Feature

If the project doesn't do something you need or want it to do:

-   First, search the open issues to see if someone else already requested that feature.
-   If it's the case, add a +1 (thumb up reaction) to the initial request and reply to the thread if you have something meaningful to add.
-   If nobody submitted this request, open an issue as [New feature proposal](https://github.com/visulima/visulima/issues/new?assignees=&labels=s%3A+pending+triage%2Cc%3A+feature%2Cs%3A+waiting+for+user+interest&projects=&template=feature_request.yml) and follow the steps to create the proposal.

Once it's filed:

-   The project team will [label the issue](#label-issues).
-   The project team will evaluate the feature request, possibly asking you more questions to understand its purpose and any relevant requirements.
    If the issue is closed, the team will convey their reasoning and suggest an alternative path forward.
-   If the feature request is accepted, it will be marked for implementation with `s: accepted`, which can then be done by either by a core team member or by anyone in the community who wants to [contribute code](#contribute-code).

Note: The team is unlikely to be able to accept every single feature request that is filed. Please understand if they need to say no.

## Your First Pull Request

Working on your first Pull Request? You can learn how from this free video series:

[How to Contribute to an Open Source Project on GitHub](https://egghead.io/courses/how-to-contribute-to-an-open-source-project-on-github)

To help you get your feet wet and get you familiar with our contribution process, we have a list of [good first issues](https://github.com/visulima/visulima/issues?q=is:open+is:issue+label:%22good+first+issue%22) that contain bugs that have a relatively limited scope.
This is a great place to get started.

If you decide to fix an issue, please be sure to check the comment thread in case somebody is already working on a fix.
If nobody is working on it at the moment, please leave a comment stating that you intend to work on it so other people don't accidentally duplicate your effort.

If somebody claims an issue but doesn't follow up after more than a week, it's fine to take over, but you should still leave a comment.
If there has been no activity on the issue for 7 to 14 days, then it's safe to assume that nobody is working on it.

## <a name="project-setup"></a> Project Setup

So you want to contribute some code! That's great! This project uses GitHub Pull Requests to manage contributions, so [read up on how to fork a GitHub project and file a PR](https://guides.github.com/activities/forking) if you've never done it before.

If this seems like a lot, or you aren't able to do all this setup, you might also be able to [edit the files directly](https://help.github.com/articles/editing-files-in-another-user-s-repository/) without having to do any of this setup. Yes, [even code](#contribute-code).

If you want to go the usual route and run the project locally, though:

-   [Install Node.js](https://nodejs.org/en/download/)
-   [Install nvm](https://github.com/nvm-sh/nvm#installing-and-updating) (optional)
    > Visulima use nvm to manage the different node version, if you don't want to install `nvm`, check the package.json -> engines -> node value for the min support node version.
-   [Install pnpm](https://pnpm.io/installation)
-   [Fork the project](https://guides.github.com/activities/forking/#fork)

Then in your terminal:

-   `cd path/to/your/clone`
-   `pnpm install`
-   `pnpm run build:packages`
-   `pnpm run test` (optional)

And you should be ready to go!

> If you run into any issue with the setup, check first the [TROUBLESHOOT.md](https://github.com/visulima/visulima/blob/main/.github/TROUBLESHOOT.md)

## <a name="branching-model"></a> Branching Model

This project uses a sophisticated branching model that integrates with `semantic-release` to manage different types of releases. Understanding these branches is key to contributing effectively.

-   **`main` branch:** Represents the latest stable production release. `semantic-release` publishes full releases from this branch.
-   **`next` branch:** Used for upcoming minor or patch releases. Commits here will trigger pre-releases (e.g., `v1.2.0-next.1`). This branch allows for staging and testing the next version before it's merged to `main`.
-   **`next-major` branch:** Similar to `next`, but specifically for upcoming major versions that include breaking changes. Commits here will trigger pre-releases for the next major (e.g., `v2.0.0-next.1`).
-   **`alpha` branch:** This is the primary development branch for cutting-edge features and initial integration. `semantic-release` creates alpha pre-releases from this branch (e.g., `v1.2.0-alpha.1`). Pull Requests for most new features and significant changes should target `alpha`.
-   **`beta` branch:** Used for more stable pre-releases after features have been tested in `alpha`. `semantic-release` creates beta pre-releases from this branch (e.g., `v1.2.0-beta.1`).
-   **Versioned maintenance branches (e.g., `1.x.x`, `2.x.x`, matching `([0-9])?(.{+([0-9]),x}).x`):** These branches are used for providing bug fixes and patches to older, specific versions of the software (Long-Term Support or LTS). `semantic-release` will publish patch releases for that specific version line from these branches (e.g., `v1.1.1` from branch `1.x.x`).

-   **Feature branches:** For any new feature or bug fix, create a descriptive branch off the most appropriate development branch (usually `alpha`, but sometimes `next`, `beta`, or a maintenance branch for hotfixes).
    -   **Naming Convention:**
        -   For new features: `feat/your-feature-name` (e.g., `feat/user-profile-page`)
        -   For bug fixes: `fix/issue-number-or-bug-description` (e.g., `fix/login-button-bug` or `fix/123-fix-login-button`)
        -   For documentation: `docs/area-of-docs` (e.g., `docs/contributing-guide-updates`)
        -   For chores/refactors: `chore/brief-description` or `refactor/area-being-refactored`

**Pull Request Targeting:**
-   Most new features and general improvements should target the `alpha` branch.
-   Changes intended for the immediate next release (that are not breaking) might target `next`.
-   Changes for an upcoming major version might target `next-major`.
-   Stabilization changes might be promoted from `alpha` to `beta` or directly target `beta`.
-   Hotfixes for specific released versions should target the corresponding maintenance branch (e.g., `1.x.x`).

Always confirm the correct target branch if unsure, especially for larger contributions or fixes to older versions.

## Contribute Documentation

Documentation is a super important, critical part of this project. Docs are how we keep track of what we're doing, how, and why. It's how we stay on the same page about our policies. And it's how we tell others everything they need in order to be able to use this project -- or contribute to it. So thank you in advance.

Documentation contributions of any size are welcome! Feel free to file a PR even if you're just rewording a sentence to be more clear, or fixing a spelling mistake!

To contribute documentation:

-   [Set up the project](#project-setup).
-   Edit or add any relevant documentation.
-   Make sure your changes are formatted correctly and consistently with the rest of the documentation.
-   Re-read what you wrote, and run a spellchecker on it to make sure you didn't miss anything.
-   Write clear, concise commit message(s) using [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/). Documentation commits should use `docs(<component>): <message>`, visit the [Committing](#committing) section for more information.
-   Go to https://github.com/visulima/visulima/pulls and open a new pull request with your changes.
-   If your PR is connected to an open issue, add a line in your PR's description that says `Fixes: #123`, where `#123` is the number of the issue you're fixing.

Once you've filed the PR:

-   One or more maintainers will use GitHub's review feature to review your PR.
-   If the maintainer asks for any changes, edit your changes, push, and ask for another review.
-   If the maintainer decides to pass on your PR, they will thank you for the contribution and explain why they won't be accepting the changes. That's ok! We still really appreciate you taking the time to do it, and we don't take that lightly. 💚
-   If your PR gets accepted, it will be marked as such, and merged into the `main` branch soon after.
    Your contribution will be distributed to the masses with our [release process](#release-process).

## <a name="contribute-code"></> Contribute Code

### Important

> By contributing code to this project, you:
>
> -   Agree that you have authored 100% of the content
> -   Agree that you have the necessary rights to the content
> -   Agree that you have received the necessary permissions from your employer to make the contributions (if applicable)
> -   Agree that the content you contribute may be provided under the Project license(s)
> -   Agree that, if you did not author 100% of the content, the appropriate licenses and copyrights have been added along with any other necessary attribution.

We like code commits a lot! They're super handy, and they keep the project going and doing the work it needs to do to be useful to others.

Code contributions of just about any size are acceptable!

The main difference between code contributions and documentation contributions is that contributing code requires inclusion of relevant tests for the code being added or changed. Contributions without accompanying tests will be held off until a test is added, unless the maintainers consider the specific tests to be either impossible, or way too much of a burden for such a contribution.

To contribute code:

-   [Set up the project](#project-setup).
-   Make any necessary changes to the source code.
-   Include any [additional documentation](#contribute-documentation) the changes might need.
-   Write tests that verify that your contribution works as expected.
-   Write clear, concise commit message(s) using [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/).
-   Dependency updates, additions, or removals must be in individual commits, and the message must use the format: `<prefix>(deps): PKG@VERSION`, where `<prefix>` is any of the usual `conventional-changelog` prefixes, at your discretion.
-
-   Go to https://github.com/visulima/visulima/pulls and open a new pull request with your changes.
-   If your PR is connected to an open issue, add a line in your PR's description that says `Fixes: #123`, where `#123` is the number of the issue you're fixing.

Once you've filed the PR:

-   Barring special circumstances, maintainers will not review PRs until all checks pass.
-   One or more maintainers will use GitHub's review feature to review your PR.
-   If the maintainer asks for any changes, edit your changes, push, and ask for another review. Additional tags (such as `needs-tests`) will be added depending on the review.
-   If the maintainer decides to pass on your PR, they will thank you for the contribution and explain why they won't be accepting the changes. That's ok! We still really appreciate you taking the time to do it, and we don't take that lightly. 💚
-   If your PR gets accepted, it will be marked as such, and merged into the `main` branch soon after.
    Your contribution will be distributed to the masses with our [release process](#release-process).

### <a name="deprecation-workflow"></a> Deprecation Workflow

<!--
Modified copy of https://github.com/faker-js/faker/blob/next/CONTRIBUTING.md#deprecation-workflow

MIT License
Faker - Copyright (c) 2022-2024
-->

If you ever find yourself deprecating something in the source code, you can follow these steps to save yourself (and the reviewers) some trouble.

1.  **Use JSDoc `@deprecated` tag:** Add a `@deprecated` tag to the JSDoc block of the code being deprecated. Include a message explaining why it's deprecated and what should be used as a replacement.
2.  **Reference Replacement (if any):** If there's a direct replacement, use the `@see` tag or mention it in the deprecation message to guide developers to the new code.
3.  **Communicate the Change:** Ensure the deprecation and its replacement are clearly communicated in Pull Request descriptions and relevant team discussions to facilitate a smooth transition.

Example:
```ts
/**
 * Old utility function for formatting dates.
 * @deprecated As of [Date or Version], this function is deprecated. Please use `newDateFormatter()` from `utils/date-helpers.ts` instead.
 * @see newDateFormatter
 */
function oldDateUtility() {
  // ...
}
```

### <a name="major-version-docs"></a> Documenting changes for new major versions

Since `semantic-release` automatically generates changelogs (e.g., on GitHub Releases) from [Conventional Commits](#committing), a separate `UPGRADE.MD` file for major versions is generally not maintained for this application.

The key to documenting significant changes, especially breaking changes that affect other developers on the team, lies in the commit messages themselves:

-   **Breaking Changes:** If your contribution introduces a breaking change (a change that would require other developers working on the application to modify their existing code or approach), you MUST clearly indicate this in your commit message. This is typically done by:
    -   Appending an `!` after the type/scope (e.g., `feat(auth)!: overhaul user session management`).
    -   Including a footer in the commit message starting with `BREAKING CHANGE:`, followed by a detailed explanation of the change and any necessary migration guidance for other developers.
-   **Deprecations:** For features or components being deprecated, follow the [Deprecation Workflow](#deprecation-workflow) and ensure your commit messages (e.g., using `refactor` or `feat` with a clear description) reflect these changes.

`semantic-release` will use this information to correctly version the application and include details of breaking changes and significant features in the automatically generated release notes. This serves as the primary record of changes between versions for the development team.

### <a name="js-docs"></a> JSDocs

Comprehensive JSDoc comments are crucial for packages and libraries to ensure they are understandable, maintainable, and easy for consumers to use. All code intended for export and public consumption MUST be accompanied by clear JSDoc.

**General Principles:**

*   **Clarity and Purpose:** The primary goal is to make the code's API and behavior transparent to other developers and consumers. Prefer clear, well-named variables and functions, which can reduce the need for overly verbose comments. Use comments to explain *why* something is done (especially for complex decisions) and to clarify *how* for non-obvious implementations.
*   **Audience:** Write JSDoc with the consumer of the package/library in mind.
*   **Keep Up-to-Date:** JSDoc MUST be kept synchronized with any code changes. Outdated documentation is often worse than no documentation.

**What MUST be Documented:**

*   All exported functions, classes, methods, constants, types, and interfaces.
*   Complex or non-obvious internal logic within functions or components should also be clarified with comments (either JSDoc or standard block/line comments).

**Required JSDoc Tags and Content for Exported Members:**

For anything exported from a package, JSDoc should generally include the following:

1.  **Description:** A clear, concise summary of what the code does. Start with a strong verb.
2.  **`@param {type} name - Description`**: For functions or methods, document each parameter:
    *   Its type (e.g., `{string}`, `{number[]}`, `{MyInterface}`).
    *   Its name.
    *   A clear description of its purpose.
    *   If the parameter is optional, indicate this (e.g., `options?` or in the description).
    *   If it has a default value, mention it: `Defaults to \`defaultValue\`.`
3.  **`@returns {type} - Description`**: For functions or methods that return a value:
    *   The type of the returned value.
    *   A clear description of what the returned value represents.
4.  **`@throws {ErrorType} - Condition when thrown`**: If a function is designed to throw specific, documented errors under certain conditions.
5.  **`@example`**: Provide one or more usage examples, especially for functions and classes. Examples should be simple, illustrative, and runnable if possible.
    ```ts
    /**
     * ...
     * @example
     * ```ts
     * const result = myFunction('test');
     * console.log(result); // Expected output
     * ```
     */
    ```
6.  **`@deprecated`**: If the API is being deprecated.
    *   Include the version or timeframe of deprecation.
    *   State the reason for deprecation.
    *   Provide a clear pointer to the recommended replacement API using `@see` or in the description.
    ```ts
    /**
     * @deprecated Since v2.0.0. Use `newShinyFunction()` instead.
     * @see newShinyFunction
     */
    ```
7.  **`@see`**: To reference related parts of the API, external documentation, or the replacement for a deprecated feature.
8.  **`@since {version}`**: The version of the package when this API member was introduced. This is very helpful for users tracking changes across versions.

**Formatting and Style Conventions:**

*   **Multiline JSDocs:** Always use multiline JSDoc comments (`/** ... */`) for exported members.
    ```ts
    /**
     * This is a good JSDoc description.
     */
    function anExportedFunction() {
        // implementation
    }
    ```
*   **Start with Description:** The JSDoc block should begin with a concise description of the element.
*   **Tag Order:** While `eslint-plugin-jsdoc` (if used in the project) might enforce a specific order, a common logical order is: description, `@since`, `@deprecated`, `@param`, `@returns`, `@throws`, `@example`, `@see`. Consistency is key.
*   **Blank Lines:** Use blank lines to separate the main description from the block of tags, and consider separating logical groups of tags (e.g., all `@param` tags together, then `@returns`, then `@example`).
*   **Grammar and Punctuation:** Sentences should end with a period. Strive for clear and grammatically correct English.

**Example of a Well-Documented Function:**

```ts
/**
 * Calculates the sum of two numbers and returns the result.
 *
 * @since 1.0.0
 * @param {number} a - The first number.
 * @param {number} b - The second number.
 *
 * @returns {number} - The sum of `a` and `b`.
 *
 * @example
 * ```ts
 * const total = add(5, 3);
 * console.log(total); // Output: 8
 * ```
 */
export function add(a: number, b: number): number {
  return a + b;
}
```

Adhering to these JSDoc guidelines will significantly improve the quality and usability of your packages and libraries.

## Committing

To ensure consistency throughout the source code, keep these rules in mind as you are working:

<!--
Modified copy of https://github.com/faker-js/faker/blob/next/CONTRIBUTING.md#committing

MIT License
Faker - Copyright (c) 2022-2024
-->

We have very precise rules over how our Git commit messages must be formatted.
This format leads to **easier to read commit history**.

Each commit message consists of a **header**, a **body**, and a **footer**.

```
<header>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The `header` is mandatory and must conform to the [Commit Message Header](#commit-header) format.

The `body` is mandatory for all commits except for those of type "docs".
When the body is present it must be at least 20 characters long and must conform to the [Commit Message Body](#commit-body) format.

The `footer` is optional. The [Commit Message Footer](#commit-footer) format describes what the footer is used for and the structure it must have.

### <a name="commit-header"></a> `PR titles` and `Commit Message Headers` are written using the following convention:

> Titles following the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/).

```
<type>(<scope>): <short summary>
  │       │             │
  │       │             └─⫸ Summary in present tense. Not capitalized. No period at the end.
  │       │
  │       └─⫸ Commit Scope: \<packagename\>|deps|revert|release
  │
  │
  └─⫸ Commit Type: build|ci|docs|feat|fix|perf|infra|refactor|test
```

**type** is required and indicates the intent of the PR

> The types `feat` and `fix` will be shown in the changelog as `### Features` or `### Bug Fixes`
> All other types won't show up except for breaking changes marked with the `!` in front of `:`

Allowed types are:

| type     | description                                                                         |
| -------- | ----------------------------------------------------------------------------------- |
| build    | Build scripts were changed                                                          |
| chore    | No user affected code changes were made                                             |
| ci       | CI were changed                                                                     |
| docs     | Docs were changed                                                                   |
| feat     | A new feature is introduced                                                         |
| fix      | A bug was fixed                                                                     |
| infra    | Infrastructure related things were made (e.g. issue-template was updated)           |
| perf     | Performance improvements to the codebase                                            |
| refactor | A refactoring that affected also user (e.g. log a deprecation warning)              |
| revert   | A revert was triggered via git                                                      |
| style    | Code style changes (formatting, white-space, etc.) that do not affect functionality |
| test     | Adding missing tests or correcting existing tests                                   |

**scope** is optional and indicates the scope of the PR

> The scope will be shown in the changelog in front of the _subject_ in bold text
> Also as the commits are sorted alphabetically, the scope will group the commits indirectly into categories

Allowed scopes are:

| scope           | description                                          |
| --------------- | ---------------------------------------------------- |
| \<packagename\> | The specific module name that was affected by the PR |
| deps            | Will mostly be used by Renovate                      |
| release         | Will be set by release process                       |
| revert          | When a revert was made via git                       |

> The scope is not checkable via `Semantic Pull Request` action as this would limit the scopes to only existing modules,
> but if we add a new package like `fs`, then the PR author couldn't use the new package name as scope.
> As such, we (the Visulima team) must be mindful of valid scopes, and we reserve the right to edit titles as we see fit.

Some examples of valid pull request titles:

```shell
# Root package
feat: add casing option
fix: lower target to support Webpack 4
chore: add naming convention rule
docs: remove unused playground
test: validate @see contents
ci: allow breaking change commits
build: add node v18 support
infra: rework bug-report template
revert: add more arabic names dataset (#362)

# Commit or PR for a package
feat(locale): extend test class
refactor(location): deprecate location function
fix(<package_name>)): lower target to support Webpack 4
chore(<package_name>): add naming convention rule
docs(<package_name>): remove unused playground
test(<package_name>): validate @see contents
ci(<package_name>): allow breaking change commits
build(<package_name>): add node v18 support
infra(<package_name>): rework bug-report template
revert(<package_name>): add more arabic names dataset (#362)

# A release will look like this
chore(release): 7.4.0

# Renovate automatically generates these
chore(deps): update devdependencies
chore(deps): update typescript-eslint to ~5.33.0
```

##### Summary

Use the summary field to provide a succinct description of the change:

-   use the imperative, present tense: "change" not "changed" nor "changes"
-   don't capitalize the first letter
-   no dot (.) at the end

> Please note that the PR title should not include a suffix of e.g. `(#123)` as this will be done automatically by GitHub while merging

### <a name="commit-body"></a>Commit Message Body

Just as in the summary, use the imperative, present tense: "fix" not "fixed" nor "fixes".

Explain the motivation for the change in the commit message body. This commit message should explain _why_ you are making the change.
You can include a comparison of the previous behavior with the new behavior in order to illustrate the impact of the change.

### <a name="commit-footer"></a>Commit Message Footer

The footer can contain information about breaking changes and deprecations and is also the place to reference GitHub issues, Jira tickets, and other PRs that this commit closes or is related to.
For example:

```
BREAKING CHANGE: <breaking change summary>
<BLANK LINE>
<breaking change description + migration instructions>
<BLANK LINE>
<BLANK LINE>
Fixes #<issue number>
```

or

```
DEPRECATED: <what is deprecated>
<BLANK LINE>
<deprecation description + recommended update path>
<BLANK LINE>
<BLANK LINE>
Closes #<pr number>
```

Breaking Change section should start with the phrase "BREAKING CHANGE: " followed by a summary of the breaking change, a blank line, and a detailed description of the breaking change that also includes migration instructions.

Similarly, a Deprecation section should start with "DEPRECATED: " followed by a short description of what is deprecated, a blank line, and a detailed description of the deprecation that also mentions the recommended update path.

### Revert commits

If the commit reverts a previous commit, it should begin with `revert: `, followed by the header of the reverted commit.

The content of the commit message body should contain:

-   information about the SHA of the commit being reverted in the following format: `This reverts commit <SHA>`,
-   a clear description of the reason for reverting the commit message.

## Provide Support on GitHub Discussions

[Needs Collaborator](#join-the-project-team): none

Helping out other users with their questions is a really awesome way of contributing to any community.
It's not uncommon for most of the issues or discussions on an open source projects being support-related questions by users trying to understand something they ran into, or find their way around a known bug.

Sometimes, a `Q&A` discussion turns out to actually be other things, like bugs or feature requests.
In that case, suss out the details with the person who filed the original issue, add a comment explaining what the bug is, and change the label from `support` to `"s: pending triage", "c: bug"` or `"s: pending triage", "c: feature", "s: waiting for user interest"`.
If you can't do this yourself, @mention a maintainer so they can do it.

In order to help other folks out with their questions:

-   Go to the GitHub discussions and [open the Q&A category](https://github.com/visulima/visulima/discussions/categories/q-a).
-   Read through the list until you find something that you're familiar enough with to give an answer to.
-   Respond to the discussion with whatever details are needed to clarify the question, or get more details about what's going on.
-   Once the discussion wraps up and things are clarified, either close the issue, or ask the original issue filer (or a maintainer) to close it for you.

Some notes on picking up support discussion:

-   Avoid responding to issues you don't know you can answer accurately.
-   As much as possible, try to refer to past issues or discussion with accepted answers. Link to them from your replies with the `#123` format.
-   Be kind and patient with users -- often, folks who have run into confusing things might be upset or impatient.
    This is ok.
    Try to understand where they're coming from, and if you're too uncomfortable with the tone, feel free to stay away or withdraw from the issue. (note: if the user is outright hostile or is violating the CoC, [refer to the Code of Conduct](https://github.com/visulima/visulima/blob/main/.github/CODE_OF_CONDUCT.md) to resolve the conflict).

## Label Issues

[Needs Collaborator](#join-the-project-team): Issue Tracker

One of the most important tasks in handling issues is labeling them usefully and accurately. All other tasks involving issues ultimately rely on the issue being classified in such a way that relevant parties looking to do their own tasks can find them quickly and easily.

In order to label issues, [open up the list of unlabeled issues](https://github.com/visulima/visulima/issues?q=is%3Aopen+is%3Aissue+no%3Alabel) and, **from newest to oldest**, read through each one and apply issue labels according to the table below. If you're unsure about what label to apply, skip the issue and try the next one: don't feel obligated to label each and every issue yourself!

| Label                          | Apply When                                                                       | Notes                                                                                                                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `s: needs decision`            | Needs team/maintainer decision                                                   |                                                                                                                                                                                                                                                                        |
| `s: needs proposal`            | Requires a detailed proposal before proceeding                                   |                                                                                                                                                                                                                                                                        |
| `s: needs design`              | Requires design work or input before proceeding                                  |                                                                                                                                                                                                                                                                        |
| `s: accepted`                  | Accepted feature / Confirmed bug                                                 |                                                                                                                                                                                                                                                                        |
| `s: awaiting more info`        | Additional information are requested                                             |                                                                                                                                                                                                                                                                        |
| `s: invalid`                   | This doesn't seem right                                                          |                                                                                                                                                                                                                                                                        |
| `s: on hold`                   | Blocked by something or frozen to avoid conflicts                                |                                                                                                                                                                                                                                                                        |
| `s: pending triage`            | Pending Triage                                                                   |                                                                                                                                                                                                                                                                        |
| `s: waiting for user interest` | Waiting for more users interested in this feature                                |                                                                                                                                                                                                                                                                        |
| `s: wontfix`                   | This will not be worked on                                                       | The issue or PR should be closed as soon as the label is applied, and a clear explanation provided of why the label was used. Contributors are free to contest the labeling, but the decision ultimately falls on committers as to whether to accept something or not. |
| `question`                     | Further information is requested                                                 |                                                                                                                                                                                                                                                                        |
| `p: 1-normal`                  | Nothing urgent                                                                   |                                                                                                                                                                                                                                                                        |
| `p: 2-high`                    | Fix main branch                                                                  |                                                                                                                                                                                                                                                                        |
| `p: 3-urgent`                  | Fix and release ASAP                                                             |                                                                                                                                                                                                                                                                        |
| `needs test`                   | More tests are needed                                                            |                                                                                                                                                                                                                                                                        |
| `needs rebase`                 | There is a merge conflict                                                        |                                                                                                                                                                                                                                                                        |
| `c: bug`                       | Something isn't working                                                          |                                                                                                                                                                                                                                                                        |
| `c: chore`                     | PR that doesn't affect the runtime behavior                                      |                                                                                                                                                                                                                                                                        |
| `c: docs`                      | Improvements or additions to documentation                                       |                                                                                                                                                                                                                                                                        |
| `c: dependencies`              | Pull requests that adds/updates a dependency                                     |                                                                                                                                                                                                                                                                        |
| `c: feature`                   | Request for new feature                                                          |                                                                                                                                                                                                                                                                        |
| `c: infra`                     | Changes to our infrastructure or project setup                                   |                                                                                                                                                                                                                                                                        |
| `c: refactor`                  | PR that affects the runtime behavior, but doesn't add new features or fixes bugs |                                                                                                                                                                                                                                                                        |
| `c: security`                  | Indicates a vulnerability                                                        |                                                                                                                                                                                                                                                                        |
| `deprecation`                  | A deprecation was made in the PR                                                 |                                                                                                                                                                                                                                                                        |
| `do NOT merge yet`             | Do not merge this PR into the target branch yet                                  |                                                                                                                                                                                                                                                                        |
| `duplicate`                    | Duplicate of another issue/PR                                                    | Duplicate issues should be marked and closed right away, with a message referencing the issue it's a duplicate of (with `#123`).                                                                                                                                       |
| `good first issue`             | Good for newcomers                                                               |                                                                                                                                                                                                                                                                        |
| `has workaround`               | Workaround provided or linked                                                    |                                                                                                                                                                                                                                                                        |
| `help wanted`                  | Extra attention is needed                                                        |                                                                                                                                                                                                                                                                        |
| `breaking change`              | Cannot be merged when next version is not a major release                        |                                                                                                                                                                                                                                                                        |

## Clean Up Issues and PRs

[Needs Collaborator](#join-the-project-team): Issue Tracker

Issues and PRs can go stale after a while. Maybe they're abandoned. Maybe the team will just plain not have time to address them any time soon.

In these cases, they should be closed until they're brought up again or the interaction starts over.

To clean up issues and PRs:

-   Search the issue tracker for issues or PRs, and add the term `updated:<=YYYY-MM-DD`, where the date is 30 days before today.
-   Go through each issue _from oldest to newest_, and close them if **All the following are true**:
    -   not opened by a maintainer
    -   not marked as `p: 3-urgent`
    -   not marked as `good first issue` or `help wanted` (these might stick around for a while, in general, as they're intended to be available)
    -   no explicit messages in the comments asking for it to be left open
    -   does not belong to a milestone
-   Leave a message when closing saying "Cleaning up stale issue. Please reopen or ping us if and when you're ready to resume this. See https://github.com/visulima/visulima/blob/latest/CONTRIBUTING.md#clean-up-issues-and-prs for more details."

## Review Pull Requests

[Needs Collaborator](#join-the-project-team): Issue Tracker

While anyone can comment on a PR, add feedback, etc., PRs are only _approved_ by team members with Issue Tracker or higher permissions.

PR reviews use [GitHub's own review feature](https://help.github.com/articles/about-pull-request-reviews/), which manages comments, approval, and review iteration.

Some notes:

-   You may ask for minor changes ("nitpicks"), but consider whether they are really blockers to merging: try to err on the side of "approve, with comments".
-   _ALL PULL REQUESTS_ should be covered by a test: either by a previously-failing test, an existing test that covers the entire functionality of the submitted code, or new tests to verify any new/changed behavior. All tests must also pass and follow established conventions. Test coverage should not drop, unless the specific case is considered reasonable by maintainers.
-   Please make sure you're familiar with the code or documentation being updated, unless it's a minor change (spellchecking, minor formatting, etc). You may @mention another project member who you think is better suited for the review, but still provide a non-approving review of your own.
-   Be extra kind: people who submit code/doc contributions are putting themselves in a pretty vulnerable position, and have put time and care into what they've done (even if that's not obvious to you!) -- always respond with respect, be understanding, but don't feel like you need to sacrifice your standards for their sake, either. Just don't be a jerk about it?

## Merge Pull Requests

[Needs Collaborator](#join-the-project-team): Committer

PR merge are only done by team members with Committer permission or owning the project.
It's a critical part of the contribution flow as this is where code contribution are being added to the main branch.
Before merging any PR, define what is the best way to do it for the project: should you merge or rebase the approved PR into the `main` branch.
Ensure that the PR have no conflicts with the base branch, and if so, either ask the committer to fix it by submitting a new PR or fix it yourself if you have the capacity.

Some notes:

-   Merge only the PR that have been [reviewed](#review-pull-requests) and approved.
-   Validate that all approbation criteria have been met (mistakes happen): covered by tests, commit message respect the convention...
-   If you merge instead or rebasing the PRs, please add a meaningful comment.

## Release process

[Needs Collaborator](#join-the-project-team): Committer

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) to automate the entire package release workflow including: determining the next version number, generating the release notes, and publishing the package.

Because of this automation, it is crucial that all contributions merged into the main branch adhere to the [Conventional Commits specification](https://www.conventionalcommits.org/) (as detailed in the [Committing](#committing) section). The commit messages dictate how `semantic-release` versions the software and generates changelogs.

Prerequisites for a commit to be included in a release (typically enforced before merging a Pull Request):

-   **Adherence to Conventional Commits:** Commit messages on the main branch *must* follow the Conventional Commits format.
-   **All Automated Workflows Must Pass:** All CI checks (linting, building, automated tests, etc.) configured for the project must pass.
-   **Successful Code Review:** Contributions must undergo and pass a code review by at least one maintainer or designated reviewer.
-   **Comprehensive Tests:** All existing tests must pass. New functionality should be accompanied by new tests, and bug fixes should include tests that demonstrate the fix.

When commits are merged to the main branch (e.g., `main`, `alpha`), `semantic-release` will automatically run (usually in a CI environment), analyze the commits since the last release, and if new releasable changes are found, it will:

1.  Determine the new semantic version (e.g., `v1.2.3`).
2.  Create a Git tag for the new version.
3.  Generate release notes based on the commit messages.
4.  Publish the release (e.g., to GitHub Releases, npm registry if applicable).

There is typically no manual intervention needed for the release process itself once `semantic-release` is configured and running, provided all pre-merge requirements are met.

## Join the Project Team

### Ways to Join

There are many ways to contribute! Most of them don't require any official status unless otherwise noted. That said, there's a couple of positions that grant special repository abilities, and this section describes how they're granted and what they do.

All the below positions are granted based on the project team's needs, as well as their consensus opinion about whether they would like to work with the person and think that they would fit well into that position. The process is relatively informal, and it's likely that people who express interest in participating can just be granted the permissions they'd like.

You can spot a collaborator on the repo by looking for the `[Collaborator]` or `[Owner]` tags next to their names.

| Permission    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Issue Tracker | Granted to contributors who express a strong interest in spending time on the project's issue tracker. These tasks are mainly [labeling issues](#label-issues), [cleaning up old ones](#clean-up-issues-and-prs), and [reviewing pull requests](#review-pull-requests), as well as all the usual things non-team-member contributors can do. Issue handlers should not merge pull requests, tag releases, or directly commit code themselves: that should still be done through the usual pull request process. Becoming an Issue Handler means the project team trusts you to understand enough of the team's process and context to implement it on the issue tracker. |
| Committer     | Granted to contributors who want to handle the actual pull request merges, tagging new versions, etc. Committers should have a good level of familiarity with the codebase, and enough context to understand the implications of various changes, as well as a good sense of the will and expectations of the project team.                                                                                                                                                                                                                                                                                                                                              |
| Admin/Owner   | Granted to people ultimately responsible for the project, its community, etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
