<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Service;

use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use Throwable;

/**
 * Enumerate the user's mounted filesystem, never infer access from outgoing shares.
 * @psalm-api
 */
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
			$pending = [$root];
			$seen = [];
			while ($pending !== []) {
				if (count($paths) >= 10000 || microtime(true) > $deadline) {
					$complete = false;
					break;
				}
				$folder = array_pop($pending);
				$relative = $root->getRelativePath($folder->getPath());
				if ($relative === null) {
					$complete = false;
					continue;
				}
				$path = '/' . ltrim($relative, '/');
				if (isset($seen[$path])) {
					continue;
				}
				$seen[$path] = true;
				try {
					if (!$folder->isReadable()) {
						continue;
					}
					$paths[] = $path;
					foreach ($folder->getDirectoryListing() as $child) {
						if ($child instanceof Folder) {
							$pending[] = $child;
						}
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
		sort($paths, SORT_NATURAL | SORT_FLAG_CASE);
		return ['folders' => $paths, 'complete' => $complete, 'unavailable' => $unavailable];
	}
}
