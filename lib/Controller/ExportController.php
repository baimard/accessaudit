<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Controller;

use OCA\AccessAudit\AppInfo\Application;
use OCA\AccessAudit\Service\ExportService;
use OCA\AccessAudit\Service\GroupService;
use OCA\AccessAudit\Service\ShareService;
use OCA\AccessAudit\Service\UserService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\DataDownloadResponse;
use OCP\IRequest;

class ExportController extends Controller {
	public function __construct(
		IRequest $request,
		private UserService $userService,
		private GroupService $groupService,
		private ShareService $shareService,
		private ExportService $exportService,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function users(string $format = 'csv'): DataDownloadResponse {
		return $this->download('users', $this->userService->findAll('', 1000), $format);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function groups(string $format = 'csv'): DataDownloadResponse {
		return $this->download('groups', $this->groupService->findAll('', 1000), $format);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function shares(string $format = 'csv'): DataDownloadResponse {
		return $this->download('shares', $this->shareService->findAll(), $format);
	}

	/** @param list<array<string, mixed>> $rows */
	private function download(string $name, array $rows, string $format): DataDownloadResponse {
		$date = date('Y-m-d_H-i-s');
		if (strtolower($format) === 'json') {
			return new DataDownloadResponse(
				$this->exportService->toJson($rows),
				"accessaudit-{$name}-{$date}.json",
				'application/json; charset=utf-8',
			);
		}

		return new DataDownloadResponse(
			$this->exportService->toCsv($rows),
			"accessaudit-{$name}-{$date}.csv",
			'text/csv; charset=utf-8',
		);
	}
}
