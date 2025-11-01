/**
 * Integration test: editing the auto 30% Achat preserves provisional charge
 * and creates a new real (isReelle=true) Achat with the edited amount.
 *
 * Prerequisites:
 * - Backend server running on http://localhost:5000
 * - Database reachable/configured as per backend/.env
 *
 * Run:
 *   npm run test:auto30
 */

const http = require('http');

const BASE = process.env.TEST_API_URL || 'http://localhost:5000';

function request(method, path, body) {
	const url = new URL(path, BASE);
	const payload = body ? JSON.stringify(body) : null;
	const opts = {
		method,
		hostname: url.hostname,
		port: url.port || (url.protocol === 'https:' ? 443 : 80),
		path: url.pathname + (url.search || ''),
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': payload ? Buffer.byteLength(payload) : 0,
		},
	};
	return new Promise((resolve, reject) => {
		const req = http.request(opts, (res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				const status = res.statusCode;
				let json = null;
				try { json = data ? JSON.parse(data) : null; } catch (_) {}
				resolve({ status, data: json, raw: data });
			});
		});
		req.on('error', reject);
		if (payload) req.write(payload);
		req.end();
	});
}

function randTag() {
	return Math.random().toString(36).slice(2, 8);
}

async function main() {
	console.log('--- Auto 30% Achat edit test starting ---');

	// 1) Create chantier with prixPrestation so that auto 30% charge is created
	const tag = randTag();
	const payload = {
		numAttachement: `ATT-${Date.now()}-${tag}`,
		numeroCommande: `CMD-${Date.now()}-${tag}`,
		client: 'Test Client',
		natureTravail: 'Test Nature',
		nomChantier: `Test Chantier ${tag}`,
		prixPrestation: 1000,
		dateDebut: '2025-10-01',
		dateFin: '2025-10-10',
	};
	const createCh = await request('POST', '/api/chantiers', payload);
	if (createCh.status !== 201) {
		console.error('FAIL: create chantier status', createCh.status, createCh.data);
		process.exit(1);
	}
	const chantierId = createCh.data?.id || createCh.data?._id || createCh.data?.chantier?.id;
	if (!chantierId) {
		console.error('FAIL: chantier id missing in response', createCh.data);
		process.exit(1);
	}
	console.log('Created chantier id =', chantierId);

	// 2) Fetch charges; locate the auto 30% Achat
	const list1 = await request('GET', `/api/charges/chantier/${chantierId}`);
	if (list1.status !== 200) {
		console.error('FAIL: list charges status', list1.status, list1.data);
		process.exit(1);
	}
	const charges = Array.isArray(list1.data) ? list1.data : [];
	const isAuto30 = (c) => {
		if (!c || c.type !== 'Achat') return false;
		if (c.isAutoThirtyPercent === true) return true;
		const name = String(c.name || '').toLowerCase();
		const desc = String(c.description || '').toLowerCase();
		return (
			name.includes('30%') ||
			name.includes('acompte budget') ||
			desc.includes('30%') ||
			desc.includes('ajout automatique') ||
			desc.includes('budget travaux')
		);
	};
	const auto30 = charges.find(isAuto30);
	if (!auto30) {
		console.error('FAIL: auto 30% achat not found among charges', charges);
		process.exit(1);
	}
	const expected30 = 300; // 30% of 1000
	if (Math.abs(Number(auto30.budget ?? auto30.montant) - expected30) > 0.01) {
		console.error('FAIL: auto 30% amount mismatch, got', auto30, 'expected', expected30);
		process.exit(1);
	}
	console.log('Auto 30% charge found:', { id: auto30._id, amount: auto30.budget, isReelle: auto30.isReelle });

	// 3) Edit the auto 30% Achat (PUT) with new amount; backend should create new real Achat
	const editedAmount = 350;
	const update = await request('PUT', `/api/charges/${auto30._id}`, {
		chantierId,
		type: 'Achat',
		name: auto30.name, // keep same label
		montant: editedAmount,
		description: auto30.description,
	});
	if (update.status !== 200) {
		console.error('FAIL: update auto 30 charge status', update.status, update.data);
		process.exit(1);
	}
	const createdOnEdit = update.data || {};
	if (!createdOnEdit || Number(createdOnEdit.budget ?? createdOnEdit.montant) !== editedAmount) {
		console.error('FAIL: created-on-edit charge amount unexpected', createdOnEdit);
		process.exit(1);
	}
	if (!(createdOnEdit.isReelle === true || createdOnEdit.isReelle === 1 || createdOnEdit.isReelle === '1')) {
		console.error('FAIL: created-on-edit charge is not marked as real (isReelle)', createdOnEdit);
		process.exit(1);
	}
	console.log('Created new real charge:', { id: createdOnEdit._id, amount: createdOnEdit.budget, isReelle: createdOnEdit.isReelle });

	// 4) Re-list charges to verify invariants
	const list2 = await request('GET', `/api/charges/chantier/${chantierId}`);
	const charges2 = Array.isArray(list2.data) ? list2.data : [];
	const stillAuto = charges2.find((c) => String(c._id) === String(auto30._id));
	const realAchat = charges2.find((c) => String(c._id) === String(createdOnEdit._id));
	if (!stillAuto) {
		console.error('FAIL: original auto 30% charge disappeared');
		process.exit(1);
	}
	if (Math.abs(Number(stillAuto.budget ?? stillAuto.montant) - expected30) > 0.01) {
		console.error('FAIL: auto 30% charge was modified unexpectedly', stillAuto);
		process.exit(1);
	}
	if (!realAchat || !(realAchat.isReelle === true || realAchat.isReelle === 1 || realAchat.isReelle === '1')) {
		console.error('FAIL: real achat created on edit not found or not marked real', realAchat);
		process.exit(1);
	}
	if (Math.abs(Number(realAchat.budget ?? realAchat.montant) - editedAmount) > 0.01) {
		console.error('FAIL: real achat amount mismatch', realAchat);
		process.exit(1);
	}

	console.log('PASS: Auto 30% edit behavior works as expected');
	process.exit(0);
}

main().catch((err) => {
	console.error('ERROR:', err);
	console.error('\nHint: Ensure backend server is running at', BASE);
	process.exit(1);
});
