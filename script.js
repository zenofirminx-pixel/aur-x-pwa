const CONFIG = {
  ACTIVE_API: 'openai',
  ENDPOINTS: { openai: 'https://aur-x-backend.vercel.app/api/chat' },
  MODELS: { openai: 'gpt-4o-mini' }
};

// Variables globales auth
let isLoggedIn = false;
let serverConversations = [];
let conversations = JSON.parse(localStorage.getItem('aurx_convs') || '[]');
let currentConvId = null; // ← ça reste null
let settings = JSON.parse(localStorage.getItem('aurx_settings') || '{"anim":true,"autosave":true,"timestamp":true,"notif":true}');
let messageCounter = 0;

checkLogin();

async function checkLogin() {
  try {
    const res = await fetch('https://aur-x-backend.vercel.app/api/history', {
      credentials: 'include'
    });

    if (!res.ok) throw new Error('No session');

    isLoggedIn = true;
    const data = await res.json();
    serverConversations = data.conversations || [];

    conversations = serverConversations.length
    ? serverConversations
      : JSON.parse(localStorage.getItem('aurx_convs') || '[]');

    // 🔥 FIX 1 : SET LE CONVID SUR LA DERNIÈRE CONVO SERVEUR
    if (serverConversations.length > 0) {
      currentConvId = serverConversations[0].id; // la plus récente
    } else {
      // Aucune convo serveur : crée en une
      currentConvId = await createNewConversation();
    }

  } catch (e) {
    isLoggedIn = false;
    conversations = JSON.parse(localStorage.getItem('aurx_convs') || '[]');

    // 🔥 FIX 2 : FALLBACK LOCALSTORAGE
    if (conversations.length > 0) {
      currentConvId = conversations[0].id;
    } else {
      currentConvId = Date.now().toString(); // seulement si pas connecté
    }
  }

  renderHistory();
  renderMessages(); // ← affiche les messages de la convo actuelle
}

// 🔥 FIX 3 : FONCTION POUR CRÉER CONVO SERVEUR
async function createNewConversation() {
  const res = await fetch('https://aur-x-backend.vercel.app/api/conversations', {
    method: 'POST',
    credentials: 'include'
  });
  const { convId } = await res.json();
  return convId;
}

// 🔥 FIX 4 : QUAND TU ENVOIES UN MESSAGE
async function sendMessage(text) {
  if (!currentConvId) {
    currentConvId = await createNewConversation();
  }

  const res = await fetch('https://aur-x-backend.vercel.app/api/chat', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: text,
      convId: currentConvId // ← utilise toujours l'ID serveur
    })
  });

  //... reste de ton code
}

// 🔥 FIX 5 : RENDER LES MESSAGES DE LA CONVO ACTUELLE
function renderMessages() {
  const currentConv = conversations.find(c => c.id === currentConvId);
  if (!currentConv) return;

  const messages = currentConv.messages || [];
  // ton code pour afficher messages dans le DOM
  messages.forEach(m => {
    // addMessageToDOM(m.text, m.type)
  });
}

// 🔥 FIX 6 : QUAND TU SWITCH DE CONVO DANS LA SIDEBAR
function selectConversation(id) {
  currentConvId = id;
  renderMessages();
}


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
  if (!text) return text;
  
  // 🔥 Protège seulement les prix genre 5$ 20$ mais laisse $x$ intact
  return text.replace(/(\d)\$/g, '$1\\$');
}
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
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
    if (!isLoggedIn) localStorage.removeItem('aurx_current');
    sidebar?.classList.remove('open');
  });

  deleteAllBtn?.addEventListener('click', async () => {
    if (!confirm('WIPE toutes les conversations? Cette action est irréversible.')) return;
    
    if (isLoggedIn) {
      await fetch('https://aur-x-backend.vercel.app/api/deleteAll', {
        method: 'POST',
        credentials: 'include'
      });
      serverConversations = [];
      conversations = [];
    } else {
      localStorage.removeItem('aurx_convs');
      localStorage.removeItem('aurx_current');
      conversations = [];
    }
    
    currentConvId = null;
    chat.innerHTML = '<div id="welcome">AurX AI<span>Pose-moi une question</span></div>';
    renderHistory();
    sidebar?.classList.remove('open');
  });

  function renderHistory() {
    if (!convList) return;
    convList.innerHTML = '';
    const convsToShow = isLoggedIn ? serverConversations : conversations;
    
    if (convsToShow.length === 0) {
      convList.innerHTML = '<div class="empty">Aucune conversation</div>';
      return;
    }
    convsToShow.forEach(conv => {
      const item = document.createElement('div');
      item.className = 'conv-item';
      item.textContent = conv.title || 'Nouvelle conversation';
      item.onclick = () => loadConversation(conv.id);
      convList.appendChild(item);
    });
  }

  function loadConversation(id) {
    currentConvId = id;
    if (!isLoggedIn) localStorage.setItem('aurx_current', id);
    
    const conv = (isLoggedIn ? serverConversations : conversations).find(c => c.id === id);
    if (!conv) return;
    chat.innerHTML = '';
    document.getElementById('welcome')?.classList.add('hidden');
    try {
      conv.messages.forEach(m => addMessage(m.text, m.type, m.timestamp || Date.now(), false));
    } catch(e) {
      console.error('Erreur load conv:', e);
      chat.innerHTML = '<div class="msg bot">Erreur de chargement</div>';
    }
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
  }

  async function saveConversation(title, messages) {
    if (!settings.autosave || messages.length === 0) return;

    if (isLoggedIn) {
      try {
        await fetch('https://aur-x-backend.vercel.app/api/chat', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messages[messages.length - 1].text,
            convId: currentConvId,
            title: title,
            saveOnly: true
          })
        });
        return;
      } catch(e) {
        console.error('Save serveur failed');
      }
    }

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
  
