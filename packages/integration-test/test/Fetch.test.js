import { Window } from 'happy-dom';
import http from 'node:http';
import { describe, it } from 'node:test';
import assert from 'node:assert';

// Express-like wrapper using http to avoid code generation issues
function createExpress() {
	const routes = { GET: {}, POST: {} };
	const server = http.createServer((req, res) => {
		const method = req.method;
		const url = req.url;
		const handler = routes[method]?.[url];
		if (handler) {
			req.get = (name) => req.headers[name.toLowerCase()];
			const headers = {};
			res.set = (key, value) => {
				headers[key] = value;
			};
			res.send = (body) => {
				res.writeHead(200, headers);
				res.end(body);
			};
			handler(req, res);
		} else {
			res.writeHead(404);
			res.end();
		}
	});
	return {
		get: (path, handler) => {
			routes.GET[path] = handler;
		},
		post: (path, handler) => {
			routes.POST[path] = handler;
		},
		listen: (port, callback) => {
			if (callback) {
				server.listen(port, callback);
			} else {
				server.listen(port);
			}
			return server;
		}
	};
}

describe('Fetch', () => {
	it('Can perform a real fetch()', async () => {
		const window = new Window({
			url: 'http://localhost:3001'
		});
		const express = createExpress();

		express.get('/get/json', (_req, res) => {
			res.set('Content-Type', 'application/json');
			res.send('{ "key1": "value1" }');
		});

		const server = express.listen(3001);

		const response = await window.fetch('http://localhost:3001/get/json');

		await new Promise((resolve) => server.close(resolve));

		assert.strictEqual(response.headers.get('content-type'), 'application/json; charset=utf-8');
		assert.strictEqual(response.ok, true);
		assert.strictEqual(response.status, 200);
		assert.strictEqual(response.statusText, 'OK');
		assert.strictEqual(response.url, 'http://localhost:3001/get/json');
		assert.strictEqual(response.redirected, false);

		const json = await response.json();

		assert.strictEqual(json.key1, 'value1');
	});

	it('Can perform a real FormData post request using fetch()', async () => {
		const window = new Window({
			url: 'http://localhost:3001'
		});
		const express = createExpress();

		express.post('/post/formdata', (req, res) => {
			let body = '';
			res.set('Content-Type', 'text/html');
			req.on('data', function (chunk) {
				body += chunk.toString();
			});
			req.on('end', function () {
				res.send(`header:\n${req.headers['content-type']}\n\nbody:\n${body}`);
			});
		});

		const server = express.listen(3001);

		const requestFormData = new window.FormData();

		requestFormData.append('key1', 'value1');
		requestFormData.append('key2', 'value2');

		const response = await window.fetch('http://localhost:3001/post/formdata', {
			method: 'POST',
			body: requestFormData
		});

		assert.strictEqual(response.headers.get('content-type'), 'text/html; charset=utf-8');
		assert.strictEqual(response.ok, true);
		assert.strictEqual(response.status, 200);
		assert.strictEqual(response.statusText, 'OK');
		assert.strictEqual(response.url, 'http://localhost:3001/post/formdata');
		assert.strictEqual(response.redirected, false);

		const text = await response.text();

		await new Promise((resolve) => server.close(resolve));

		assert.strictEqual(
			text.replace(
				/\-\-\-\-HappyDOMFormDataBoundary0\.[a-zA-Z0-9]+/gm,
				'----HappyDOMFormDataBoundary0.noRandom'
			),
			'header:\nmultipart/form-data; boundary=----HappyDOMFormDataBoundary0.noRandom\n\nbody:\n------HappyDOMFormDataBoundary0.noRandom\r\nContent-Disposition: form-data; name="key1"\r\n\r\nvalue1\r\n------HappyDOMFormDataBoundary0.noRandom\r\nContent-Disposition: form-data; name="key2"\r\n\r\nvalue2\r\n------HappyDOMFormDataBoundary0.noRandom--\r\n'
		);
	});
});
