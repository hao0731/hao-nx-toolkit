# Issue tracker: GitHub

Issues and specs live in GitHub Issues for `hao0731/hao-nx-toolkit`.
Use the `gh` CLI for all operations.

## Conventions

Run commands inside this clone so `gh` resolves the repository
from its Git remote. Outside the clone, pass
`--repo hao0731/hao-nx-toolkit`.

- Create: `gh issue create --title "..." --body-file <file>`
- Read: `gh issue view <number> --json number,title,body,labels,comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
  with appropriate label and state filters.
- Comment: `gh issue comment <number> --body-file <file>`
- Apply labels: `gh issue edit <number> --add-label "..."`
- Remove labels: `gh issue edit <number> --remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

For multiline bodies, write the exact text to a temporary file
and pass it with `--body-file`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read the GitHub issue using the command above.
