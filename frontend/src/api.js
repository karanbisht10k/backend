// API Client for CodeSense Backend

const API_BASE = '';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    credentials: 'include'
  });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errData = await res.json();
      errorMsg = errData.message || errData.error || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  auth: {
    getMe: () => fetchJson(`${API_BASE}/api/auth/me`),
    getLoginUrl: () => fetchJson(`${API_BASE}/api/auth/login-url`),
    demoLogin: () => fetchJson(`${API_BASE}/api/auth/demo-login`, { method: 'POST' }),
    logout: () => fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' })
  },
  repos: {
    list: (refresh = false) => fetchJson(`${API_BASE}/api/repos?refresh=${refresh}`),
    sync: () => fetchJson(`${API_BASE}/api/repos/sync`, { method: 'POST' }),
    import: (repositoryUrl) => fetchJson(`${API_BASE}/api/repos/import`, {
      method: 'POST',
      body: JSON.stringify({ repositoryUrl })
    }),
    get: (id) => fetchJson(`${API_BASE}/api/repos/${id}`),
    index: (id) => fetchJson(`${API_BASE}/api/repos/${id}/index`, { method: 'POST' }),
    status: (id) => fetchJson(`${API_BASE}/api/repos/${id}/status`),
    structure: (id) => fetchJson(`${API_BASE}/api/repos/${id}/structure`),
    getFileContent: (id, path) => fetchJson(`${API_BASE}/api/repos/${id}/file?path=${encodeURIComponent(path)}`)
  },
  chat: {
    createSession: (repositoryId, title) => fetchJson(`${API_BASE}/api/chat/sessions`, {
      method: 'POST',
      body: JSON.stringify({ repositoryId, title })
    }),
    listSessions: (repositoryId) => fetchJson(`${API_BASE}/api/chat/sessions?repositoryId=${repositoryId}`),
    getMessages: (sessionId) => fetchJson(`${API_BASE}/api/chat/sessions/${sessionId}`),
    streamMessage: (sessionId, content, callbacks = {}) => {
      const { onToken, onUserMessage, onAssistantMessage, onDone, onError } = callbacks;

      fetch(`${API_BASE}/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        credentials: 'include',
        body: JSON.stringify({ content })
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Chat stream failed: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep remainder

          let currentEvent = 'message';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.replace('event:', '').trim();
            } else if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.replace('data:', '').trim();

              if (currentEvent === 'token') {
                try {
                  const token = JSON.parse(dataStr);
                  if (onToken) onToken(token);
                } catch {
                  if (onToken) onToken(dataStr);
                }
              } else if (currentEvent === 'user_message') {
                try {
                  const msg = JSON.parse(dataStr);
                  if (onUserMessage) onUserMessage(msg);
                } catch (e) {
                  console.error(e);
                }
              } else if (currentEvent === 'assistant_message') {
                try {
                  const msg = JSON.parse(dataStr);
                  if (onAssistantMessage) onAssistantMessage(msg);
                } catch (e) {
                  console.error(e);
                }
              } else if (currentEvent === 'done') {
                if (onDone) onDone();
              }
            }
          }
        }
        if (onDone) onDone();
      }).catch(err => {
        if (onError) onError(err);
      });
    }
  },
  pullRequests: {
    analyze: (pullRequestUrl, repositoryId) => fetchJson(`${API_BASE}/api/pull-requests/analyze`, {
      method: 'POST',
      body: JSON.stringify({ pullRequestUrl, repositoryId })
    }),
    getAnalysis: (analysisId) => fetchJson(`${API_BASE}/api/pull-requests/analyses/${analysisId}`),
    getImpact: (analysisId) => fetchJson(`${API_BASE}/api/pull-requests/analyses/${analysisId}/impact`),
    getFindings: (analysisId) => fetchJson(`${API_BASE}/api/pull-requests/analyses/${analysisId}/findings`),
    listByRepo: (repositoryId) => fetchJson(`${API_BASE}/api/pull-requests/repository/${repositoryId}`)
  }
};
