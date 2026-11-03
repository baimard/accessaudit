<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Service;

use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use Throwable;

/** @psalm-api */
class FolderService {
	public function __construct(
		private IRootFolder $rootFolder,
	) {
	}

	/** @return array{folders: list<string>, complete: bool, unavailable: list<string>} */
	public function findAll(string $uid): array {
		$paths = [];
		$unavailable = [];
		$complete = true;
		$deadline = microtime(true) + 10.0;
		try {
			$root = $this->rootFolder->getUserFolder($uid);
			if (!$root->isReadable()) {
				return ['folders' => [], 'complete' => false, 'unavailable' => ['/']];
			}
			foreach ($root->getDirectoryListing() as $child) {
				if (count($paths) >= 10000 || microtime(true) > $deadline) {
					$complete = false;
					break;
				}
				if (!$child instanceof Folder) {
					continue;
				}
				$path = '/';
				try {
					$relative = $root->getRelativePath($child->getPath());
					if ($relative === null || $relative === '' || str_contains(trim($relative, '/'), '/')) {
						$complete = false;
						continue;
					}
					$path = '/' . trim($relative, '/');
					if ($child->isReadable()) {
						$paths[] = $path;
					}
				} catch (Throwable) {
					$complete = false;
					$unavailable[] = $path;
				}
			}
		} catch (Throwable) {
			$complete = false;
			$unavailable[] = '/';
		}
		$paths = array_values(array_unique($paths));
		sort($paths, SORT_NATURAL | SORT_FLAG_CASE);
		return ['folders' => $paths, 'complete' => $complete, 'unavailable' => $unavailable];
	}
}
