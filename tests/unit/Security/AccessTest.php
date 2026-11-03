<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Tests\Security;

use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\PublicPage;
use PHPUnit\Framework\TestCase;

final class AccessTest extends TestCase {
	public function testAuditRoutesUseNativeGroupAndAuthenticationGuards(): void {
		$routes = require __DIR__ . '/../../../appinfo/routes.php';
		foreach ($routes['routes'] as $route) {
			[$controller, $action] = explode('#', $route['name']);
			$class = new \ReflectionClass('OCA\\AccessAudit\\Controller\\' . ucfirst($controller) . 'Controller');
			$method = $class->getMethod($action);
			self::assertCount(1, $method->getAttributes(NoAdminRequired::class), $route['name']);
			self::assertSame([], $class->getAttributes(PublicPage::class));
			self::assertSame([], $method->getAttributes(PublicPage::class), $route['name']);
		}
	}
}
