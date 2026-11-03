const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

async function setup(folderResult = { folders: ['/', '/Team'], complete: true }, respond = null) {
	const dom = new JSDOM(`<button class="accessaudit__tab" data-section="users"></button><button class="accessaudit__tab" data-section="groups"></button><button class="accessaudit__tab" data-section="shares"></button>
		<table id="accessaudit-table"><thead></thead><tbody></tbody></table><div id="accessaudit-status"></div>
		<input id="accessaudit-search"><input id="accessaudit-negate" type="checkbox"><select id="accessaudit-provider"></select>
		<button id="accessaudit-export-pdf"></button><a id="accessaudit-export-csv"></a><a id="accessaudit-export-json"></a><button id="accessaudit-refresh"></button><fieldset id="accessaudit-csv-columns"></fieldset>`, { url: 'https://nextcloud.example.org/', runScripts: 'outside-only' });
	const { window } = dom;
	const calls = [];
	let blob;
	window.OC = { generateUrl: path => path, linkTo: (app, path) => `/custom_apps/${app}/${path}` };
	window.fetch = async path => {
		calls.push(path);
		if (respond) return respond(path);
		return { ok: true, json: async () => path.includes('/folders') ? folderResult : { users: [{ uid: '=cmd', displayName: '<img src=x onerror=alert(1)>', email: 'hidden@example.org', groups: [] }], groups: [] } };
	};
	window.Blob = class { constructor(parts) { this.content = parts.join(''); } };
	window.URL.createObjectURL = value => { blob = value; return 'blob:test'; };
	window.URL.revokeObjectURL = () => {};
	window.HTMLAnchorElement.prototype.click = () => {};
	window.eval(fs.readFileSync('js/accessaudit.js', 'utf8'));
	await settle();
	return { window, calls, content: () => blob?.content, close: () => window.close() };
}

async function settle() { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); }

function select(window, keys) {
	for (const input of window.document.querySelectorAll('#accessaudit-csv-columns input')) {
		input.checked = keys.includes(input.value);
		input.dispatchEvent(new window.Event('change'));
	}
}

function exportCsv(window) { window.document.getElementById('accessaudit-export-csv').dispatchEvent(new window.MouseEvent('click', { cancelable: true })); }

test('CSV selection omits sensitive columns, escapes formulas, and leaves HTML inert', async () => {
	const app = await setup();
	try {
		select(app.window, ['uid', 'displayName']);
		exportCsv(app.window);
		await settle();
		assert.match(app.content(), /^\uFEFF"UID";"Display name"/);
		assert.ok(app.content().includes("'=cmd"));
		assert.ok(!app.content().includes('hidden@example.org'));
		assert.equal(app.calls.filter(path => path.includes('/folders')).length, 0);
		assert.equal(app.window.document.querySelector('tbody img'), null);
	} finally { app.close(); }
});

test('folder selection loads the actual user tree before CSV download', async () => {
	const app = await setup();
	try {
		select(app.window, ['uid', 'folders']);
		exportCsv(app.window);
		await settle();
		assert.ok(app.calls.some(path => path.includes('/%3Dcmd/folders')));
		assert.ok(app.content().includes('/Team'));
	} finally { app.close(); }
});

test('incomplete folder inventories cannot silently become complete exports', async () => {
	const app = await setup({ folders: ['/'], complete: false });
	try {
		select(app.window, ['folders']);
		exportCsv(app.window);
		await settle();
		assert.equal(app.content(), undefined);
		assert.match(app.window.document.getElementById('accessaudit-status').textContent, /Incomplete folder audit/);
	} finally { app.close(); }
});

test('selecting no columns disables CSV export', async () => {
	const app = await setup();
	try {
		select(app.window, []);
		exportCsv(app.window);
		await settle();
		assert.equal(app.content(), undefined);
		assert.equal(app.window.document.getElementById('accessaudit-export-csv').getAttribute('aria-disabled'), 'true');
	} finally { app.close(); }
});


test('PDF report contains the active tab and filtered data with safe text', async () => {
	const app = await setup();
	try {
		app.window.document.getElementById('accessaudit-export-pdf').click();
		await settle();
		const frame = app.window.document.querySelector('iframe');
		assert.ok(frame);
		assert.match(frame.contentDocument.querySelector('h1').textContent, /users/);
		assert.ok(frame.contentDocument.querySelector('tbody').textContent.includes('/Team'));
		assert.equal(frame.contentDocument.querySelector('img'), null);
		let printed = false;
		frame.contentWindow.focus = () => {};
		frame.contentWindow.print = () => { printed = true; };
		frame.contentDocument.querySelector('link').dispatchEvent(new app.window.Event('load'));
		assert.equal(printed, true);
	} finally { app.close(); }
});


for (const section of ['groups', 'shares']) {
	test(`PDF is available for the ${section} tab`, async () => {
		const app = await setup();
		try {
			app.window.document.querySelector(`[data-section="${section}"]`).click();
			await settle();
			app.window.document.getElementById('accessaudit-export-pdf').click();
			await settle();
			const frame = app.window.document.querySelector('iframe');
			assert.ok(frame.contentDocument.querySelector('h1').textContent.includes(section));
			assert.equal(app.calls.filter(path => path.includes('/folders')).length, 0);
		} finally { app.close(); }
	});
}


test('Nextcloud 35 pagination stays within 500 and loads all users', async () => {
	const app = await setup(undefined, path => {
		const params = new URL('https://nextcloud.example.org' + path).searchParams;
		const limit = Number(params.get('limit'));
		const offset = Number(params.get('offset'));
		if (limit > 500) return { ok: false, status: 400 };
		const users = Array.from({ length: Math.min(limit, Math.max(0, 501 - offset)) }, (_, i) => ({ uid: `user-${offset + i}`, groups: [] }));
		return { ok: true, json: async () => ({ users }) };
	});
	try {
		assert.equal(app.calls.length, 2);
		assert.ok(app.calls[0].endsWith('?limit=500&offset=0'));
		assert.ok(app.calls[1].endsWith('?limit=500&offset=500'));
		assert.equal(app.window.document.querySelectorAll('tbody tr').length, 501);
	} finally { app.close(); }
});
