import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');

const readJson = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const sendJson = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const streamChat = (res, prompt) => {
  const words = `Streaming response for: ${prompt}`.split(' ');
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  let index = 0;
  const timer = setInterval(() => {
    if (index >= words.length) {
      res.write('event: done\ndata: [DONE]\n\n');
      clearInterval(timer);
      res.end();
      return;
    }
    res.write(`event: message\ndata: ${JSON.stringify({ token: words[index] })}\n\n`);
    index += 1;
  }, 120);
};

const moduleMetadata = {
  chat: { endpoint: 'POST /beta/copilot/conversations/{conversationId}/chat' },
  search: { endpoint: 'POST /beta/copilot/search' },
  retrieval: { endpoint: 'POST /v1.0/copilot/retrieval' },
  meetings: { endpoint: 'GET /v1.0/copilot/users/{userId}/onlineMeetings/{meetingId}/aiInsights' },
  export: { endpoint: 'GET /v1.0/copilot/users/{id}/interactionHistory/getAllEnterpriseInteractions' },
  audit: { endpoint: 'POST /v1.0/subscriptions' },
  reports: { endpoint: 'GET /v1.0/copilot/reports/getMicrosoft365CopilotUserCountSummary' },
  packages: { endpoint: 'GET /beta/copilot/admin/catalog/packages' }
};

export const createServer = () => {
  const auditClients = new Set();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/api/modules') {
      return sendJson(res, 200, moduleMetadata);
    }

    if (req.method === 'POST' && url.pathname === '/api/chat/conversations') {
      return sendJson(res, 201, { conversationId: `conv-${Date.now()}` });
    }

    if (req.method === 'POST' && /\/api\/chat\/[^/]+\/chat$/.test(url.pathname)) {
      const body = await readJson(req).catch(() => ({}));
      return sendJson(res, 200, {
        response: `Answer to: ${body.prompt ?? ''}`,
        citations: [{ title: 'Source doc', webUrl: 'https://contoso.sharepoint.com/sites/demo' }]
      });
    }

    if (req.method === 'GET' && /\/api\/chat\/[^/]+\/chatOverStream$/.test(url.pathname)) {
      const prompt = url.searchParams.get('prompt') ?? 'no prompt';
      return streamChat(res, prompt);
    }

    if (req.method === 'POST' && url.pathname === '/api/search') {
      const body = await readJson(req).catch(() => ({}));
      return sendJson(res, 200, {
        totalCount: 2,
        searchHits: [
          { title: `${body.query ?? 'Query'} result 1`, webUrl: 'https://contoso.sharepoint.com/a', resourceType: 'driveItem' },
          { title: `${body.query ?? 'Query'} result 2`, webUrl: 'https://contoso.sharepoint.com/b', resourceType: 'driveItem' }
        ],
        '@odata.nextLink': '/api/search?page=2'
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/retrieval') {
      const body = await readJson(req).catch(() => ({}));
      return sendJson(res, 200, {
        results: [
          {
            resourceType: body.dataSource ?? 'oneDrive',
            webUrl: 'https://contoso.sharepoint.com/sites/eng/doc1',
            extracts: ['This policy explains VPN onboarding.'],
            relevanceScore: 0.94,
            sensitivityLabelDisplayName: 'Confidential'
          }
        ]
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/meeting-insights') {
      return sendJson(res, 200, {
        meetingNotes: ['Release date confirmed for Q3.'],
        actionItems: [{ text: 'Prepare launch checklist', ownerDisplayName: 'Adele Vance' }]
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/compliance/export') {
      return sendJson(res, 200, {
        interactions: [{ sessionId: 's1', requestId: 'r1', appClass: 'teams', prompt: 'Summarize meeting', response: 'Summary...' }]
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/audit/subscriptions') {
      auditClients.forEach((client) => {
        client.write(`data: ${JSON.stringify({ event: 'subscription-created', ts: new Date().toISOString() })}\n\n`);
      });
      return sendJson(res, 201, { subscriptionId: `sub-${Date.now()}`, status: 'active' });
    }

    if (req.method === 'GET' && url.pathname === '/api/audit/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      auditClients.add(res);
      const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ event: 'heartbeat', ts: new Date().toISOString() })}\n\n`);
      }, 5000);
      req.on('close', () => {
        clearInterval(heartbeat);
        auditClients.delete(res);
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/reports') {
      return sendJson(res, 200, {
        summary: { enabled: 120, active: 78 },
        trend: [
          { date: '2026-01-01', active: 62 },
          { date: '2026-01-02', active: 71 }
        ],
        users: [{ userPrincipalName: 'alex@contoso.com', teamsLastActivity: '2026-01-02' }]
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/packages') {
      return sendJson(res, 200, {
        value: [
          { id: 'pkg1', name: 'Contoso Agent', supportedHosts: ['teams'], elementTypes: ['agent'] },
          { id: 'pkg2', name: 'Support Bot', supportedHosts: ['outlook'], elementTypes: ['bot'] }
        ]
      });
    }

    if (req.method === 'GET' && /\/api\/packages\/[^/]+$/.test(url.pathname)) {
      const id = url.pathname.split('/').pop();
      return sendJson(res, 200, { id, version: '1.0.0', categories: ['Productivity'], availability: 'Tenant' });
    }

    const filePath = url.pathname === '/' ? path.join(publicDir, 'index.html') : path.join(publicDir, url.pathname);
    if (filePath.startsWith(publicDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const extension = path.extname(filePath);
      const contentType = extension === '.css' ? 'text/css' : extension === '.js' ? 'text/javascript' : 'text/html';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(filePath));
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  });

  return server;
};
