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
		csvColumns: {},
	};

	const table = document.getElementById('accessaudit-table');
	const status = document.getElementById('accessaudit-status');
	const search = document.getElementById('accessaudit-search');
	const negate = document.getElementById('accessaudit-negate');
	const provider = document.getElementById('accessaudit-provider');
	const csv = document.getElementById('accessaudit-export-csv');
	const json = document.getElementById('accessaudit-export-json');
	const columnPicker = document.getElementById('accessaudit-csv-columns');
	let loadGeneration = 0;

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
			{ key: 'folders', label: 'Accessible folders', type: 'array', value: row => row.folders || [] },
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
		let saved;
		try {
			saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
		} catch {
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
				if (state.section === 'users' && column.key === 'folders') {
					const content = document.createElement('div');
					if (item.folders) {
						for (const path of item.folders) content.appendChild(badge(path));
					}
					if (!item.foldersComplete) {
						const button = document.createElement('button');
						button.type = 'button';
						button.textContent = item.folders ? 'Incomplete — retry' : 'Load folders';
						button.addEventListener('click', async () => {
							button.disabled = true;
							button.textContent = 'Loading…';
							try { await loadFolders(item); render(); }
							catch (error) { status.textContent = error.message; button.disabled = false; button.textContent = 'Retry folders'; }
						});
						content.appendChild(button);
					}
					cell(row, content);
				} else {
					cell(row, column.display ? column.display(item) : column.value(item));
				}

			}
			tbody.appendChild(row);
		}

		const sortSummary = state.sorts.length
			? ` — sorted by ${state.sorts.map(sort => `${getColumn(sort.key).label} ${sort.direction === 'asc' ? '▲' : '▼'}`).join(', ')}`
			: '';
		status.textContent = `${rows.length} result(s)${sortSummary}`;
	}

	async function exportRows(format) {
		const section = state.section;
		const rows = sortedRows();
		const visibleColumns = columns[state.section].filter(column => format !== 'csv' || state.csvColumns[state.section].includes(column.key));
		if (!visibleColumns.length) return;
		if (state.section === 'users' && visibleColumns.some(column => column.key === 'folders')) {
			csv.setAttribute('aria-disabled', 'true');
			try {
				for (const row of rows) {
					await loadFolders(row);
					if (!row.foldersComplete) throw new Error(`Incomplete folder audit for ${row.uid}. Retry or exclude the folders column.`);
				}
			} catch (error) {
				status.textContent = error.message;
				return;
			} finally {
				csv.removeAttribute('aria-disabled');
			}
		}

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
				let normalized = Array.isArray(value) ? value.join(', ') : escapeText(value);
				if (/^[\s\uFEFF]*[=+@-]/u.test(normalized) || /^[\t\r\n]/u.test(normalized)) normalized = `'${normalized}`;
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
		link.download = `accessaudit-${section}-${timestamp}.${extension}`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
	}

	async function exportPdf() {
		const section = state.section;
		const rows = sortedRows();
		const button = document.getElementById('accessaudit-export-pdf');
		button.disabled = true;
		try {
			if (section === 'users') {
				for (const row of rows) {
					await loadFolders(row);
					if (!row.foldersComplete) throw new Error(`Incomplete folder audit for ${row.uid}. Retry before exporting PDF.`);
				}
			}
			const frame = document.createElement('iframe');
			frame.className = 'accessaudit__print-frame';
			frame.title = 'Access Audit PDF';
			document.body.appendChild(frame);
			const doc = frame.contentDocument;
			doc.title = `Access Audit — ${section}`;
			const sheet = doc.createElement('link');
			sheet.rel = 'stylesheet';
			sheet.href = OC.linkTo('accessaudit', 'css/print.css');
			doc.head.appendChild(sheet);
			const title = doc.createElement('h1');
			title.textContent = `Nextcloud Access Audit — ${section}`;
			const summary = doc.createElement('p');
			summary.textContent = `${new Date().toLocaleString()} — ${rows.length} result(s) — Search: ${state.search || 'All'}${state.negate ? ' (excluded)' : ''} — Provider: ${state.provider || 'All'}`;
			const report = doc.createElement('table');
			const head = doc.createElement('thead');
			const header = doc.createElement('tr');
			for (const column of columns[section]) {
				const th = doc.createElement('th');
				th.textContent = column.label;
				header.appendChild(th);
			}
			head.appendChild(header);
			report.appendChild(head);
			const body = doc.createElement('tbody');
			for (const row of rows) {
				const tr = doc.createElement('tr');
				for (const column of columns[section]) {
					const td = doc.createElement('td');
					const value = column.display ? column.display(row) : column.value(row);
					td.textContent = Array.isArray(value) ? value.join('\n') : escapeText(value);
					tr.appendChild(td);
				}
				body.appendChild(tr);
			}
			report.appendChild(body);
			doc.body.append(title, summary, report);
			sheet.addEventListener('load', () => {
				frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
				frame.contentWindow.focus();
				frame.contentWindow.print();
			}, { once: true });
			sheet.addEventListener('error', () => { frame.remove(); status.textContent = 'Unable to prepare PDF stylesheet. Please retry.'; }, { once: true });
		} catch (error) {
			status.textContent = error.message;
		} finally {
			button.disabled = false;
		}
	}

	async function loadFolders(row) {
		if (row.foldersComplete) return;
		const response = await fetch(OC.generateUrl(`/apps/accessaudit/api/users/${encodeURIComponent(row.uid)}/folders`), { headers: { Accept: 'application/json' } });
		if (!response.ok) throw new Error(`Unable to load folders for ${row.uid}: HTTP ${response.status}`);
		const data = await response.json();
		row.folders = data.folders;
		row.foldersComplete = data.complete;
	}

	function renderColumnPicker() {
		const available = columns[state.section];
		state.csvColumns[state.section] ||= available.map(column => column.key);
		columnPicker.replaceChildren();
		for (const column of available) {
			const label = document.createElement('label');
			const input = document.createElement('input');
			input.type = 'checkbox';
			input.value = column.key;
			input.checked = state.csvColumns[state.section].includes(column.key);
			input.addEventListener('change', () => {
				state.csvColumns[state.section] = [...columnPicker.querySelectorAll('input:checked')].map(item => item.value);
				csv.setAttribute('aria-disabled', String(state.csvColumns[state.section].length === 0));
			});
			label.append(input, document.createTextNode(column.label));
			columnPicker.appendChild(label);
		}
		csv.setAttribute('aria-disabled', String(state.csvColumns[state.section].length === 0));
	}

	async function load() {
		const generation = ++loadGeneration;
		const section = state.section;
		status.textContent = 'Loading…';
		state.rows = [];
		table.querySelector('tbody').replaceChildren();
		table.setAttribute('aria-busy', 'true');
		try {
			const rows = [];
			let offset = 0;
			let page;
			do {
				const response = await fetch(OC.generateUrl(routes[section]) + `?limit=1000&offset=${offset}`, { headers: { Accept: 'application/json' } });
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const data = await response.json();
				if (generation !== loadGeneration) return;
				page = data[section] || [];
				rows.push(...page);
				offset += page.length;
			} while (section !== 'shares' && page.length === 1000);
			state.rows = rows;
			render();
		} catch (error) {
			if (generation === loadGeneration) status.textContent = `Unable to load audit data: ${error.message}`;
		} finally {
			if (generation === loadGeneration) table.removeAttribute('aria-busy');
		}
	}

	function activateSection(section) {
		state.section = section;
		renderColumnPicker();
		document.querySelectorAll('.accessaudit__tab').forEach(tab => tab.classList.toggle('active', tab.dataset.section === section));
		provider.hidden = section !== 'users';

		let saved;
		try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { saved = {}; }
		const urlSort = new URLSearchParams(window.location.search).get('sort');
		state.sorts = parseSorts(urlSort || saved.sorts?.[section] || '');
		persistView();
		load();
	}

	loadSavedState();
	renderColumnPicker();
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
	csv.addEventListener('click', event => { event.preventDefault(); if (csv.getAttribute('aria-disabled') !== 'true') exportRows('csv'); });
	document.getElementById('accessaudit-export-pdf').addEventListener('click', exportPdf);
	json.addEventListener('click', event => { event.preventDefault(); exportRows('json'); });

	persistView();
	load();
});