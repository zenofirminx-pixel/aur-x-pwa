const CONFIG = {
  ACTIVE_API: 'openai',
  ENDPOINTS: {
    openai: 'https://aur-x-backend.vercel.app/api/chat'
  },
  MODELS: {
    openai: 'gpt-4o-mini'
  }
};

function linkify(text) {
  if (!text) return '';
  const urlPattern = /(https?:\/\/[^\s<]+)|(www\.[^\s<]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  return text.replace(urlPattern, (url) => {
    if (url.includes('@')) {
      return `<a href="mailto:${url}" target="_blank" rel="noopener">${url}</a>`;
    }
    if (url.startsWith('www.')) {
      return `<a href="http://${url}" target="_blank" rel="noopener">${url}</a>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
  });
}

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  let conversations = JSON.parse(localStorage.getItem('aurx_convs') || '[]');
  let currentConvId = localStorage.getItem('aurx_current') || null;
  let settings = JSON.parse(localStorage.getItem('aurx_settings') || '{"anim":true,"autosave":true,"timestamp":false,"notif":true}');
  let messageCounter = 0;

  // USER ID SYSTEM
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

  /* PWA */
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

  /* TERMS */
  acceptTerms?.addEventListener('change', () => {
    continueBtn.disabled =!acceptTerms.checked;
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

  /* HISTORY */
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
    conv.messages.forEach(m => addMessage(m.text, m.type, false));
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

  /* SETTINGS */
  settingsBtn?.addEventListener('click', () => {
    settingsModal?.classList.add('open');
    overlay?.classList.add('open');
  });

  closeSettings?.addEventListener('click', () => {
    settingsModal?.classList.remove('open');
    overlay?.classList.remove('open');
  });

  /* INPUT */
  input?.addEventListener('input', () => {
    updateCharCounter();
    autoResizeInput();
  });

  sendBtn?.addEventListener('click', sendMessage);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' &&!e.shiftKey && document.activeElement === input) {
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

  /* MESSAGES */
  function formatMessage(text) {
    if (!text) return "";

    // 1. Sauvegarde les blocs de code
    const codeBlocks = [];
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const placeholder = `__CODEBLOCK_${codeBlocks.length}__`;
      codeBlocks.push({ lang: lang || 'plaintext', code });
      return placeholder;
    });

    // 2. Échappe HTML
    text = text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;');

    // 3. Remet les blocs de code avec bouton copier
    codeBlocks.forEach((block, i) => {
      const escapedCode = block.code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      text = text.replace(
        `__CODEBLOCK_${i}__`,
        `<pre><button class="copy-btn" onclick="copyCode(this)">Copier</button><code class="language-${block.lang}">${escapedCode}</code></pre>`
      );
    });

    // 4. Code inline
    text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // 5. Titres
    text = text.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.*)$/gm, '<h1>$1</h1>');

    // 6. Gras et italique
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');

    // 7. Listes
    text = text.replace(/^\- (.*)$/gm, '<li>$1</li>');
    text = text.replace(/^\* (.*)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // 8. Blockquote
    text = text.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>');

    // 9. Liens
    text = linkify(text);

    // 10. Sauts de paragraphe : double retour ligne
    text = text.replace(/\n\n+/g, '</p><p>');

    // 11. Auto-séparation des idées : ajoute un saut si point/exclam/interro suivi d'une majuscule
    text = text.replace(/([.!?])\s+([A-ZÀ-Ÿ])/g, '$1\n$2');

    // 12. Retours ligne simples
    text = text.replace(/\n/g, '<br>');

    if (!text.startsWith('<h') &&!text.startsWith('<ul') &&!text.startsWith('<pre') &&!text.startsWith('<blockquote')) {
      text = '<p>' + text + '</p>';
    }

    return text;
  }

  function addMessage(text, type, isNew = true) {
    hideWelcome();
    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${type}`;
    const msg = document.createElement('div');
    msg.className = `msg ${type}`;
    msg.innerHTML = formatMessage(text);
    msg.dataset.index = messageCounter++;
    wrapper.appendChild(msg);
    chat.appendChild(wrapper);
    chat.scrollTop = chat.scrollHeight;

    highlightCode();
    return text;
  }

  /* TYPING INDICATOR */
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

  /* FETCH */
  async function sendMessage() {
    const msg = input.value.trim();
    if (!msg) return;

    addMessage(msg, 'user');
    const currentMessages = [{text: msg, type: 'user'}];
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

      const data = await res.json().catch(() => ({}));
      hideTypingIndicator();

      if (!res.ok) {
        const errorText = data.error || "Erreur serveur";
        addMessage(errorText, 'bot error');
        currentMessages.push({text: errorText, type: 'bot error'});
        saveConversation(msg.slice(0, 40), currentMessages);
        return;
      }

      const replyText = await typeMessage(data.reply || "...", 'bot');
      currentMessages.push({text: replyText, type: 'bot'});
      saveConversation(msg.slice(0, 40), currentMessages);

    } catch (e) {
      hideTypingIndicator();
      const errorText = 'Erreur réseau / serveur';
      addMessage(errorText, 'bot error');
      currentMessages.push({text: errorText, type: 'bot error'});
      saveConversation(msg.slice(0, 40), currentMessages);
      console.error(e);
    } finally {
      sendBtnEl.classList.remove('loading');
      sendBtnEl.disabled = false;
    }
  }

  function typeMessage(text, type) {
    return new Promise(resolve => {
      hideWelcome();
      const wrapper = document.createElement('div');
      wrapper.className = `msg-wrapper ${type}`;
      const msg = document.createElement('div');
      msg.className = `msg ${type} streaming`; // streaming activé
      wrapper.appendChild(msg);
      chat.appendChild(wrapper);

      let i = 0;
      const interval = setInterval(() => {
        i++;
        msg.innerHTML = formatMessage(text.slice(0, i));
        chat.scrollTop = chat.scrollHeight;

        if (i % 10 === 0 || i >= text.length) {
          highlightCode();
        }

        if (i >= text.length) {
          clearInterval(interval);
          msg.classList.remove('streaming'); // streaming désactivé
          resolve(text);
        }
      }, 12);
    });
  }

  /* SERVICE WORKER */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('SW registered:', reg.scope))
    .catch(err => console.error('SW registration failed:', err));
  }

  updateCharCounter();
}

/* FONCTION COPIER */
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

/* HIGHLIGHT CODE */
function highlightCode() {
  if (typeof hljs!== 'undefined') {
    setTimeout(() => {
      document.querySelectorAll('pre code:not(.hljs)').forEach(block => {
        hljs.highlightElement(block);
      });
    }, 0);
  }
}