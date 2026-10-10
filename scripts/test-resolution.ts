import assert from 'node:assert';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import {
  handleDeploymentRequest,
  resolveRequestTarget,
  storeMemoryDeploymentFile,
  cacheDeploymentRecord,
  setProductionDeployment,
} from '../src/server/deploymentServer.js';

function createMockHttp(options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
}) {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.url = options.url;
  req.method = options.method || 'GET';
  req.headers = options.headers || {};

  const headersSent: Record<string, string> = {};
  let statusCode = 200;
  let body = '';
  let isFinished = false;

  const res = new ServerResponse(req);
  res.setHeader = (key: string, value: any) => {
    headersSent[key.toLowerCase()] = String(value);
    return res;
  };
  res.getHeader = (key: string) => headersSent[key.toLowerCase()];
  Object.defineProperty(res, 'statusCode', {
    get: () => statusCode,
    set: (val: number) => {
      statusCode = val;
    },
  });
  res.end = (chunk?: any) => {
    if (chunk) {
      body = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
    }
    isFinished = true;
    return res;
  };

  return {
    req,
    res,
    getResponse: () => ({
      statusCode,
      headers: headersSent,
      body,
      isFinished,
    }),
  };
}

async function testDeploymentDirectResolution() {
  console.log('=== VERIFYING DIRECT EDGE DEPLOYMENT SERVING ===\n');

  const testDepId = '77777777-8888-9999-aaaa-bbbbbbbbbbbb';
  const testProjectSlug = 'formylove';

  setProductionDeployment('proj_formylove', testDepId, testProjectSlug);
  cacheDeploymentRecord({
    id: testDepId,
    project_id: 'proj_formylove',
    organization_id: 'org_default',
    status: 'ready',
    storage_path: `deployments/org_default/proj_formylove/${testDepId}`,
    createdAt: Date.now(),
  });

  const liveHtml = '<!DOCTYPE html><html><head><title>Ewura Archive</title><link rel="stylesheet" href="/assets/style.css"></head><body><h1>Live Ewura Archive</h1></body></html>';
  const liveCss = 'body { margin: 0; background-color: #121212; color: #fff; }';
  const liveJs = 'console.log("Ewura Archive Live Engine Running");';

  storeMemoryDeploymentFile(testDepId, 'index.html', Buffer.from(liveHtml), 'text/html; charset=utf-8');
  storeMemoryDeploymentFile(testDepId, 'assets/style.css', Buffer.from(liveCss), 'text/css; charset=utf-8');
  storeMemoryDeploymentFile(testDepId, 'assets/index.js', Buffer.from(liveJs), 'application/javascript; charset=utf-8');

  // 1. Root wildcard request with Vercel headers
  console.log('Test 1: Direct root resolution (formylove.host.doy.best/)');
  {
    const { req, res, getResponse } = createMockHttp({
      url: '/api/deployments?project=formylove',
      headers: {
        host: 'formylove.host.doy.best',
        'x-forwarded-host': 'formylove.host.doy.best',
        'x-matched-path': '/api/deployments',
        'x-forwarded-uri': '/',
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 200);
    assert(resp.headers['content-type']?.includes('text/html'));
    assert(resp.body.includes('Live Ewura Archive'));
    console.log('✔ Test 1: Served Ewura Archive HTML directly on root visit.');
  }

  // 2. CSS asset request with x-matched-path and subpath
  console.log('Test 2: Asset request with subpath (/assets/style.css)');
  {
    const { req, res, getResponse } = createMockHttp({
      url: '/api/deployments?project=formylove&subpath=assets/style.css',
      headers: {
        host: 'formylove.host.doy.best',
        'x-forwarded-host': 'formylove.host.doy.best',
        'x-matched-path': '/api/deployments',
        'x-forwarded-uri': '/assets/style.css',
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 200);
    assert.strictEqual(resp.headers['content-type'], 'text/css; charset=utf-8');
    assert(resp.body.includes('background-color: #121212'));
    console.log('✔ Test 2: CSS asset served directly with text/css MIME.');
  }

  // 3. JS script asset request with subpath
  console.log('Test 3: Script request (/assets/index.js)');
  {
    const { req, res, getResponse } = createMockHttp({
      url: '/api/deployments?project=formylove&subpath=assets/index.js',
      headers: {
        host: 'formylove.host.doy.best',
        'x-forwarded-host': 'formylove.host.doy.best',
        'x-matched-path': '/api/deployments',
        'x-forwarded-uri': '/assets/index.js',
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 200);
    assert(resp.headers['content-type']?.includes('javascript'));
    assert(resp.body.includes('Ewura Archive Live Engine Running'));
    console.log('✔ Test 3: JS asset served directly with javascript MIME.');
  }

  // 4. Client-side SPA route request with subpath (/about/team)
  console.log('Test 4: Client-side SPA route (/about/team)');
  {
    const { req, res, getResponse } = createMockHttp({
      url: '/api/deployments?project=formylove&subpath=about/team',
      headers: {
        host: 'formylove.host.doy.best',
        'x-forwarded-host': 'formylove.host.doy.best',
        'x-matched-path': '/api/deployments',
        'x-forwarded-uri': '/about/team',
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 200);
    assert(resp.headers['content-type']?.includes('text/html'));
    assert(resp.body.includes('Live Ewura Archive'));
    console.log('✔ Test 4: SPA route fell back cleanly to index.html with 200.');
  }

  // 5. Missing asset with extension (/assets/missing.png)
  console.log('Test 5: Missing asset with extension (/assets/missing.png)');
  {
    const { req, res, getResponse } = createMockHttp({
      url: '/api/deployments?project=formylove&subpath=assets/missing.png',
      headers: {
        host: 'formylove.host.doy.best',
        'x-forwarded-host': 'formylove.host.doy.best',
        'x-matched-path': '/api/deployments',
        'x-forwarded-uri': '/assets/missing.png',
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 404);
    assert(!resp.body.includes('Live Ewura Archive'));
    console.log('✔ Test 5: Missing asset correctly returned 404 (not index.html).');
  }

  console.log('\n=== ALL RESOLUTION TESTS PASSED! ===');
}

testDeploymentDirectResolution().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
