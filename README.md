````markdown
# Nextcloud Access Audit

Nextcloud Access Audit is a read-only auditing application for Nextcloud administrators.

The application provides a centralized view of:

- User accounts
- Authentication providers (Local, LDAP, OIDC…)
- Group memberships
- Active file and folder shares
- Public sharing links
- Permissions granted through Nextcloud sharing

Its purpose is to simplify security reviews, privilege audits and access control verification without modifying any data stored in the instance.

---

## Features

### User audit

- List all users
- Display authentication backend
- Display authentication provider
- Display user groups
- Search users
- Filter by provider
- Export audit results

### Share audit

- List all active shares
- Internal user shares
- Group shares
- Public links
- Federated shares
- File and folder shares
- Display permissions
- Display owners
- Display recipients
- Export audit results

---

## Security

Access Audit is a **read-only** application.

It never creates, modifies or deletes:

- users
- groups
- files
- folders
- shares
- permissions

The application only uses the official Nextcloud APIs to retrieve information.

---

## Requirements

- Nextcloud 31 or later
- PHP 8.1 or later

---

## Installation

Clone the application inside the Nextcloud apps directory.

```bash
cd /var/www/nextcloud/apps
git clone https://github.com/adacis/accessaudit.git
````

Enable the application.

```bash
sudo -u www-data php occ app:enable accessaudit
```

---

## Development

Install dependencies.

```bash
composer install
```

Useful commands.

```bash
composer lint
composer cs:check
composer cs:fix
composer psalm
composer test:unit
```

---

## Planned features

* Dashboard
* User audit
* Group audit
* Share audit
* External storage audit
* Public link audit
* Permission analysis
* Orphaned shares detection
* Inactive user detection
* Multiple authentication provider support
* CSV export
* JSON export
* PDF report generation
* Search and filters

---

## License

AGPL-3.0-or-later

---

## Author

Benjamin AIMARD

https://github.com/adacis

```
```
