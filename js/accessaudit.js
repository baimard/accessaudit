document.addEventListener('DOMContentLoaded', () => {
	'use strict';

	const state = { section: 'users', rows: [], search: '', provider: '' };
	const table = document.getElementById('accessaudit-table');
	const status = document.getElementById('accessaudit-status');
	const search = document.getElementById('accessaudit-search');
	const provider = document.getElementById('accessaudit-provider');
	const csv = document.getElementById('accessaudit-export-csv');
	const json = document.getElementById('accessaudit-export-json');

	const routes = {
		users: '/apps/accessaudit/api/users',
		groups: '/apps/accessaudit/api/groups',
		shares: '/apps/accessaudit/api/shares',
	};

	const escapeText = value => value === null || value === undefined ? '' : String(value);

	function badge(text) {
		const span = document.createElement('span');
		span.className = 'accessaudit__badge';
		span.textContent = text;
		return span;
	}

	function setExports() {
		const base = OC.generateUrl(`/apps/accessaudit/api/export/${state.section}`);
		csv.href = `${base}?format=csv`;
		json.href = `${base}?format=json`;
	}

	function filteredRows() {
		const needle = state.search.toLowerCase();
		return state.rows.filter(row => {
			const matchesSearch = !needle || JSON.stringify(row).toLowerCase().includes(needle);
			const matchesProvider = state.section !== 'users' || !state.provider || row.provider === state.provider;
			return matchesSearch && matchesProvider;
		});
	}

	function cell(row, value) {
		const td = document.createElement('td');
		if (value instanceof Node) {
			td.appendChild(value);
		} else if (Array.isArray(value)) {
			for (const item of value) td.appendChild(badge(escapeText(item)));
		} else {
			td.textContent = escapeText(value);
		}
		row.appendChild(td);
	}

	function render() {
		const thead = table.querySelector('thead');
		const tbody = table.querySelector('tbody');
		thead.replaceChildren();
		tbody.replaceChildren();

		const columns = state.section === 'users'
			? ['UID', 'Display name', 'Email', 'Provider', 'Backend', 'Enabled', 'Groups']
			: state.section === 'groups'
				? ['GID', 'Display name', 'Members', 'Member list']
				: ['ID', 'Type', 'Name', 'Path', 'Owner', 'Recipient', 'Permissions', 'Created', 'Expires'];

		const header = document.createElement('tr');
		for (const title of columns) {
			const th = document.createElement('th');
			th.textContent = title;
			header.appendChild(th);
		}
		thead.appendChild(header);

		const rows = filteredRows();
		for (const item of rows) {
			const row = document.createElement('tr');
			if (state.section === 'users') {
				cell(row, item.uid); cell(row, item.displayName); cell(row, item.email);
				cell(row, item.provider); cell(row, item.backend); cell(row, item.enabled ? 'Yes' : 'No');
				cell(row, item.groups.map(group => group.displayName));
			} else if (state.section === 'groups') {
				cell(row, item.gid); cell(row, item.displayName); cell(row, item.memberCount);
				cell(row, item.members.map(member => member.displayName || member.uid));
			} else {
				cell(row, item.id); cell(row, item.shareTypeLabel); cell(row, item.name); cell(row, item.path);
				cell(row, item.owner); cell(row, item.sharedWith); cell(row, item.permissionLabels);
				cell(row, item.createdAt); cell(row, item.expiresAt);
			}
			tbody.appendChild(row);
		}

		status.textContent = `${rows.length} result(s)`;
	}

	async function load() {
		status.textContent = 'Loading…';
		table.setAttribute('aria-busy', 'true');
		try {
			const response = await fetch(OC.generateUrl(routes[state.section]), { headers: { Accept: 'application/json' } });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			state.rows = data[state.section] || [];
			render();
		} catch (error) {
			console.error(error);
			status.textContent = `Unable to load audit data: ${error.message}`;
		} finally {
			table.removeAttribute('aria-busy');
		}
	}

	document.querySelectorAll('.accessaudit__tab').forEach(button => {
		button.addEventListener('click', () => {
			document.querySelectorAll('.accessaudit__tab').forEach(tab => tab.classList.remove('active'));
			button.classList.add('active');
			state.section = button.dataset.section;
			provider.hidden = state.section !== 'users';
			setExports();
			load();
		});
	});

	search.addEventListener('input', () => { state.search = search.value; render(); });
	provider.addEventListener('change', () => { state.provider = provider.value; render(); });
	document.getElementById('accessaudit-refresh').addEventListener('click', load);

	setExports();
	load();
});
