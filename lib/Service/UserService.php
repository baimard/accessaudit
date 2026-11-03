<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Service;

use OCP\IGroupManager;
use OCP\IUser;
use OCP\IUserManager;

/** @psalm-api */
class UserService {
	public function __construct(
		private IUserManager $userManager,
		private IGroupManager $groupManager,
	) {
	}

	/** @return list<array<string, mixed>> */
	public function findAll(string $search = '', int $limit = 200, int $offset = 0): array {
		$users = $this->userManager->searchDisplayName($search, max(1, min($limit, 1000)), max(0, $offset));
		$result = [];

		foreach ($users as $user) {
			if (!$user instanceof IUser) {
				continue;
			}

			$groups = [];
			foreach ($this->groupManager->getUserGroups($user) as $group) {
				$groups[] = [
					'gid' => $group->getGID(),
					'displayName' => $group->getDisplayName(),
				];
			}

			usort($groups, static fn (array $a, array $b): int => strcasecmp((string)$a['displayName'], (string)$b['displayName']));
			$backend = $user->getBackendClassName();

			$result[] = [
				'uid' => $user->getUID(),
				'displayName' => $user->getDisplayName(),
				'email' => $user->getEMailAddress(),
				'enabled' => $user->isEnabled(),
				'backend' => $backend,
				'provider' => $this->detectProvider($backend),
				'groups' => $groups,
			];
		}

		return $result;
	}

	/** @return array<string, mixed>|null */
	public function find(string $uid): ?array {
		$user = $this->userManager->get($uid);
		if ($user === null) {
			return null;
		}

		$groups = [];
		foreach ($this->groupManager->getUserGroups($user) as $group) {
			$groups[] = ['gid' => $group->getGID(), 'displayName' => $group->getDisplayName()];
		}
		$backend = $user->getBackendClassName();
		return [
			'uid' => $user->getUID(),
			'displayName' => $user->getDisplayName(),
			'email' => $user->getEMailAddress(),
			'enabled' => $user->isEnabled(),
			'backend' => $backend,
			'provider' => $this->detectProvider($backend),
			'groups' => $groups,
		];
	}

	private function detectProvider(string $backend): string {
		$value = strtolower($backend);
		if (str_contains($value, 'ldap')) {
			return 'ldap';
		}
		if (str_contains($value, 'oidc') || str_contains($value, 'openid')) {
			return 'oidc';
		}
		if (str_contains($value, 'database')) {
			return 'local';
		}
		return 'other';
	}
}
