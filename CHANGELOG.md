# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.14] - 2026-11-03

### Changed

- Automatically load readable first-level user folders with four concurrent background requests; omit nested folders and the root entry.
- Remove UID, Provider, Backend and Enabled from the Users table and browser exports.
- Apply the per-tab column selector to both CSV and PDF exports; allow PDF without folders when that column is excluded.

## [0.0.13] - 2026-11-03

### Fixed

- Use 500-row API pages to respect Nextcloud 35's default pagination limit and prevent HTTP 400 on user/group lists. Continue pagination through the entire result set.
- Stop sending unused pagination parameters to the shares endpoint and add regression coverage for a 501-user list.

## [0.0.12] - 2026-11-03

### Fixed

- Restore access for the groups selected in Nextcloud application settings instead of requiring administrator status. All audit routes and exports retain Nextcloud authentication and native application group checks.
- Add real integration coverage for group members, excluded users and anonymous visitors.

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
