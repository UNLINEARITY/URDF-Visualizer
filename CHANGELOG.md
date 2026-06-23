# Changelog

All notable changes to this project will be documented in this file.

本文件遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 的结构，并按 [Semantic Versioning](https://semver.org/) 记录版本。`v0.1.0` 条目是基于当前 `0.1.0` 包元数据、整理后的 Git 历史和 Web 应用功能面建立的初始正式发布基线。

## [Unreleased]

No unreleased changes are recorded yet.

## [0.1.0] - 2026-05-01

### Added

- Added Git information governance with a commit-ready entry in `git-log.md`.
- Added this changelog as the canonical release history index.
- Added `docs/releases/README.md` and `docs/releases/v0.1.0.md` for user-readable release notes.
- Added `CONTRIBUTING.md` with commit message rules, branch flow, release preparation, and history-safety guidance.
- Added CI for pull requests and pushes to `main` / `Web`.
- Added tag-driven GitHub Release automation for `v*.*.*` tags and packaged Web builds.
- Initial browser-based URDF Visualizer application built with React, Three.js, TypeScript, and Vite.
- Client-side URDF loading and Xacro parsing, including recursive include flattening for project-style Xacro models.
- Sample model library with bundled URDF/Xacro assets and mesh resources, including robot examples such as Go2, G1, Cassie, spider robot, fractal robot, and material-library samples.
- Local import workflows for single `.urdf` / `.xacro` files, full project folders, and drag-and-drop folders.
- ROS-style asset resolution for `package://` paths and relative mesh paths in uploaded or bundled model structures.
- Mesh rendering support for STL, DAE, and OBJ assets through Three.js loaders.
- Interactive 3D inspection with link selection, joint selection, joint sliders, draggable popups, global/local transform data, RPY angles, and quaternion values.
- Display controls for world axes, grid, link frames, joint frames, wireframe mode, and shadow rendering.
- Fullscreen kinematic structure tree with link/joint hierarchy, node selection, folding, selection synchronization, and joint detail panels.
- Measurement mode for picking model surface or joint-center points, rendering segment distances, and removing measurement points.
- Build and deployment scripts for static web distribution and GitHub Pages deployment.

### Changed

- Aligned `package.json` and `package-lock.json` from `0.0.0` to the draft `0.1.0` release baseline.
- Tightened generated-file hygiene by ignoring Tauri `target` output and generated schema files.
- Fixed repository text normalization rules so text files stay LF-normalized while binary assets are excluded.
- No application runtime behavior changes are included in this governance and release-preparation update.

### Fixed

- Fixed multiple model loading and Xacro parsing issues recorded in the Git history, including static asset loading, package path handling, and larger Xacro project rendering.
- Fixed joint/link selection and highlighting behavior across tree graph and 3D scene workflows.
- Fixed coordinate-axis display and interaction details, including Z/Y axis alignment and local/world frame display corrections.
- Fixed tree graph styling, drag behavior, node interaction, and state persistence issues.
- Blocked accidental browser refresh via `Ctrl + R` during model inspection workflows.

### Removed

- Removed the earlier backend dependency so the application can run as a static browser application.
- Removed some bundled sample content during repository cleanup before the initial release baseline.

### Notes

- This is the first formal release baseline and is intended to be published from the `v0.1.0` tag.
- No breaking migration is listed because this is the first documented release baseline.
