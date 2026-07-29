<?php

declare(strict_types=1);

script('accessaudit', 'accessaudit');
style('accessaudit', 'accessaudit');
?>

<div id="accessaudit" class="accessaudit">
	<header class="accessaudit__header">
		<div>
			<h1><?php p($l->t('Nextcloud Access Audit')); ?></h1>
			<p><?php p($l->t('Read-only audit of users, groups and active shares.')); ?></p>
		</div>
		<button id="accessaudit-refresh" class="primary"><?php p($l->t('Refresh')); ?></button>
	</header>

	<nav class="accessaudit__tabs" aria-label="Audit sections">
		<button class="accessaudit__tab active" data-section="users"><?php p($l->t('Users')); ?></button>
		<button class="accessaudit__tab" data-section="groups"><?php p($l->t('Groups')); ?></button>
		<button class="accessaudit__tab" data-section="shares"><?php p($l->t('Shares')); ?></button>
	</nav>

	<section class="accessaudit__toolbar">
		<input id="accessaudit-search" type="search" placeholder="<?php p($l->t('Search')); ?>">
		<label class="accessaudit__negate" for="accessaudit-negate">
			<input id="accessaudit-negate" type="checkbox">
			<span><?php p($l->t('Exclude matches')); ?></span>
		</label>
		<select id="accessaudit-provider">
			<option value=""><?php p($l->t('All providers')); ?></option>
			<option value="local">Local</option>
			<option value="ldap">LDAP</option>
			<option value="oidc">OIDC</option>
			<option value="other"><?php p($l->t('Other')); ?></option>
		</select>
		<a id="accessaudit-export-csv" class="button" href="#"><?php p($l->t('Export CSV')); ?></a>
		<a id="accessaudit-export-json" class="button" href="#"><?php p($l->t('Export JSON')); ?></a>
	</section>

	<div id="accessaudit-status" role="status"></div>
	<div class="accessaudit__table-wrap">
		<table id="accessaudit-table">
			<thead></thead>
			<tbody></tbody>
		</table>
	</div>
</div>