<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Controller;

use OCA\AccessAudit\AppInfo\Application;
use OCA\AccessAudit\Service\ShareService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\Share\Exceptions\ShareNotFound;

class ShareController extends Controller {
	public function __construct(IRequest $request, private ShareService $shareService) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function list(): DataResponse {
		$shares = $this->shareService->findAll();
		return new DataResponse(['count' => count($shares), 'shares' => $shares]);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function get(string $id): JSONResponse {
		try {
			return new JSONResponse($this->shareService->find($id));
		} catch (ShareNotFound) {
			return new JSONResponse(['error' => 'Share not found'], 404);
		}
	}
}
