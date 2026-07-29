<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Service;

use OCP\IUserManager;
use OCP\Share\IManager;
use OCP\Share\IShare;

class ShareService {
	private const SHARE_TYPES = [
		IShare::TYPE_USER,
		IShare::TYPE_GROUP,
		IShare::TYPE_LINK,
		IShare::TYPE_EMAIL,
		IShare::TYPE_REMOTE,
		IShare::TYPE_ROOM,
		IShare::TYPE_DECK,
	];

	public function __construct(
		private IManager $shareManager,
		private IUserManager $userManager,
	) {
	}

	/** @return list<array<string, mixed>> */
	public function findAll(): array {
		$result = [];
		$seen = [];
		$offset = 0;
		$limit = 500;

		do {
			$users = $this->userManager->search('', $limit, $offset);
			foreach ($users as $user) {
				foreach (self::SHARE_TYPES as $type) {
					foreach ($this->shareManager->getSharesBy($user->getUID(), $type, null, true, -1, 0) as $share) {
						$key = $share->getFullId();
						if (isset($seen[$key])) {
							continue;
						}
						$seen[$key] = true;
						$result[] = $this->normalize($share);
					}
				}
			}
			$offset += $limit;
		} while (count($users) === $limit);

		usort($result, static fn (array $a, array $b): int => ($b['createdAt'] ?? '') <=> ($a['createdAt'] ?? ''));
		return $result;
	}

	/** @return array<string, mixed> */
	public function find(string $id): array {
		return $this->normalize($this->shareManager->getShareById($id));
	}

	/** @return array<string, mixed> */
	private function normalize(IShare $share): array {
		$node = $share->getNode();
		$owner = $share->getShareOwner();
		$initiator = $share->getSharedBy();
		$expiration = $share->getExpirationDate();
		$created = $share->getShareTime();

		return [
			'id' => $share->getFullId(),
			'shareType' => $share->getShareType(),
			'shareTypeLabel' => $this->typeLabel($share->getShareType()),
			'sharedWith' => $share->getSharedWith(),
			'owner' => $owner?->getUID(),
			'initiator' => $initiator?->getUID(),
			'nodeId' => $node->getId(),
			'path' => $node->getPath(),
			'name' => $node->getName(),
			'nodeType' => $node->getType(),
			'permissions' => $share->getPermissions(),
			'permissionLabels' => $this->permissionLabels($share->getPermissions()),
			'passwordProtected' => $share->getPassword() !== null,
			'token' => $share->getToken(),
			'note' => $share->getNote(),
			'label' => $share->getLabel(),
			'createdAt' => $created?->format(DATE_ATOM),
			'expiresAt' => $expiration?->format(DATE_ATOM),
		];
	}

	private function typeLabel(int $type): string {
		return match ($type) {
			IShare::TYPE_USER => 'user',
			IShare::TYPE_GROUP => 'group',
			IShare::TYPE_LINK => 'public-link',
			IShare::TYPE_EMAIL => 'email',
			IShare::TYPE_REMOTE => 'federated',
			IShare::TYPE_ROOM => 'talk-room',
			IShare::TYPE_DECK => 'deck',
			default => 'other',
		};
	}

	/** @return list<string> */
	private function permissionLabels(int $permissions): array {
		$labels = [];
		foreach ([1 => 'read', 2 => 'update', 4 => 'create', 8 => 'delete', 16 => 'share'] as $flag => $label) {
			if (($permissions & $flag) === $flag) {
				$labels[] = $label;
			}
		}
		return $labels;
	}
}
