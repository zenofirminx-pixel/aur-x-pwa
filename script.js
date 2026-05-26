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
  let selectedMsgIndex = null;
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

  // TYPING INDICATOR VARS
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
    console.log('Toutes les conversations supprimées');
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
    conv.messages.forEach(m => addMessage(m.text, m.type));
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

  /* CHAR COUNTER */
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
  function addMessage(text, type) {
    hideWelcome();
    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${type}`;
    const msg = document.createElement('div');
    msg.className = `msg ${type}`;
    msg.innerHTML = linkify(text);
    msg.dataset.index = messageCounter++;
    wrapper.appendChild(msg);
    chat.appendChild(wrapper);
    chat.scrollTop = chat.scrollHeight;
  }

  /* TYPING INDICATOR ANIMÉ */
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
        addMessage(data.error || "Erreur serveur", 'bot error');
        return;
      }

      await typeMessage(data.reply || "...", 'bot');

      const allMsgs = Array.from(chat.querySelectorAll('.msg:not(.typing)'))
      .map(m => ({
          text: m.textContent,
          type: m.classList.contains('user')? 'user' : 'bot'
        }));
      const title = allMsgs[0]?.text.slice(0, 40) || 'Nouvelle conversation';
      saveConversation(title, allMsgs);

    } catch (e) {
      hideTypingIndicator();
      addMessage('Erreur réseau / serveur', 'bot error');
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
      msg.className = `msg ${type}`;
      wrapper.appendChild(msg);
      chat.appendChild(wrapper);

      let i = 0;
      const interval = setInterval(() => {
        i++;
        msg.innerHTML = linkify(text.slice(0, i));
        chat.scrollTop = chat.scrollHeight;
        if (i >= text.length) {
          clearInterval(interval);
          resolve();
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