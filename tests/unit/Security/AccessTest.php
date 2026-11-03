<?php

declare(strict_types=1);

namespace OCA\AccessAudit\Tests\Security;

use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\PublicPage;
use PHPUnit\Framework\TestCase;

final class AccessTest extends TestCase {
	public function testAuditRoutesKeepNextcloudAdminAndAuthenticationGuards(): void {
		$routes = require __DIR__ . '/../../../appinfo/routes.php';
		foreach ($routes['routes'] as $route) {
			[$controller, $action] = explode('#', $route['name']);
			$class = new \ReflectionClass('OCA\\AccessAudit\\Controller\\' . ucfirst($controller) . 'Controller');
			$method = $class->getMethod($action);
			foreach ([NoAdminRequired::class, PublicPage::class] as $attribute) {
				self::assertSame([], $class->getAttributes($attribute));
				self::assertSame([], $method->getAttributes($attribute), $route['name']);
			}
		}
	}
}
