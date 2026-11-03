<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Controller;

use OCA\AccessAudit\AppInfo\Application;
use OCA\AccessAudit\Service\ExportService;
use OCA\AccessAudit\Service\FolderService;
use OCA\AccessAudit\Service\GroupService;
use OCA\AccessAudit\Service\ShareService;
use OCA\AccessAudit\Service\UserService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\DataDownloadResponse;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;

/** @psalm-api */
class ExportController extends Controller {
	public function __construct(
		IRequest $request,
		private UserService $userService,
		private GroupService $groupService,
		private ShareService $shareService,
		private ExportService $exportService,
		private FolderService $folderService,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	/** @param list<string> $columns */
	#[NoCSRFRequired]
	public function users(string $format = 'csv', array $columns = []): DataDownloadResponse|JSONResponse {
		$rows = [];
		$offset = 0;
		do {
			$page = $this->userService->findAll('', 1000, $offset);
			foreach ($page as $row) {
				if (in_array('folders', $columns, true)) {
					$audit = $this->folderService->findAll((string)$row['uid']);
					if (!$audit['complete']) {
						return new JSONResponse(['error' => 'Folder audit incomplete; retry or exclude folders'], 503);
					}
					$row['folders'] = $audit['folders'];
				}
				$rows[] = $row;
			}
			$offset += count($page);
		} while (count($page) === 1000);
		return $this->download('users', $rows, $format, $columns);
	}

	/** @param list<string> $columns */
	#[NoCSRFRequired]
	public function groups(string $format = 'csv', array $columns = []): DataDownloadResponse|JSONResponse {
		$rows = [];
		$offset = 0;
		do {
			$page = $this->groupService->findAll('', 1000, $offset);
			array_push($rows, ...$page);
			$offset += count($page);
		} while (count($page) === 1000);
		return $this->download('groups', $rows, $format, $columns);
	}

	/** @param list<string> $columns */
	#[NoCSRFRequired]
	public function shares(string $format = 'csv', array $columns = []): DataDownloadResponse|JSONResponse {
		return $this->download('shares', $this->shareService->findAll(), $format, $columns);
	}

	/**
	 * @param list<array<string, mixed>> $rows
	 * @param list<string> $columns
	 */
	private function download(string $name, array $rows, string $format, array $columns): DataDownloadResponse|JSONResponse {
		$date = date('Y-m-d_H-i-s');
		if (strtolower($format) === 'json') {
			return new DataDownloadResponse(
				$this->exportService->toJson($rows),
				"accessaudit-{$name}-{$date}.json",
				'application/json; charset=utf-8',
			);
		}

		try {
			$content = $this->exportService->toCsv($rows, $columns);
		} catch (\InvalidArgumentException) {
			return new JSONResponse(['error' => 'Unknown export column'], 400);
		}
		return new DataDownloadResponse(
			$content,
			"accessaudit-{$name}-{$date}.csv",
			'text/csv; charset=utf-8',
		);
	}
}
