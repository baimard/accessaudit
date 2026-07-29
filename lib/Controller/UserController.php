<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Controller;

use OCA\AccessAudit\AppInfo\Application;
use OCA\AccessAudit\Service\UserService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;

class UserController extends Controller {
	public function __construct(IRequest $request, private UserService $userService) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function list(string $search = '', int $limit = 200, int $offset = 0): DataResponse {
		$users = $this->userService->findAll($search, $limit, $offset);
		return new DataResponse(['count' => count($users), 'users' => $users]);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function get(string $uid): JSONResponse {
		$user = $this->userService->find($uid);
		return $user === null
			? new JSONResponse(['error' => 'User not found'], 404)
			: new JSONResponse($user);
	}
}
