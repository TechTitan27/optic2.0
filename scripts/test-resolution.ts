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

  // 6. Request with subpath=api/deployments stripped cleanly to root
  console.log('Test 6: Request with subpath=api/deployments stripped to index.html');
  {
    const { req, res, getResponse } = createMockHttp({
      url: '/api/deployments?project=formylove&subpath=api/deployments',
      headers: {
        host: 'formylove.host.doy.best',
        'x-forwarded-host': 'formylove.host.doy.best',
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 200);
    assert(resp.headers['content-type']?.includes('text/html'));
    assert(resp.body.includes('Live Ewura Archive'));
    console.log('✔ Test 6: Cleanly stripped internal api/deployments subpath to index.html.');
  }

  // 7. Direct path resolution /api/deployments/formylove/
  console.log('Test 7: Direct path resolution /api/deployments/formylove/');
  {
    const { req, res, getResponse } = createMockHttp({
      url: '/api/deployments/formylove/',
      headers: {
        host: 'hosting.optic.doy.best',
        'x-forwarded-host': 'hosting.optic.doy.best',
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 200);
    assert(resp.headers['content-type']?.includes('text/html'));
    assert(resp.body.includes('Live Ewura Archive'));
    console.log('✔ Test 7: Direct path /api/deployments/formylove/ served index.html.');
  }

  // 8. Vercel rewrite passing project and deploymentId simultaneously
  console.log('Test 8: Vercel rewrite with project=:slug&deploymentId=:slug');
  {
    const { req, res, getResponse } = createMockHttp({
      url: '/api/deployments?project=formylove&deploymentId=formylove',
      headers: {
        host: 'formylove.host.doy.best',
        'x-forwarded-host': 'formylove.host.doy.best',
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 200);
    assert(resp.headers['content-type']?.includes('text/html'));
    assert(resp.body.includes('Live Ewura Archive'));
    console.log('✔ Test 8: Handled dual project and deploymentId params without loop or error.');
  }

  // 9. Case-insensitive status check ('READY')
  console.log('Test 9: Case-insensitive status check (status: READY)');
  {
    const uppercaseDepId = '99999999-aaaa-bbbb-cccc-dddddddddddd';
    cacheDeploymentRecord({
      id: uppercaseDepId,
      project_id: 'proj_formylove',
      organization_id: 'org_default',
      status: 'READY',
      storage_path: `deployments/org_default/proj_formylove/${uppercaseDepId}`,
      createdAt: Date.now(),
    });
    storeMemoryDeploymentFile(uppercaseDepId, 'index.html', Buffer.from('<h1>Uppercase READY</h1>'), 'text/html; charset=utf-8');

    const { req, res, getResponse } = createMockHttp({
      url: `/api/deployments?deploymentId=${uppercaseDepId}`,
      headers: {
        host: `${uppercaseDepId}.host.doy.best`,
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 200);
    assert(resp.body.includes('Uppercase READY'));
    console.log('✔ Test 9: Case-insensitive status READY served successfully.');
  }

  // 10. Incomplete deployment guard (status: 'building' returns 404)
  console.log('Test 10: Incomplete deployment guard (status: building returns 404)');
  {
    const buildingDepId = '11111111-2222-3333-4444-555555555555';
    cacheDeploymentRecord({
      id: buildingDepId,
      project_id: 'proj_formylove',
      organization_id: 'org_default',
      status: 'building',
      storage_path: `deployments/org_default/proj_formylove/${buildingDepId}`,
      createdAt: Date.now(),
    });

    const { req, res, getResponse } = createMockHttp({
      url: `/api/deployments?deploymentId=${buildingDepId}`,
      headers: {
        host: `${buildingDepId}.host.doy.best`,
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 404);
    assert(resp.body.includes('Deployment Not Ready'));
    console.log('✔ Test 10: Incomplete deployment blocked from public access.');
  }

  // 11. Host *.host.optic.doy.best directly
  console.log('Test 11: Direct access on *.host.optic.doy.best with query strings');
  {
    const { req, res, getResponse } = createMockHttp({
      url: '/?ref=producthunt&theme=dark',
      headers: {
        host: 'formylove.host.optic.doy.best',
        'x-forwarded-host': 'formylove.host.optic.doy.best',
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 200);
    assert(resp.headers['content-type']?.includes('text/html'));
    assert(resp.body.includes('Live Ewura Archive'));
    console.log('✔ Test 11: Host formylove.host.optic.doy.best served deployed HTML directly.');
  }

  // 12. Nested SPA route with trailing slash (/about/team/)
  console.log('Test 12: Nested SPA route with trailing slash (/about/team/)');
  {
    const { req, res, getResponse } = createMockHttp({
      url: '/api/deployments?project=formylove&subpath=about/team/',
      headers: {
        host: 'formylove.host.optic.doy.best',
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 200);
    assert(resp.headers['content-type']?.includes('text/html'));
    assert(resp.body.includes('Live Ewura Archive'));
    console.log('✔ Test 12: Nested SPA route with trailing slash fell back to index.html.');
  }

  // 13. Unknown project returns clear 404, never platform landing page
  console.log('Test 13: Unknown project returns 404 diagnostic page');
  {
    const { req, res, getResponse } = createMockHttp({
      url: '/api/deployments?project=nonexistent-ghost-project',
      headers: {
        host: 'nonexistent-ghost-project.host.optic.doy.best',
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 404);
    assert(resp.body.includes('No Production Deployment') || resp.body.includes('not have an active production deployment'));
    assert(!resp.body.includes('Optic Cloud Platform'));
    console.log('✔ Test 13: Unknown project returned clear 404 diagnostic page.');
  }

  // 14. Deployment UUID resolves only that specific deployment
  console.log('Test 14: Deployment UUID resolves only that specific deployment');
  {
    const v1DepId = '11111111-aaaa-bbbb-cccc-111111111111';
    const v2DepId = '22222222-aaaa-bbbb-cccc-222222222222';

    cacheDeploymentRecord({
      id: v1DepId,
      project_id: 'proj_multi',
      organization_id: 'org_default',
      status: 'ready',
      storage_path: `deployments/org_default/proj_multi/${v1DepId}`,
      createdAt: 1000,
    });
    storeMemoryDeploymentFile(v1DepId, 'index.html', Buffer.from('<h1>Version 1 HTML</h1>'), 'text/html; charset=utf-8');

    cacheDeploymentRecord({
      id: v2DepId,
      project_id: 'proj_multi',
      organization_id: 'org_default',
      status: 'ready',
      storage_path: `deployments/org_default/proj_multi/${v2DepId}`,
      createdAt: 2000,
    });
    storeMemoryDeploymentFile(v2DepId, 'index.html', Buffer.from('<h1>Version 2 HTML</h1>'), 'text/html; charset=utf-8');

    // Project latest is v2
    setProductionDeployment('proj_multi', v2DepId, 'multi-version');

    // Requesting v1 specifically must return Version 1 HTML, NOT v2
    const { req, res, getResponse } = createMockHttp({
      url: `/api/deployments?deploymentId=${v1DepId}`,
      headers: {
        host: `${v1DepId}.host.optic.doy.best`,
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 200);
    assert(resp.body.includes('Version 1 HTML'));
    assert(!resp.body.includes('Version 2 HTML'));
    console.log('✔ Test 14: Immutable deployment UUID resolved only that specific deployment.');
  }

  // 15. Non-hosted domains pass through to normal Optic app
  console.log('Test 15: Main domain and hosting.optic.doy.best pass through to Optic app');
  {
    const { handleApiRequest } = await import('../src/server/apiHandler.js');
    let hostingPassedThrough = false;
    const { req: hostingReq, res: hostingRes } = createMockHttp({
      url: '/',
      headers: {
        host: 'hosting.optic.doy.best',
      },
    });
    handleApiRequest(hostingReq, hostingRes, () => {
      hostingPassedThrough = true;
    });
    assert.strictEqual(hostingPassedThrough, true, 'hosting.optic.doy.best should pass through to Optic app');

    let mainPassedThrough = false;
    const { req: mainReq, res: mainRes } = createMockHttp({
      url: '/dashboard',
      headers: {
        host: 'optic.doy.best',
      },
    });
    handleApiRequest(mainReq, mainRes, () => {
      mainPassedThrough = true;
    });
    assert.strictEqual(mainPassedThrough, true, 'optic.doy.best should pass through to Optic app');
    console.log('✔ Test 15: Main Optic domain and hosting.optic.doy.best continue to render normally.');
  }

  // 16. Missing asset with query params returns 404, not index.html
  console.log('Test 16: Missing asset with query params returns 404');
  {
    const { req, res, getResponse } = createMockHttp({
      url: '/api/deployments?project=formylove&subpath=assets/nonexistent.js&v=1.2.3',
      headers: {
        host: 'formylove.host.optic.doy.best',
      },
    });
    await handleDeploymentRequest(req, res);
    const resp = getResponse();
    assert.strictEqual(resp.statusCode, 404);
    assert(!resp.body.includes('Live Ewura Archive'));
    console.log('✔ Test 16: Missing asset with query params returned 404.');
  }

  console.log('\n=== ALL RESOLUTION TESTS PASSED! ===');
}

testDeploymentDirectResolution().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
