# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.11] - 2026-11-03

### Added

- On-demand recursive user folder inventories, including received shares and available external mounts, with explicit completeness reporting.
- Per-tab CSV column selection and PDF reports through the browser print dialog.
- PHP, browser and real Nextcloud integration regression tests.

### Security

- Restrict all audit routes and exports to authenticated administrators.
- Remove public share tokens from audit responses and neutralize spreadsheet formulas in CSV exports.
- Refresh development dependencies and require security-patched PHP; remove unused Vue/Vite dependencies.

### Fixed

- Align the Composer lock with Nextcloud 33, replace template CI with project-specific checks on standard runners, and retain scheduled Dependabot updates.
- Fetch all user/group pages and prevent stale requests from replacing a newer tab.
- Replace the obsolete AppTemplate test bootstrap and OpenAPI example.
