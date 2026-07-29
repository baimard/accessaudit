<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Service;

use OCP\IGroupManager;

class GroupService {
	public function __construct(private IGroupManager $groupManager) {
	}

	/** @return list<array<string, mixed>> */
	public function findAll(string $search = '', int $limit = 200, int $offset = 0): array {
		$groups = $this->groupManager->search($search, max(1, min($limit, 1000)), max(0, $offset));
		$result = [];

		foreach ($groups as $group) {
			$members = [];
			foreach ($group->getUsers() as $user) {
				$members[] = [
					'uid' => $user->getUID(),
					'displayName' => $user->getDisplayName(),
				];
			}

			$result[] = [
				'gid' => $group->getGID(),
				'displayName' => $group->getDisplayName(),
				'memberCount' => count($members),
				'members' => $members,
			];
		}

		return $result;
	}

	/** @return array<string, mixed>|null */
	public function find(string $gid): ?array {
		$group = $this->groupManager->get($gid);
		if ($group === null) {
			return null;
		}

		$members = [];
		foreach ($group->getUsers() as $user) {
			$members[] = ['uid' => $user->getUID(), 'displayName' => $user->getDisplayName()];
		}

		return [
			'gid' => $group->getGID(),
			'displayName' => $group->getDisplayName(),
			'memberCount' => count($members),
			'members' => $members,
		];
	}
}
