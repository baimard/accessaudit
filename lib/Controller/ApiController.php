<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Controller;

use OCA\AccessAudit\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\IRequest;

/**
 * Compatibility controller retained for Nextcloud route discovery.
 *
 * The AppTemplate skeleton originally declared an attribute route on this
 * controller. The current application uses dedicated controllers and routes,
 * but Nextcloud still reflects every controller containing route metadata.
 */
final class ApiController extends Controller {
	public function __construct(IRequest $request) {
		parent::__construct(Application::APP_ID, $request);
	}
}