function addMessage(text, type, timestamp = null, isNew = true) {
    if (isNew) hideWelcome();
    try {
      const parts = parseMessage(text);
      parts.forEach(part => {
        const wrapper = document.createElement('div');
        wrapper.dataset.timestamp = timestamp || Date.now();
        if (type === 'user') {
          wrapper.className = `msg-wrapper user`;
          const msg = document.createElement('div');
          msg.className = `msg user`;
          const processedText = autoMathify(part.content);
          msg.innerHTML = formatMessage(processedText);
          msg.dataset.index = messageCounter++;
          wrapper.appendChild(msg);
        } else if (part.type === 'code') {
          wrapper.className = `msg-wrapper bot`;
          const msg = document.createElement('div');
          msg.className = `msg bot`;
          msg.innerHTML = formatMessage('```' + part.lang + '\n' + part.content + '```');
          msg.dataset.index = messageCounter++;
          wrapper.appendChild(msg);
        } else {
          wrapper.className = `msg-wrapper bot-full`;
          const msg = document.createElement('div');
          msg.className = `msg bot-full-text`;
          msg.innerHTML = formatMessage(part.content);
          msg.dataset.index = messageCounter++;
          wrapper.appendChild(msg);
        }
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
    typingElement.id = 'typingIndicator';
    
    typingElement.innerHTML = `
      <div class="aurx-thinking spinning">
        <img src="icon-static.png" alt="AurX thinking">
      </div>
      <span class="typing-text">AurX réfléchit...</span>
    `;
    
    chat.appendChild(typingElement);
    setTimeout(() => {
      const text = typingElement.querySelector('.typing-text');
      if (text) text.classList.add('show');
    }, 100);
    chat.scrollTop = chat.scrollHeight;
  }

  function hideTypingIndicator() {
    clearTimeout(thinkingTimeout);
    if (typingElement) {
      typingElement.remove();
      typingElement = null;
    }
  }
async function sendMessage() {
  const msg = input.value.trim();
  if (!msg) return;
  
  const now = Date.now();
  addMessage(msg, 'user', now);
  
  const convsToUse = isLoggedIn ? serverConversations : conversations;
  let currentConv = convsToUse.find(c => c.id === currentConvId);
  
  if (!currentConv) {
    currentConv = { id: currentConvId, title: msg.slice(0, 40), messages: [], date: now, updatedAt: now };
    convsToUse.unshift(currentConv);
  }
  currentConv.messages.push({ text: msg, type: 'user', timestamp: now });
  
  input.value = '';
  input.style.height = 'auto';
  updateCharCounter();
  showTypingIndicator();
  
  const sendBtnEl = document.getElementById('sendBtn');
  sendBtnEl.classList.add('loading');
  sendBtnEl.disabled = true;
  
  const botTime = Date.now();
  const wrapper = document.createElement('div');
  wrapper.className = 'msg-wrapper bot-full';
  wrapper.dataset.timestamp = botTime;
  
  const msgEl = document.createElement('div');
  msgEl.className = 'msg bot-full-text';
  wrapper.appendChild(msgEl);
  
  let cursor = null;
  let isDone = false;
  
  if (settings.timestamp) {
    const time = document.createElement('div');
    time.className = 'msg-time';
    time.textContent = new Date(botTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    wrapper.appendChild(time);
  }
  
  chat.appendChild(wrapper);
  chat.scrollTop = chat.scrollHeight;
  hideWelcome();
  
  let rawText = '';
  let pendingText = '';
  let rafId = null;
  let cursorTimeout = null;
  
  function showPauseCursor() {
    if (!cursor && msgEl.isConnected && !isDone) {
      cursor = document.createElement('span');
      cursor.className = 'streaming-cursor';
      msgEl.appendChild(cursor);
    }
  }
  
  function hidePauseCursor() {
    if (cursor) {
      cursor.remove();
      cursor = null;
    }
    if (cursorTimeout) {
      clearTimeout(cursorTimeout);
      cursorTimeout = null;
    }
  }
  
  function flushBuffer() {
    if (pendingText) {
      rawText += pendingText;
      pendingText = '';
      
      hidePauseCursor();
      
      // 🔥 TEXTE BRUT PENDANT STREAM
      msgEl.textContent = rawText;
      
      const nearBottom = chat.scrollHeight - chat.clientHeight - chat.scrollTop < 150;
      if (nearBottom) chat.scrollTop = chat.scrollHeight;
    }
    
    if (!isDone) {
      clearTimeout(cursorTimeout);
      cursorTimeout = setTimeout(showPauseCursor, 5000);
    }
    
    rafId = null;
  }
  
  function scheduleRender() {
    if (!rafId) {
      hidePauseCursor();
      rafId = requestAnimationFrame(flushBuffer);
    }
  }
  
  try {
    const res = await fetch(CONFIG.ENDPOINTS.openai, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        api: 'openai', 
        message: msg, 
        convId: currentConvId, 
        model: CONFIG.MODELS.openai 
      })
    });
    
    hideTypingIndicator();
    
    if (!res.ok) {
      isDone = true;
      if (rafId) cancelAnimationFrame(rafId);
      hidePauseCursor();
      msgEl.innerHTML = '<span class="error">Erreur serveur</span>';
      currentConv.messages.push({ text: 'Erreur serveur', type: 'bot error', timestamp: Date.now() });
      saveConversation(msg.slice(0, 40), currentConv.messages);
      return;
    }
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          if (data === '[DONE]') {
            isDone = true;
            if (rafId) cancelAnimationFrame(rafId);
            hidePauseCursor();
            
            if (pendingText) {
              rawText += pendingText;
              pendingText = '';
            }
            
            // 🔥 RENDU FINAL ICI
            msgEl.innerHTML = formatMessage(rawText, false);
            renderMathStrict(msgEl);
            highlightCode();
            
            currentConv.messages.push({ text: rawText, type: 'bot', timestamp: Date.now() });
            saveConversation(msg.slice(0, 40), currentConv.messages);
            
            if (isLoggedIn) {
              try {
                const histRes = await fetch('https://aur-x-backend.vercel.app/api/history', { credentials: 'include' });
                const histData = await histRes.json();
                serverConversations = histData.conversations || [];
                conversations = serverConversations;
                renderHistory();
              } catch(e) {
                console.warn('Erreur refresh history:', e);
              }
            }
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              pendingText += parsed.content;
              scheduleRender();
            }
            if (parsed.error) {
              isDone = true;
              if (rafId) cancelAnimationFrame(rafId);
              hidePauseCursor();
              msgEl.innerHTML = `<span class="error">${escapeHtml(parsed.error)}</span>`;
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {
    isDone = true;
    if (rafId) cancelAnimationFrame(rafId);
    hideTypingIndicator();
    hidePauseCursor();
    msgEl.innerHTML = '<span class="error">Erreur réseau / serveur</span>';
    currentConv.messages.push({ text: 'Erreur réseau / serveur', type: 'bot error', timestamp: Date.now() });
    saveConversation(msg.slice(0, 40), currentConv.messages);
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
              time.textContent = new Date(Number(timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              wrapper.appendChild(time);
            }
            partIndex++;
            charIndex = 0;
            setTimeout(typeNext, 100);
          }
        }, speed);
      }
      typeNext();
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  }
  updateCharCounter();
  renderHistory();
  if (currentConvId) loadConversation(currentConvId);
}

function copyCode(btn) {
  const code = btn.nextElementSibling.textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'Copié!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copier';
      btn.classList.remove('copied');
    }, 2000);
  });
}

function highlightCode() {
  if (typeof hljs !== 'undefined') {
    setTimeout(() => {
      document.querySelectorAll('pre code:not(.hljs)').forEach(block => {
        hljs.highlightElement(block);
      });
    }, 0);
  }
}