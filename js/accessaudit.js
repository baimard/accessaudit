document.addEventListener('DOMContentLoaded', () => {
	'use strict';

	const STORAGE_KEY = 'accessaudit.view.v1';
	const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
	const state = {
		section: 'users',
		rows: [],
		search: '',
		negate: false,
		provider: '',
		sorts: [],
	};

	const table = document.getElementById('accessaudit-table');
	const status = document.getElementById('accessaudit-status');
	const search = document.getElementById('accessaudit-search');
	const negate = document.getElementById('accessaudit-negate');
	const provider = document.getElementById('accessaudit-provider');
	const csv = document.getElementById('accessaudit-export-csv');
	const json = document.getElementById('accessaudit-export-json');

	const routes = {
		users: '/apps/accessaudit/api/users',
		groups: '/apps/accessaudit/api/groups',
		shares: '/apps/accessaudit/api/shares',
	};

	const columns = {
		users: [
			{ key: 'uid', label: 'UID', type: 'text', value: row => row.uid },
			{ key: 'displayName', label: 'Display name', type: 'text', value: row => row.displayName },
			{ key: 'email', label: 'Email', type: 'text', value: row => row.email },
			{ key: 'provider', label: 'Provider', type: 'text', value: row => row.provider },
			{ key: 'backend', label: 'Backend', type: 'text', value: row => row.backend },
			{ key: 'enabled', label: 'Enabled', type: 'boolean', value: row => Boolean(row.enabled), display: row => row.enabled ? 'Yes' : 'No' },
			{ key: 'groups', label: 'Groups', type: 'array', value: row => (row.groups || []).map(group => group.displayName || group.gid) },
		],
		groups: [
			{ key: 'gid', label: 'GID', type: 'text', value: row => row.gid },
			{ key: 'displayName', label: 'Display name', type: 'text', value: row => row.displayName },
			{ key: 'memberCount', label: 'Members', type: 'number', value: row => row.memberCount },
			{ key: 'members', label: 'Member list', type: 'array', value: row => (row.members || []).map(member => member.displayName || member.uid) },
		],
		shares: [
			{ key: 'id', label: 'ID', type: 'text', value: row => row.id },
			{ key: 'shareTypeLabel', label: 'Type', type: 'text', value: row => row.shareTypeLabel },
			{ key: 'name', label: 'Name', type: 'text', value: row => row.name },
			{ key: 'path', label: 'Path', type: 'text', value: row => row.path },
			{ key: 'owner', label: 'Owner', type: 'text', value: row => row.owner },
			{ key: 'sharedWith', label: 'Recipient', type: 'text', value: row => row.sharedWith },
			{ key: 'permissionLabels', label: 'Permissions', type: 'array', value: row => row.permissionLabels || [] },
			{ key: 'createdAt', label: 'Created', type: 'date', value: row => row.createdAt },
			{ key: 'expiresAt', label: 'Expires', type: 'date', value: row => row.expiresAt },
		],
	};

	const escapeText = value => value === null || value === undefined ? '' : String(value);

	function badge(text) {
		const span = document.createElement('span');
		span.className = 'accessaudit__badge';
		span.textContent = text;
		return span;
	}

	function getColumn(key) {
		return columns[state.section].find(column => column.key === key);
	}

	function loadSavedState() {
		let saved = {};
		try {
			saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
		} catch (error) {
			console.warn('Unable to restore Access Audit preferences', error);
		}

		const params = new URLSearchParams(window.location.search);
		const section = params.get('section') || saved.section;
		if (columns[section]) state.section = section;

		state.search = params.has('q') ? params.get('q') || '' : saved.search || '';
		state.negate = params.has('negate') ? params.get('negate') === '1' : Boolean(saved.negate);
		state.provider = params.has('provider') ? params.get('provider') || '' : saved.provider || '';

		const sortValue = params.get('sort');
		const savedSorts = saved.sorts && saved.sorts[state.section];
		state.sorts = parseSorts(sortValue || savedSorts || '');
	}

	function parseSorts(value) {
		if (Array.isArray(value)) {
			return value.filter(sort => getColumn(sort.key) && ['asc', 'desc'].includes(sort.direction));
		}
		return String(value)
			.split(',')
			.map(part => {
				const [key, direction] = part.split(':');
				return { key, direction };
			})
			.filter(sort => getColumn(sort.key) && ['asc', 'desc'].includes(sort.direction));
	}

	function serializeSorts() {
		return state.sorts.map(sort => `${sort.key}:${sort.direction}`).join(',');
	}

	function persistView() {
		let saved = {};
		try {
			saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
		} catch (error) {
			saved = {};
		}
		saved.section = state.section;
		saved.search = state.search;
		saved.negate = state.negate;
		saved.provider = state.provider;
		saved.sorts = saved.sorts || {};
		saved.sorts[state.section] = serializeSorts();
		localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

		const params = new URLSearchParams(window.location.search);
		params.set('section', state.section);
		state.search ? params.set('q', state.search) : params.delete('q');
		state.negate ? params.set('negate', '1') : params.delete('negate');
		state.section === 'users' && state.provider ? params.set('provider', state.provider) : params.delete('provider');
		state.sorts.length ? params.set('sort', serializeSorts()) : params.delete('sort');
		window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`.replace(/\?$/, ''));
	}

	function filteredRows() {
		const needle = state.search.trim().toLowerCase();
		return state.rows.filter(row => {
			const rowText = JSON.stringify(row).toLowerCase();
			const containsNeedle = needle !== '' && rowText.includes(needle);
			const matchesSearch = needle === '' || (state.negate ? !containsNeedle : containsNeedle);
			const matchesProvider = state.section !== 'users' || !state.provider || row.provider === state.provider;
			return matchesSearch && matchesProvider;
		});
	}

	function normalizedValue(column, row) {
		const value = column.value(row);
		if (value === null || value === undefined || value === '') return null;
		switch (column.type) {
			case 'number': return Number(value);
			case 'boolean': return value ? 1 : 0;
			case 'date': {
				const timestamp = Date.parse(value);
				return Number.isNaN(timestamp) ? null : timestamp;
			}
			case 'array': return Array.isArray(value) ? value.join(' ') : String(value);
			default: return String(value);
		}
	}

	function compareValues(left, right, column) {
		const a = normalizedValue(column, left);
		const b = normalizedValue(column, right);
		if (a === null && b === null) return 0;
		if (a === null) return 1;
		if (b === null) return -1;
		if (column.type === 'number' || column.type === 'boolean' || column.type === 'date') return a - b;
		return collator.compare(a, b);
	}

	function sortedRows() {
		const rows = filteredRows().map((row, index) => ({ row, index }));
		if (!state.sorts.length) return rows.map(item => item.row);

		rows.sort((left, right) => {
			for (const sort of state.sorts) {
				const column = getColumn(sort.key);
				if (!column) continue;
				const result = compareValues(left.row, right.row, column);
				if (result !== 0) return sort.direction === 'desc' ? -result : result;
			}
			return left.index - right.index;
		});
		return rows.map(item => item.row);
	}

	function changeSort(key, multiColumn) {
		const currentIndex = state.sorts.findIndex(sort => sort.key === key);
		const current = currentIndex >= 0 ? state.sorts[currentIndex] : null;
		let nextDirection = 'asc';
		if (current?.direction === 'asc') nextDirection = 'desc';
		else if (current?.direction === 'desc') nextDirection = null;

		if (!multiColumn) state.sorts = [];
		else if (currentIndex >= 0) state.sorts.splice(currentIndex, 1);

		if (nextDirection) state.sorts.push({ key, direction: nextDirection });
		persistView();
		render();
	}

	function cell(row, value) {
		const td = document.createElement('td');
		if (value instanceof Node) td.appendChild(value);
		else if (Array.isArray(value)) for (const item of value) td.appendChild(badge(escapeText(item)));
		else td.textContent = escapeText(value);
		row.appendChild(td);
	}

	function renderHeader(thead) {
		const header = document.createElement('tr');
		for (const column of columns[state.section]) {
			const th = document.createElement('th');
			const button = document.createElement('button');
			const sortIndex = state.sorts.findIndex(sort => sort.key === column.key);
			const sort = sortIndex >= 0 ? state.sorts[sortIndex] : null;

			button.type = 'button';
			button.className = 'accessaudit__sort';
			button.dataset.key = column.key;
			button.textContent = column.label;
			button.title = 'Click to sort. Shift+click adds a secondary sort.';
			button.setAttribute('aria-label', `Sort by ${column.label}`);
			button.setAttribute('aria-sort', sort ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');

			if (sort) {
				const indicator = document.createElement('span');
				indicator.className = 'accessaudit__sort-indicator';
				indicator.textContent = `${sort.direction === 'asc' ? '▲' : '▼'}${state.sorts.length > 1 ? ` ${sortIndex + 1}` : ''}`;
				button.appendChild(indicator);
				th.classList.add('is-sorted');
			}

			button.addEventListener('click', event => changeSort(column.key, event.shiftKey));
			th.appendChild(button);
			header.appendChild(th);
		}
		thead.appendChild(header);
	}

	function render() {
		const thead = table.querySelector('thead');
		const tbody = table.querySelector('tbody');
		thead.replaceChildren();
		tbody.replaceChildren();
		renderHeader(thead);

		const rows = sortedRows();
		for (const item of rows) {
			const row = document.createElement('tr');
			for (const column of columns[state.section]) {
				cell(row, column.display ? column.display(item) : column.value(item));
			}
			tbody.appendChild(row);
		}

		const sortSummary = state.sorts.length
			? ` — sorted by ${state.sorts.map(sort => `${getColumn(sort.key).label} ${sort.direction === 'asc' ? '▲' : '▼'}`).join(', ')}`
			: '';
		status.textContent = `${rows.length} result(s)${sortSummary}`;
	}

	function exportRows(format) {
		const rows = sortedRows();
		const visibleColumns = columns[state.section];
		const exported = rows.map(row => Object.fromEntries(visibleColumns.map(column => [column.label, column.value(row)])));
		let content;
		let mime;
		let extension;

		if (format === 'json') {
			content = JSON.stringify(exported, null, 2);
			mime = 'application/json;charset=utf-8';
			extension = 'json';
		} else {
			const quote = value => {
				const normalized = Array.isArray(value) ? value.join(', ') : escapeText(value);
				return `"${normalized.replace(/"/g, '""')}"`;
			};
			content = '\uFEFF' + [
				visibleColumns.map(column => quote(column.label)).join(';'),
				...exported.map(row => visibleColumns.map(column => quote(row[column.label])).join(';')),
			].join('\r\n');
			mime = 'text/csv;charset=utf-8';
			extension = 'csv';
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const blob = new Blob([content], { type: mime });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `accessaudit-${state.section}-${timestamp}.${extension}`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
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

	function activateSection(section) {
		state.section = section;
		document.querySelectorAll('.accessaudit__tab').forEach(tab => tab.classList.toggle('active', tab.dataset.section === section));
		provider.hidden = section !== 'users';

		let saved = {};
		try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (error) { saved = {}; }
		const urlSort = new URLSearchParams(window.location.search).get('sort');
		state.sorts = parseSorts(urlSort || saved.sorts?.[section] || '');
		persistView();
		load();
	}

	loadSavedState();
	search.value = state.search;
	negate.checked = state.negate;
	provider.value = state.provider;
	provider.hidden = state.section !== 'users';
	document.querySelectorAll('.accessaudit__tab').forEach(button => {
		button.classList.toggle('active', button.dataset.section === state.section);
		button.addEventListener('click', () => activateSection(button.dataset.section));
	});

	search.addEventListener('input', () => { state.search = search.value; persistView(); render(); });
	negate.addEventListener('change', () => { state.negate = negate.checked; persistView(); render(); });
	provider.addEventListener('change', () => { state.provider = provider.value; persistView(); render(); });
	document.getElementById('accessaudit-refresh').addEventListener('click', load);
	csv.addEventListener('click', event => { event.preventDefault(); exportRows('csv'); });
	json.addEventListener('click', event => { event.preventDefault(); exportRows('json'); });

	persistView();
	load();
});