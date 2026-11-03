<?php

declare(strict_types=1);

// Describe the actual routes, not the original AppTemplate OCS example.
$routes = require __DIR__ . '/../appinfo/routes.php';
$version = (string)simplexml_load_file(__DIR__ . '/../appinfo/info.xml')->version;
$document = [
	'openapi' => '3.0.3',
	'info' => [
		'title' => 'Nextcloud Access Audit',
		'version' => $version,
		'description' => 'Read-only audit. All routes require authentication and app access according to the Nextcloud application activation groups. Folder paths are readable first-level folders relative to the audited user files root, including mounted shares and available external storage; nested folders and the root entry are excluded.',
		'license' => ['name' => 'AGPL-3.0-or-later'],
	],
	'servers' => [['url' => '/index.php/apps/accessaudit']],
	'security' => [['basic_auth' => []]],
	'components' => ['securitySchemes' => ['basic_auth' => ['type' => 'http', 'scheme' => 'basic']]],
	'paths' => [],
];
foreach ($routes['routes'] as $route) {
	[$controller, $action] = explode('#', $route['name']);
	$path = $route['url'];
	$parameters = [];
	preg_match_all('/\{([^}]+)\}/', $path, $matches);
	foreach ($matches[1] as $name) {
		$parameters[] = ['name' => $name, 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string']];
	}
	if ($action === 'list' && $controller !== 'share') {
		foreach (['search' => 'string', 'limit' => 'integer', 'offset' => 'integer'] as $name => $type) {
			$parameters[] = ['name' => $name, 'in' => 'query', 'schema' => ['type' => $type]];
		}
	}
	if ($controller === 'export') {
		$parameters[] = ['name' => 'format', 'in' => 'query', 'schema' => ['type' => 'string', 'enum' => ['csv', 'json'], 'default' => 'csv']];
		$parameters[] = [
			'name' => 'columns[]', 'in' => 'query', 'style' => 'form', 'explode' => true,
			'description' => 'CSV column keys in desired order; omit for all standard fields. Users may additionally select folders. Incomplete folder inventories return 503. JSON retains all fields.',
			'schema' => ['type' => 'array', 'items' => ['type' => 'string']],
		];
	}
	$content = ['application/json' => ['schema' => ['type' => 'object', 'additionalProperties' => true]]];
	if ($action === 'folders') {
		$content['application/json']['schema'] = [
			'type' => 'object', 'required' => ['folders', 'complete', 'unavailable'],
			'properties' => [
				'folders' => ['type' => 'array', 'items' => ['type' => 'string']],
				'complete' => ['type' => 'boolean', 'description' => 'False on storage errors, scan limit (10000 folders) or time limit (10 seconds between storage operations).'],
				'unavailable' => ['type' => 'array', 'items' => ['type' => 'string']],
			],
		];
	}
	if ($controller === 'page') {
		$content = ['text/html' => ['schema' => ['type' => 'string']]];
	} elseif ($controller === 'export') {
		$content['text/csv'] = ['schema' => ['type' => 'string']];
	}
	$document['paths'][$path] = [strtolower($route['verb']) => [
		'operationId' => $controller . ucfirst($action),
		'summary' => ucfirst($controller) . ' ' . $action,
		'parameters' => $parameters,
		'responses' => [
			'200' => ['description' => 'Success', 'content' => $content],
			'400' => ['description' => 'Invalid export column'],
			'401' => ['description' => 'Authentication required (browser requests may redirect to login)'],
			'403' => ['description' => 'Application access denied for this user'],
			'404' => ['description' => 'User, group or share not found'],
			'503' => ['description' => 'Requested folder export is incomplete'],
		],
	]];
}
file_put_contents(__DIR__ . '/../openapi.json', json_encode($document, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n");
