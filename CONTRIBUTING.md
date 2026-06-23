# Contributing

This project uses a lightweight Git flow. Keep changes small, document release impact clearly, and avoid rewriting shared history.

## Commit Messages

Use Conventional Commits:

```text
<type>(optional-scope): <short summary>
```

Recommended types:

- `feat`: user-visible feature or workflow
- `fix`: bug fix or behavior correction
- `docs`: documentation-only change
- `test`: tests or test data only
- `refactor`: code structure change without intended behavior change
- `chore`: maintenance work
- `build`: dependency, package, or build pipeline change
- `ci`: automation or CI change

Examples:

```text
feat: add measurement mode for robot model distances
fix: prevent browser refresh during model inspection
docs: add initial release governance documents
```

Write the summary in the imperative mood when practical, keep it under about 72 characters, and describe the user-visible outcome before implementation details. If the change affects release behavior, compatibility, deployment, or migration, mention that in the commit body or pull request description.

## Branch Flow

- Start from an up-to-date `main` unless maintainers ask for another base.
- Treat `main` as the canonical source branch for Web releases.
- Treat `Web` as a legacy or feature branch until its divergence from `main` is resolved.
- Treat `gh-pages` as a generated deployment branch, not a source-editing branch.
- Use short topic branches such as `feat/measurement-mode`, `fix/xacro-loading`, or `docs/release-notes`.
- Keep unrelated changes in separate branches and pull requests.
- Before opening a pull request, check the working tree and avoid including generated or unrelated files.
- If other contributors have uncommitted or untracked files in the workspace, do not remove, reset, or overwrite them.

## Local Checks

Use the project scripts from `package.json`:

```bash
npm install
npm run dev
npm run build
npm run preview
```

`npm run build` runs the manifest scan, TypeScript compilation, and Vite production build. If a change only updates documentation, explain that no application build was required.

## Release Process

1. Confirm the intended version in `package.json`.
2. Review Git history since the previous release tag.
3. Update `CHANGELOG.md` under `Unreleased` and the target version section.
4. Add or update `docs/releases/vX.Y.Z.md` with user-facing release notes.
5. Verify the production build from a clean working tree.
6. Create an annotated tag such as `v0.1.0` from the intended release commit.
7. Push the tag to trigger the GitHub Release workflow.
8. Publish or deploy with the existing project release path, including `npm run deploy` when updating GitHub Pages.

If a release note is prepared before the tag exists, mark it as a draft and include the exact baseline commit used.

## History Safety

- Do not force-push shared branches unless maintainers explicitly approve it.
- Do not amend commits that have already been pushed for review unless the branch owner agrees.
- Do not use destructive cleanup commands such as hard resets to remove someone else's work.
- Prefer merge or rebase only when the branch owner and maintainer agree on the strategy.
- Preserve old release notes and changelog entries; add corrections as new notes unless a maintainer asks for a targeted edit.
- Treat untracked files and unrelated local modifications as someone else's work unless you created them in the current task.
