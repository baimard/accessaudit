<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Controller;

use OCA\AccessAudit\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\TemplateResponse;

class PageController extends Controller {
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function index(): TemplateResponse {
		return new TemplateResponse(Application::APP_ID, 'index');
	}
}
