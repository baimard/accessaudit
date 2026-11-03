# Nextcloud Access Audit

Read-only audit of Nextcloud users, group memberships, mounted folders and active shares.

## Requirements

- Nextcloud 33–36 (integration tested on Nextcloud 33 and 35).
- PHP 8.2.35 or later; use a security-patched PHP branch (8.3.36+, 8.4.27+ or 8.5.12+).
- Node 24 and npm 11 for development checks. Production assets use native JavaScript and CSS; no Vue/Vite compilation is needed.

## Installation

Install this checkout as `accessaudit` in a Nextcloud apps directory, then run:

```sh
composer install --no-dev --no-scripts --prefer-dist
sudo -u www-data php occ app:enable accessaudit
```

## Audit and exports

The Users tab has an **Accessible folders** column. Use **Load folders** to enumerate a user's actual Nextcloud files tree, recursively, including personal folders, received user/group shares and external mounts available to that user. Paths are relative to the user's files root, not physical server disk paths. Files themselves are not read. Unreadable folders are excluded.

Storage requiring unavailable user credentials, errors and safety limits (10,000 folders or 10 seconds checked between storage operations) produce an explicit incomplete result. A slow storage request can exceed the time budget. CSV/PDF exports requiring folders stop if the inventory is incomplete; they never silently present partial results as complete. Folder loading is on demand to avoid scanning every account on page load.

- Search, exclusion, provider filters and sorting apply to browser exports.
- **CSV columns** lets you choose the fields for each tab. At least one column is required. Selecting folders loads the required user trees before downloading. The server CSV endpoints also accept repeated `columns[]` keys, such as `columns[]=uid&columns[]=folders`.
- **Export PDF** prepares the current tab as a landscape report with all its columns and opens the browser print dialog. Choose **Save as PDF**. This works for Users, Groups and Shares, preserves Unicode, and repeats table headings on each printed page. User reports load folders first.
- **Export JSON** exports all displayed fields and loads folders for user reports.
- User/group pagination uses pages of 500 (compatible with Nextcloud 35) and is fetched in full before presenting the table; server exports also paginate.

The page, APIs and exports follow Nextcloud’s application activation settings, including the selected groups. Members of those groups can audit without being administrators; users outside the groups and anonymous visitors cannot access the audit. If the app is enabled for everyone, every authenticated user has access: restrict activation to trusted audit groups in the Nextcloud Applications settings. Public share tokens are omitted. CSV formula prefixes are neutralized; user-controlled values are rendered as text.

## Development

```sh
composer install --no-interaction --prefer-dist
npm ci
composer lint
composer test:unit
composer cs:check
composer psalm
npm run build
npm run lint
npm run stylelint
npm test
php scripts/generate-openapi.php
```

`npm run build` validates the shipped native JavaScript. It does not overwrite the committed assets. PHPUnit uses the locked Nextcloud API definitions, with one test-only compatibility interface omitted by that package, and does not require a live server. Integration tests exercise a real disposable Nextcloud, including nested group-share folders and application group permissions:

```sh
python3 tests/integration/nextcloud_smoke.py \
  --base-url http://127.0.0.1:8080 \
  --env-file /path/to/local-nextcloud.env \
  --container accessaudit-nextcloud
```

The env file must contain `NEXTCLOUD_ADMIN_USER` and `NEXTCLOUD_ADMIN_PASSWORD`. The optional `--container` selects a local Docker container to test activation-group restrictions; it restarts that disposable container to refresh the web cache after CLI activation changes, and restores the previous activation configuration afterwards. Use a disposable instance: the test creates uniquely named users and a group, then deletes its fixtures. Do not commit this file or credentials.

CI runs on standard GitHub runners with Node 24 and PHP 8.2/8.4. It checks unit/UI tests, formatting, static analysis, the generated OpenAPI document and locked dependency vulnerabilities. The old template jobs referenced missing `src`, Vite configuration and an OpenAPI command, used unavailable organization-specific runners, and scheduled bots required an unconfigured personal token. Dependabot now manages updates without auto-approval or auto-merge. See [openapi.json](openapi.json) for the actual routes.

## License

AGPL-3.0-or-later. Benjamin Aimard.
