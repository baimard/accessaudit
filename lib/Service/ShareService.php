<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Service;

use OCP\IUserManager;
use OCP\Share\IManager;
use OCP\Share\IShare;
use Throwable;

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

	/** @var array<string, string> */
	private array $displayNameCache = [];

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
					try {
						$shares = $this->shareManager->getSharesBy(
							$user->getUID(),
							$type,
							null,
							true,
							-1,
							0,
						);
					} catch (Throwable) {
						// A share provider may not implement every share type.
						continue;
					}

					foreach ($shares as $share) {
						try {
							$key = (string)$share->getFullId();
							if (isset($seen[$key])) {
								continue;
							}

							$seen[$key] = true;
							$result[] = $this->normalize($share);
						} catch (Throwable) {
							// Ignore stale or inaccessible shares instead of failing the whole audit.
							continue;
						}
					}
				}
			}

			$offset += $limit;
		} while (count($users) === $limit);

		usort(
			$result,
			static fn (array $a, array $b): int => ($b['createdAt'] ?? '') <=> ($a['createdAt'] ?? ''),
		);

		return $result;
	}

	/** @return array<string, mixed> */
	public function find(string $id): array {
		return $this->normalize($this->shareManager->getShareById($id));
	}

	/** @return array<string, mixed> */
	private function normalize(IShare $share): array {
		$node = $share->getNode();
		$expiration = $share->getExpirationDate();
		$created = $share->getShareTime();
		$ownerUid = (string)$share->getShareOwner();

		return [
			'id' => (string)$share->getFullId(),
			'shareType' => (int)$share->getShareType(),
			'shareTypeLabel' => $this->typeLabel((int)$share->getShareType()),
			'sharedWith' => (string)$share->getSharedWith(),
			'owner' => $this->resolveDisplayName($ownerUid),
			'ownerUid' => $ownerUid,
			'initiator' => (string)$share->getSharedBy(),
			'nodeId' => $node->getId(),
			'path' => $node->getPath(),
			'name' => $node->getName(),
			'nodeType' => $node->getType(),
			'permissions' => (int)$share->getPermissions(),
			'permissionLabels' => $this->permissionLabels((int)$share->getPermissions()),
			'passwordProtected' => $share->getPassword() !== null,
			'token' => $share->getToken(),
			'note' => $share->getNote(),
			'label' => $share->getLabel(),
			'createdAt' => $created?->format(DATE_ATOM),
			'expiresAt' => $expiration?->format(DATE_ATOM),
		];
	}

	private function resolveDisplayName(string $uid): string {
		if ($uid === '') {
			return '';
		}

		if (isset($this->displayNameCache[$uid])) {
			return $this->displayNameCache[$uid];
		}

		$user = $this->userManager->get($uid);
		$displayName = $user?->getDisplayName();

		return $this->displayNameCache[$uid] = ($displayName !== null && $displayName !== '')
			? $displayName
			: $uid;
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
