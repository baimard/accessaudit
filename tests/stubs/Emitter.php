<?php

/**
 * SPDX-FileCopyrightText: 2016-2024 Nextcloud GmbH and Nextcloud contributors
 * SPDX-FileCopyrightText: 2016 ownCloud, Inc.
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Test-only compatibility interface omitted by nextcloud/ocp.
 * Signatures from nextcloud/server stable33 lib/private/Hooks/Emitter.php.
 */

namespace OC\Hooks;

interface Emitter {
	/** @return void */
	public function listen($scope, $method, callable $callback);

	/** @return void */
	public function removeListener($scope = null, $method = null, ?callable $callback = null);
}
