<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Controller;

use OCA\AccessAudit\AppInfo\Application;
use OCA\AccessAudit\Service\GroupService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;

class GroupController extends Controller {
	public function __construct(IRequest $request, private GroupService $groupService) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function list(string $search = '', int $limit = 200, int $offset = 0): DataResponse {
		$groups = $this->groupService->findAll($search, $limit, $offset);
		return new DataResponse(['count' => count($groups), 'groups' => $groups]);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function get(string $gid): JSONResponse {
		$group = $this->groupService->find($gid);
		return $group === null
			? new JSONResponse(['error' => 'Group not found'], 404)
			: new JSONResponse($group);
	}
}
