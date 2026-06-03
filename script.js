const CONFIG = {
  ACTIVE_API: 'openai',
  ENDPOINTS: { openai: 'https://aur-x-backend.vercel.app/api/chat' },
  MODELS: { openai: 'gpt-4o-mini' }
};

function linkify(text) {
  if (!text) return '';
  const urlPattern = /(https?:\/\/[^\s<]+)|(www\.[^\s<]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  return text.replace(urlPattern, (url) => {
    if (url.includes('@')) {
      return `<a href="mailto:${url}" class="code-frame" target="_blank" rel="noopener">${url}</a>`;
    }
    if (url.startsWith('www.')) {
      return `<a href="http://${url}" class="code-frame" target="_blank" rel="noopener">${url}</a>`;
    }
    return `<a href="${url}" class="code-frame" target="_blank" rel="noopener">${url}</a>`;
  });
}

function autoMathify(text) {
  if (!text) return '';
  const protected = [];
  text = text.replace(/(\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|```[\s\S]*?```)/g, m => {
    protected.push(m);
    return `__PROTECT_${protected.length-1}__`;
  });
  const superscripts = { '⁰': '^0', '¹': '^1', '²': '^2', '³': '^3', '⁴': '^4', '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9' };
  text = text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, match => superscripts[match] || match);
  const mathRegex = /([a-zA-Z0-9]+\s*[=+\-*/^]\s*[a-zA-Z0-9]+(\^[0-9a-zA-Z\{\}]+)?|[a-zA-Z0-9]+\^[0-9a-zA-Z\{\}]+|sqrt\([^)]+\)|\d+\/\d+|\b(pi|alpha|beta|gamma|theta|lambda|sigma|phi|delta)\b)/g;
  text = text.replace(mathRegex, match => {
    let m = match;
    m = m.replace(/(\d+)\s*\/\s*(\d+)/g, '\\frac{$1}{$2}');
    m = m.replace(/([a-zA-Z0-9])\^(\d+|[a-zA-Z]|\{[^\}]+\})/g, '$1^{$2}');
    m = m.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');
    m = m.replace(/\b(pi|alpha|beta|gamma|theta|lambda|sigma|phi|delta)\b/g, '\\$1');
    m = m.replace(/(\d+)\s*x\s*(\d+)/g, '$1 \\times $2');
    return `$$${m}$$`;
  });
  protected.forEach((m, i) => {
    text = text.replace(`__PROTECT_${i}__`, m);
  });
  return text;
}

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  let conversations = JSON.parse(localStorage.getItem('aurx_convs') || '[]');
  let currentConvId = localStorage.getItem('aurx_current') || null;
  let settings = JSON.parse(localStorage.getItem('aurx_settings') || '{"anim":true,"autosave":true,"timestamp":true,"notif":true}');
  let messageCounter = 0;
  let userId = localStorage.getItem("aurx_user_id");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("aurx_user_id", userId);
  }

  const input = document.getElementById('input');
  const chat = document.getElementById('chat');
  const sendBtn = document.getElementById('sendBtn');
  const circleFg = document.querySelector('.circle-fg');
  const circleText = document.querySelector('.circle-text');
  const acceptTerms = document.getElementById('acceptTerms');
  const continueBtn = document.getElementById('continueBtn');
  const termsScreen = document.getElementById('termsScreen');
  const installBtn = document.getElementById('installBtn');
  const historyBtn = document.getElementById('historyBtn');
  const sidebar = document.getElementById('sidebar');
  const closeSidebar = document.getElementById('closeSidebar');
  const convList = document.getElementById('convList');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettings = document.getElementById('closeSettings');
  const overlay = document.getElementById('overlay');
  const newChatBtn = document.getElementById('newChatBtn');
  const deleteAllBtn = document.getElementById('deleteAllBtn');
  const reviewTermsBtn = document.getElementById('reviewTermsBtn');

  let deferredPrompt = null;
  let typingElement = null;
  let thinkingTimeout = null;

  function hideWelcome() {
    const welcome = document.getElementById('welcome');
    if (welcome) welcome.classList.add('hidden');
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'block';
  });

  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice?.outcome === 'accepted') {
      installBtn.style.display = 'none';
    }
    deferredPrompt = null;
  });

  acceptTerms?.addEventListener('change', () => {
    continueBtn.disabled = !acceptTerms.checked;
    continueBtn.classList.toggle('active', acceptTerms.checked);
  });

  continueBtn?.addEventListener('click', () => {
    if (!acceptTerms.checked) return;
    continueBtn.classList.add('loading');
    continueBtn.disabled = true;
    setTimeout(() => {
      localStorage.setItem('aurx_terms', 'true');
      termsScreen?.classList.add('hidden');
      continueBtn.classList.remove('loading');
      continueBtn.disabled = false;
      acceptTerms.checked = false;
      continueBtn.classList.remove('active');
      continueBtn.disabled = true;
    }, 1000);
  });

  if (localStorage.getItem('aurx_terms') === 'true') {
    termsScreen?.classList.add('hidden');
  }

  reviewTermsBtn?.addEventListener('click', () => {
    settingsModal?.classList.remove('open');
    overlay?.classList.remove('open');
    localStorage.removeItem('aurx_terms');
    termsScreen?.classList.remove('hidden');
    acceptTerms.checked = false;
    continueBtn.classList.remove('active');
    continueBtn.disabled = true;
  });

  historyBtn?.addEventListener('click', () => {
    sidebar?.classList.add('open');
    overlay?.classList.remove('open');
    renderHistory();
  });

  closeSidebar?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
  });

  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    settingsModal?.classList.remove('open');
    overlay?.classList.remove('open');
  });

  newChatBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    chat.innerHTML = '<div id="welcome">AurX AI<span>Pose-moi une question</span></div>';
    currentConvId = null;
    localStorage.removeItem('aurx_current');
    sidebar?.classList.remove('open');
  });

  deleteAllBtn?.addEventListener('click', () => {
    if (!confirm('WIPE toutes les conversations? Cette action est irréversible.')) return;
    localStorage.removeItem('aurx_convs');
    localStorage.removeItem('aurx_current');
    conversations = [];
    currentConvId = null;
    chat.innerHTML = '<div id="welcome">AurX AI<span>Pose-moi une question</span></div>';
    renderHistory();
    sidebar?.classList.remove('open');
  });

  function renderHistory() {
    if (!convList) return;
    convList.innerHTML = '';
    if (conversations.length === 0) {
      convList.innerHTML = '<div class="empty">Aucune conversation</div>';
      return;
    }
    conversations.forEach(conv => {
      const item = document.createElement('div');
      item.className = 'conv-item';
      item.textContent = conv.title || 'Nouvelle conversation';
      item.onclick = () => loadConversation(conv.id);
      convList.appendChild(item);
    });
  }

  function loadConversation(id) {
    currentConvId = id;
    localStorage.setItem('aurx_current', id);
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    chat.innerHTML = '';
    document.getElementById('welcome')?.classList.add('hidden');
    try {
      conv.messages.forEach(m => addMessage(m.text, m.type, m.timestamp || Date.now(), false));
    } catch(e) {
      console.error('Erreur load conv:', e);
      chat.innerHTML = '<div class="msg bot">Erreur de chargement de cette conversation</div>';
    }
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
  }

  function saveConversation(title, messages) {
    if (!settings.autosave || messages.length === 0) return;
    conversations = JSON.parse(localStorage.getItem('aurx_convs') || '[]');
    let id = currentConvId;
    if (!id) {
      id = Date.now().toString();
      currentConvId = id;
    }
    const conv = { id, title, messages, date: Date.now() };
    const index = conversations.findIndex(c => c.id === id);
    if (index > -1) {
      conversations[index] = conv;
    } else {
      conversations.unshift(conv);
    }
    if (conversations.length > 50) {
      conversations = conversations.slice(0, 50);
    }
    localStorage.setItem('aurx_convs', JSON.stringify(conversations));
    localStorage.setItem('aurx_current', id);
  }

  settingsBtn?.addEventListener('click', () => {
    settingsModal?.classList.add('open');
    overlay?.classList.add('open');
  });

  closeSettings?.addEventListener('click', () => {
    settingsModal?.classList.remove('open');
    overlay?.classList.remove('open');
  });

  input?.addEventListener('input', () => {
    updateCharCounter();
    autoResizeInput();
  });

  sendBtn?.addEventListener('click', sendMessage);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && document.activeElement === input) {
      e.preventDefault();
      sendMessage();
    }
  });

  function updateCharCounter() {
    const len = input?.value?.length || 0;
    if (circleFg) {
      circleFg.style.strokeDashoffset = 0;
      circleFg.style.stroke = '#0A84FF';
      circleText.style.color = '#fff';
    }
    if (circleText) circleText.textContent = len;
    if (sendBtn) sendBtn.disabled = len === 0;
  }

  function autoResizeInput() {
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }

  function parseMessage(text) {
    if (!text) return [];
    const parts = [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        if (beforeText.trim()) parts.push({ type: 'text', content: beforeText.trim() });
      }
      parts.push({ type: 'code', lang: match[1] || 'plaintext', content: match[2] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      const afterText = text.slice(lastIndex);
      if (afterText.trim()) parts.push({ type: 'text', content: afterText.trim() });
    }
    if (parts.length === 0) parts.push({ type: 'text', content: text });
    return parts;
  }

  function formatMessage(text) {
    if (!text) return "";
    const mathBlocks = [];
    const codeBlocks = [];
    text = text.replace(/(\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g, match => {
      const id = `__MATH_${mathBlocks.length}__`;
      mathBlocks.push(match);
      return id;
    });
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = `__CODE_${codeBlocks.length}__`;
      codeBlocks.push({ lang: lang || "plaintext", code });
      return id;
    });
    text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    text = text.replace(/^### (.*)$/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.*)$/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.*)$/gm, "<h1>$1</h1>");
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
    text = text.replace(/~~(.*?)~~/g, "<del>$1</del>");
    text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    text = text.replace(/^\- (.*)$/gm, "<li>$1</li>");
    text = text.replace(/^\* (.*)$/gm, "<li>$1</li>");
    text = text.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");
    text = text.replace(/^>\s+(.*)$/gm, "<blockquote>$1</blockquote>");
    text = linkify(text);
    text = text.replace(/\n\n+/g, "</p><p>");
    text = text.replace(/\n/g, "<br>");
    if (!text.startsWith("<h") && !text.startsWith("<ul") && !text.startsWith("<pre") && !text.startsWith("<blockquote")) {
      text = "<p>" + text + "</p>";
    }
    codeBlocks.forEach((block, i) => {
      const escapedCode = block.code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      text = text.replace(`__CODE_${i}__`, `<pre><button class="copy-btn" onclick="copyCode(this)">Copier</button><code class="language-${block.lang}">${escapedCode}</code></pre>`);
    });
    mathBlocks.forEach((math, i) => {
      text = text.replace(`__MATH_${i}__`, math);
    });
    return text;
  }
function addMessage(text, type, timestamp = null, isNew = true, forceBot = false) {
  if (isNew) hideWelcome();
  try {
    const parts = parseMessage(text);
    parts.forEach(part => {
      const wrapper = document.createElement('div');
      wrapper.dataset.timestamp = timestamp || Date.now();

      let msgDiv = document.createElement('div');
      msgDiv.dataset.index = messageCounter++;

      if (type === 'user') {
        wrapper.className = `msg-wrapper user`;
        msgDiv.className = `msg user`;
        const processedText = autoMathify(part.content);
        msgDiv.innerHTML = formatMessage(processedText);
      } else if (forceBot || part.type === 'code') {
        // Streaming ou code → bot classique
        wrapper.className = `msg-wrapper bot`;
        msgDiv.className = `msg bot`;
        if (part.type === 'code') {
          msgDiv.innerHTML = formatMessage('```' + part.lang + '\n' + part.content + '```');
        } else {
          msgDiv.innerHTML = formatMessage(part.content);
        }
      } else {
        wrapper.className = `msg-wrapper bot-full`;
        msgDiv.className = `msg bot-full-text`;
        msgDiv.innerHTML = formatMessage(part.content);
      }

      wrapper.appendChild(msgDiv);

      if (settings.timestamp) {
        const time = document.createElement('div');
        time.className = 'msg-time';
        time.textContent = new Date(Number(wrapper.dataset.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        wrapper.appendChild(time);
      }

      chat.appendChild(wrapper);
    });
    chat.scrollTop = chat.scrollHeight;
    highlightCode();
  } catch(e) {
    console.error('addMessage error:', e);
  }
  return text;
}

  function showTypingIndicator() {
    hideTypingIndicator();
    typingElement = document.createElement('div');
    typingElement.className = 'typing-wrapper';
    typingElement.innerHTML = `
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <span class="typing-text" id="typingText">AurX réfléchit</span>
    `;
    chat.appendChild(typingElement);
    chat.scrollTop = chat.scrollHeight;
    thinkingTimeout = setTimeout(() => {
      document.getElementById('typingText')?.classList.add('show');
    }, 1500);
  }

  function hideTypingIndicator() {
    clearTimeout(thinkingTimeout);
    if (typingElement) {
      typingElement.remove();
      typingElement = null;
    }
  }
  
// ======================
// UI FUNCTIONS
// ======================

function updateLastBotMessage(text) {
  const lastBotWrapper = document.querySelector(".msg-wrapper.bot:last-child");
  if (!lastBotWrapper) return;

  const msgDiv = lastBotWrapper.querySelector(".msg.bot");
  if (!msgDiv) return;

  msgDiv.innerHTML = formatMessage(text);
}
  
async function sendMessage() {
  const msg = input.value.trim();
  if (!msg) return;

  const now = Date.now();
  addMessage(msg, 'user', now);

  const currentMessages = [
    { text: msg, type: 'user', timestamp: now }
  ];

  input.value = '';
  input.style.height = 'auto';
  updateCharCounter();

  showTypingIndicator();

  const sendBtnEl = document.getElementById('sendBtn');
  sendBtnEl.classList.add('loading');
  sendBtnEl.disabled = true;

  try {
    const res = await fetch(CONFIG.ENDPOINTS.openai, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api: 'openai',
        message: msg,
        userId: userId,
        model: CONFIG.MODELS.openai
      })
    });

    hideTypingIndicator();

    if (!res.ok || !res.body) {
      const errorText =
        "⚠️ Le serveur AurX rencontre actuellement un problème.\nRéessaie dans quelques instants.";

      const errTime = Date.now();

      addMessage(errorText, 'bot error', errTime);

      currentMessages.push({
        text: errorText,
        type: 'bot error',
        timestamp: errTime
      });

      saveConversation(msg.slice(0, 40), currentMessages);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let botText = "";
    const botTime = Date.now();

    // création message bot vide
    addMessage("", "bot", botTime);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const json = line.replace("data: ", "");

        if (json === "[DONE]") continue;

        try {
          const parsed = JSON.parse(json);
          const token =
  parsed?.choices?.[0]?.delta?.content ||
  parsed?.choices?.[0]?.message?.content ||
  parsed?.choices?.[0]?.text ||
  parsed?.response;

          if (token) {
            botText += token;
            updateLastBotMessage(botText);
          }
        } catch (e) {}
      }
    }

    currentMessages.push({
      text: botText,
      type: 'bot',
      timestamp: botTime
    });

    saveConversation(msg.slice(0, 40), currentMessages);

  } catch (e) {
    hideTypingIndicator();

    const errorText =
      "⚠️ Impossible de se connecter à AurX.\nVérifie ta connexion Internet puis réessaie.";

    const errTime = Date.now();

    addMessage(errorText, 'bot error', errTime);

    currentMessages.push({
      text: errorText,
      type: 'bot error',
      timestamp: errTime
    });

    saveConversation(msg.slice(0, 40), currentMessages);

    console.error(e);

  } finally {
    sendBtnEl.classList.remove('loading');
    sendBtnEl.disabled = false;
  }
}

  function typeMessage(text, type, timestamp = Date.now()) {
    return new Promise(resolve => {
      const parts = parseMessage(text);
      let partIndex = 0;
      let charIndex = 0;
      const speed = 12;
      function typeNext() {
        if (partIndex >= parts.length) {
          resolve(text);
          return;
        }
        const part = parts[partIndex];
        const wrapper = document.createElement('div');
        wrapper.dataset.timestamp = timestamp;
        if (type === 'user') {
          wrapper.className = `msg-wrapper user`;
        } else if (part.type === 'code') {
          wrapper.className = `msg-wrapper bot`;
        } else {
          wrapper.className = `msg-wrapper bot-full`;
        }
        const msg = document.createElement('div');
        msg.className = type === 'user' ? `msg user streaming` : part.type === 'code' ? `msg bot streaming` : `msg bot-full-text streaming`;
        wrapper.appendChild(msg);
        chat.appendChild(wrapper);
        const fullContent = part.content;
        const interval = setInterval(() => {
          charIndex++;
          const currentText = fullContent.slice(0, charIndex);
          if (part.type === 'code') {
            msg.innerHTML = formatMessage('```' + part.lang + '\n' + currentText + '```');
          } else {
            msg.innerHTML = formatMessage(currentText);
          }
          chat.scrollTop = chat.scrollHeight;
          if (charIndex % 10 === 0 || charIndex >= fullContent.length) {
            highlightCode();
          }
          if (charIndex >= fullContent.length) {
            clearInterval(interval);
            msg.classList.remove('streaming');
            if (settings.timestamp) {
              const time = document.createElement('div');
              time.className = 'msg-time';
              time.textContent = new Date(Number(timest