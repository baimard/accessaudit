<?php

declare(strict_types=1);

return [
	'routes' => [

		/*
		 * Main page
		 */
		[
			'name' => 'page#index',
			'url' => '/',
			'verb' => 'GET',
		],

		/*
		 * Users
		 */
		[
			'name' => 'user#list',
			'url' => '/api/users',
			'verb' => 'GET',
		],

		[
			'name' => 'user#get',
			'url' => '/api/users/{uid}',
			'verb' => 'GET',
		],

		/*
		 * Groups
		 */
		[
			'name' => 'group#list',
			'url' => '/api/groups',
			'verb' => 'GET',
		],

		[
			'name' => 'group#get',
			'url' => '/api/groups/{gid}',
			'verb' => 'GET',
		],

		/*
		 * Shares
		 */
		[
			'name' => 'share#list',
			'url' => '/api/shares',
			'verb' => 'GET',
		],

		[
			'name' => 'share#get',
			'url' => '/api/shares/{id}',
			'verb' => 'GET',
		],

		/*
		 * Exports
		 */
		[
			'name' => 'export#users',
			'url' => '/api/export/users',
			'verb' => 'GET',
		],

		[
			'name' => 'export#groups',
			'url' => '/api/export/groups',
			'verb' => 'GET',
		],

		[
			'name' => 'export#shares',
			'url' => '/api/export/shares',
			'verb' => 'GET',
		],
	],
];