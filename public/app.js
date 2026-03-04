const state = { conversationId: null, metadata: {} };

const moduleTitle = document.getElementById('module-title');
const moduleContent = document.getElementById('module-content');
const inspector = document.getElementById('inspector');

const setInspector = (module, request, response) => {
  const endpoint = state.metadata[module]?.endpoint ?? 'unknown';
  inspector.textContent = JSON.stringify({ endpoint, request, response }, null, 2);
};

const run = async (module, request) => {
  const routes = {
    search: ['/api/search', 'POST'],
    retrieval: ['/api/retrieval', 'POST'],
    meetings: ['/api/meeting-insights', 'GET'],
    export: ['/api/compliance/export', 'GET'],
    reports: ['/api/reports', 'GET'],
    packages: ['/api/packages', 'GET']
  };
  const [url, method] = routes[module];
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(request) : undefined
  });
  const payload = await response.json();
  setInspector(module, request, payload);
  return payload;
};

const renderChat = () => {
  moduleContent.innerHTML = `
    <label>Prompt <textarea id="chat-prompt">Summarize this week updates.</textarea></label>
    <label><input type="checkbox" id="stream" /> Stream response</label>
    <button class="run" id="chat-run">Send</button>
    <div class="output" id="chat-output"></div>`;

  document.getElementById('chat-run').onclick = async () => {
    const prompt = document.getElementById('chat-prompt').value;
    const shouldStream = document.getElementById('stream').checked;
    if (!state.conversationId) {
      const create = await fetch('/api/chat/conversations', { method: 'POST' });
      state.conversationId = (await create.json()).conversationId;
    }
    if (!shouldStream) {
      const response = await fetch(`/api/chat/${state.conversationId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, locationHint: Intl.DateTimeFormat().resolvedOptions().timeZone })
      });
      const payload = await response.json();
      setInspector('chat', { prompt, streaming: false }, payload);
      document.getElementById('chat-output').textContent = payload.response;
      return;
    }

    const output = document.getElementById('chat-output');
    output.textContent = '';
    const evtSource = new EventSource(`/api/chat/${state.conversationId}/chatOverStream?prompt=${encodeURIComponent(prompt)}`);
    evtSource.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      output.textContent += `${data.token} `;
    });
    evtSource.addEventListener('done', () => evtSource.close());
    setInspector('chat', { prompt, streaming: true }, { sse: 'connected' });
  };
};

const renderBasic = (module, title, placeholder, requestBuilder = (value) => ({ query: value })) => {
  moduleContent.innerHTML = `
    <label>${title} <input id="input" value="${placeholder}" /></label>
    <button class="run" id="run">Run</button>
    <pre class="output" id="output"></pre>`;

  document.getElementById('run').onclick = async () => {
    const value = document.getElementById('input').value;
    const payload = await run(module, requestBuilder(value));
    document.getElementById('output').textContent = JSON.stringify(payload, null, 2);
  };
};

const renderAudit = () => {
  moduleContent.innerHTML = '<button class="run" id="start">Start monitoring</button><pre class="output" id="events"></pre>';
  const events = document.getElementById('events');
  const source = new EventSource('/api/audit/stream');
  source.onmessage = (event) => {
    events.textContent = `${event.data}\n${events.textContent}`;
  };

  document.getElementById('start').onclick = async () => {
    const response = await fetch('/api/audit/subscriptions', { method: 'POST' });
    const payload = await response.json();
    setInspector('audit', { action: 'create-subscription' }, payload);
  };
};

const renderers = {
  chat: renderChat,
  search: () => renderBasic('search', 'Natural language query', 'Find the latest VPN setup doc'),
  retrieval: () => renderBasic('retrieval', 'Retrieval query', 'VPN onboarding', (queryString) => ({ queryString, dataSource: 'oneDrive' })),
  meetings: () => renderBasic('meetings', 'Meeting ID (optional for mock)', 'meeting-id-123', () => ({})),
  export: () => renderBasic('export', 'User UPN', 'alex@contoso.com', () => ({})),
  audit: renderAudit,
  reports: () => renderBasic('reports', 'Period', 'D30', () => ({})),
  packages: () => renderBasic('packages', 'Filter', 'teams', () => ({}))
};

for (const button of document.querySelectorAll('aside button')) {
  button.addEventListener('click', () => {
    const module = button.dataset.module;
    moduleTitle.textContent = button.textContent;
    renderers[module]();
  });
}

fetch('/api/modules')
  .then((res) => res.json())
  .then((metadata) => {
    state.metadata = metadata;
    renderChat();
  });
