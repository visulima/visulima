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

<\**ORGANIZATIONS*uppercase\*> has adopted the [Contributor Covenant](https://www.contributor-covenant.org/) as its Code of Conduct, and we expect project participants to adhere to it.
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
If nobody is working on it at the moment, please leave a comment stating that you intend to work on it so other people don’t accidentally duplicate your effort.

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

## Contribute Documentation

Documentation is a super important, critical part of this project. Docs are how we keep track of what we're doing, how, and why. It's how we stay on the same page about our policies. And it's how we tell others everything they need in order to be able to use this project -- or contribute to it. So thank you in advance.

Documentation contributions of any size are welcome! Feel free to file a PR even if you're just rewording a sentence to be more clear, or fixing a spelling mistake!

To contribute documentation:

-   [Set up the project](#project-setup).
-   Edit or add any relevant documentation.
-   Make sure your changes are formatted correctly and consistently with the rest of the documentation.
-   Re-read what you wrote, and run a spellchecker on it to make sure you didn't miss anything.
-   Write clear, concise commit message(s) using [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/). Documentation commits should use `docs(<component>): <message>`, visit the [Committing](#committing) section for more information.
-   Go to https://github.com/<**ORGANIZATIONS**>/<**REPOSITORY_NAME**>/pulls and open a new pull request with your changes.
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
-   Go to https://github.com/<**ORGANIZATIONS**>/<**REPOSITORY_NAME**>/pulls and open a new pull request with your changes.
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

Add a `@deprecated` parameter to the end of the JSDoc with a human-readable description message with a suitable replacement for the deprecated function.
Lastly, add a `@see` parameter to the JSDoc with a link to the replacement (if it exists).

Example:

```ts
/**
 * @deprecated Use `new function/class` instead.
 */
```

### <a name="major-version-docs"></a> Documenting changes for new major versions

<!--
Modified copy of https://github.com/faker-js/faker/blob/next/CONTRIBUTING.md#documenting-changes-for-new-major-versions

MIT License
Faker - Copyright (c) 2022-2024
-->

Each major version has an upgrading guide `UPGRADE.md`.

While developing new features and fixing bugs for a new release, changes are added to the migration guide to aid developers when the version is released.

The general principle is to document anything which requires a normal user of the package to change their code, when upgrading to the new major version.

There are two sections:

-   Breaking changes (user MUST change their code)
-   Deprecations and other changes (user SHOULD change their code, but it will still work for this major version even if they don't)

Not every change needs to be in the migration guide. If it is too long, it becomes hard for users to spot the important changes.

### <a name="js-docs"></a> JSDocs

<!--
Modified copy of https://github.com/faker-js/faker/blob/next/CONTRIBUTING.md#jsdocs

MIT License
Faker - Copyright (c) 2022-2024
-->

JSDoc are comments above any code structure (variable, function, class, etc.) that begin with `/**` and end with `*/`. Multiline comments start (if not being the start or end line) with a `*`.
For more info checkout [jsdoc.app](https://jsdoc.app/about-getting-started.html).

JSDoc will be read and automatically processed by `generate:api-docs` and therefore need to follow some project conventions. Other standards are in place because we think they increase the code quality.

> We have a small set of JSDoc tags that all methods should have.

-   Description
-   `@param` - If the method has parameters
-   `@see` - If there are other important methods
-   `@example` - Example calls without and with parameters, including a sample result of each call
-   `@since` - The version this method was added (or is likely to be added)
-   `@deprecated` - If the method is deprecated, with additional information about replacements

<table>
<tr>
<th>Do</th>
<th>Dont</th>
</tr>
<tr>
<td>

```ts
/**
 * This is a good JSDoc description for a method that generates foos.
 *
 * @param options The optional options to use.
 * @param options.test The parameter to configure test. Defaults to `'bar'`.
 *
 * @see helper.fake
 *
 * @example
 * foo() // 'foo'
 * foo({ test: 'oof' }) // 'of'
 *
 * @since 7.5.0
 *
 * @deprecated Use `random()` instead.
 */
function foo(options: { test: string } = {}): string {
    // implementation
}
```

</td>
<td>

```ts
/**
 * This is a bad JSDoc description.
 *
 * @return foo
 */
function foo(options: { test: string }) {
    // implementation
}
```

</td>
</tr>
</table>

> We use eslint-plugin-jsdoc to test for basic styling and sorting of doc-tags.

This is in place so all JSDoc tags will get sorted automatically, so you don't have to bother with it. This also means that most rules in this section can get auto fixed by the eslint formatter.

> JSDocs should always be multiline

While single line JSDoc are technically valid, we decided to follow this rule since it makes changes in the git diff much more clear and easier to understand.

<table>
<tr>
<th>Do</th>
<th>Dont</th>
</tr>
<tr>
<td>

```ts
/**
 * This is a good JSDoc description.
 */
function foo() {
    // implementation
}
```

</td>
<td>

```ts
/** This is a bad JSDoc description. */
function foo() {
    // implementation
}
```

</td>
</tr>
</table>

> Everything that can be accessed directly by a user should have JSDoc.

This rule is aimed to target anything that is exported from a package. This includes types, interfaces, functions, classes and variables. So if you introduce anything new that is not internal, write JSDoc for it.

> If a `@param` has a default value, it needs to be mentioned at the end of the sentence.

```ts
/**
 * This is a good JSDoc description.
 *
 * @param bar this is a parameter description. Defaults to `0`.
 */
function foo(bar: number = 0) {
    // implementation
}
```

> If a function can throw an error (Error) you have to include the `@throws` tag with an explanation when an error could be thrown

```ts
/**
 * This is a good JSDoc description.
 *
 * @param bar this is a parameter description. Defaults to `0`.
 *
 * @throws If bar is negative.
 */
function foo(bar: number = 0) {
    // implementation
}
```

> Sentences should always end with a period.

This rule ensures minimal grammatical correctness in the comments and ensures that all comments look the same.

> Different tags have to be separated by an empty line.

This rule improves the comments readability by grouping equivalent tags and making them more distinguishable from others.

<table>
<tr>
<th>Do</th>
<th>Dont</th>
</tr>
<tr>
<td>

```ts
/**
 * This is a good JSDoc block, because it follows the our preferences.
 *
 * @param bar The first argument.
 * @param baz The second argument.
 *
 * @example foo(1, 1) // [1, 1]
 * @example foo(13, 56) // [13, 56]
 */
function foo(bar: number, baz: number): [number, number] {
    // implementation
}
```

</td>
<td>

```ts
/**
 * This is a bad JSDoc block, because it has no linebreaks between sections.
 * @param bar The first argument.
 * @param baz The second argument.
 * @example foo(1, 1) // [1, 1]
 * @example foo(13, 56) // [13, 56]
 */
function foo(bar: number, baz: number): [number, number] {
    // implementation
}
```

</td>
</tr>
</table>

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

### <a name="commit-header"></a> `PR titles` or `Commit Message Header` are written in following convention:

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
-   Leave a message when closing saying "Cleaning up stale issue. Please reopen or ping us if and when you're ready to resume this. See https://github.com/<**ORGANIZATIONS**>/<**REPOSITORY_NAME**>/blob/latest/CONTRIBUTING.md#clean-up-issues-and-prs for more details."

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

TBD - need to hash out a bit more of this process. The most important bit here is probably that all tests must pass, and tags must use [semver](https://semver.org).

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
