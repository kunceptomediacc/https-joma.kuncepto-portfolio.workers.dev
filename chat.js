(() => {
  const panel = document.querySelector('.chatbox');
  if (!panel) return;
  const log = panel.querySelector('.chat-log');
  const input = panel.querySelector('.chat-input');
  const send = panel.querySelector('.chat-send');
  if (!log || !input || !send) return;

  const sessionKey = 'chatSessionId';
  let sessionId = sessionStorage.getItem(sessionKey);
  if (!sessionId || !/^[A-Za-z0-9_-]{6,64}$/.test(sessionId)) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(sessionKey, sessionId);
  }

  let busy = false;

  function bubble(role, text) {
    const row = document.createElement('div');
    row.className = `chat-msg ${role}`;
    const line = document.createElement('p');
    line.textContent = text;
    row.appendChild(line);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function showTyping() {
    const row = document.createElement('div');
    row.className = 'chat-msg assistant chat-typing';
    const line = document.createElement('p');
    line.textContent = 'Thinking';
    row.appendChild(line);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  async function ask(raw) {
    if (busy) return;
    const message = String(raw || '').trim();
    if (!message || message.length > 2000) return;
    busy = true;
    send.disabled = true;
    bubble('user', message);
    input.value = '';
    const pending = showTyping();
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, sessionId }),
      });
      const data = await response.json().catch(() => null);
      pending.remove();
      if (response.ok && data && data.ok && data.answer) {
        bubble('assistant', data.answer);
        const sources = Array.isArray(data.sources) ? data.sources.map(entry => (entry && (entry.title || entry.url)) || '').filter(Boolean).slice(0, 3) : [];
        if (sources.length) {
          const note = document.createElement('p');
          note.className = 'chat-sources';
          note.textContent = `Sources: ${sources.join(' · ')}`;
          log.appendChild(note);
          log.scrollTop = log.scrollHeight;
        }
      } else {
        bubble('assistant', (data && data.message) || 'The chat assistant is unavailable right now — please try again in a moment.');
      }
    } catch {
      pending.remove();
      bubble('assistant', 'The chat assistant is offline right now — please try again in a moment.');
    }
    busy = false;
    send.disabled = false;
    input.focus();
  }

  send.addEventListener('click', () => ask(input.value));
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      ask(input.value);
    }
  });
  panel.querySelectorAll('.chat-starters button').forEach(button => {
    button.addEventListener('click', () => ask(button.textContent));
  });

  bubble('assistant', "Hi! I'm Joma's portfolio assistant — ask me anything about his systems, projects, and automation work.");
})();