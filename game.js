// Ra'Katsa - Katsaho : Logique du jeu

const WORDS = {
  facile: ["chat", "soleil", "voiture", "croissant", "guitare", "maison", "arbre", "fleur", "livre", "table"],
  moyen: ["téléscope", "parapluie", "sirène", "montgolfière", "bibliothèque", "ordinateur", "pharmacie"],
  difficile: ["xylophone", "anémone", "horloge comtoise", "ornithorynque", "archéologie", "photosynthèse"]
};

// --- Utilitaires ---
function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || '';
}
function savePseudo(pseudo) {
  localStorage.setItem('rakatsa_pseudo', pseudo);
}
function getPseudo() {
  return localStorage.getItem('rakatsa_pseudo') || '';
}
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
function getAvatarUrl(peerId) {
  const imgId = Math.abs(hashCode(peerId)) % 70;
  return `https://i.pravatar.cc/150?img=${imgId}`;
}

// --- Initialisation et état du jeu ---
const room = getQueryParam('room');
let pseudo = getQueryParam('pseudo') || getPseudo();
if (!room || !pseudo) window.location.href = 'index.html';
savePseudo(pseudo);

window.gameState = {
  manche: 1,
  tour: 0,
  maxManches: 4,
  scores: {},
  order: [],
  started: false,
  currentWord: ''
};

// --- Logique d'affichage et d'interface ---
function showFinalScores() {
  const root = document.getElementById('game-root');
  if (!root) return;
  const scores = window.gameState.scores || {};
  const order = window.gameState.order || [];
  const playersList = players.reduce((acc, p) => { acc[p.id] = p.pseudo; return acc; }, {});
  let html = `<div style="text-align:center;margin-top:40px;">
    <h2>🏆 Scores finaux</h2>
    <table style="margin:0 auto;font-size:1.3em;background:#f0f9f0;border-radius:12px;padding:16px 32px;box-shadow:0 2px 8px #38A16922;">
      <tr><th>Joueur</th><th>Score</th></tr>`;
  order.forEach(id => {
    html += `<tr><td style="padding:6px 18px;">${playersList[id] || id}</td><td style="padding:6px 18px;text-align:center;">${scores[id] || 0}</td></tr>`;
  });
  html += `</table>
    <div style="margin-top:24px;font-size:1.1em;">Merci d'avoir joué !</div>`;
  if (isHost) {
    html += `<button onclick="window.location.reload()" style="margin-top:18px;font-size:1.1em;padding:8px 24px;border-radius:8px;background:#38A169;color:#fff;border:none;cursor:pointer;">Rejouer</button>`;
  }
  html += `</div>`;
  root.innerHTML = html;
}

function showResult(msg, success = false) {
  const zone = document.getElementById('result-zone');
  if (!zone) return;
  zone.innerHTML = `<div style="font-size:1.2em;color:${success ? '#1a9b1a' : '#b22'};margin:16px 0;">${msg}</div>`;
  if (success) {
    const audio = new Audio('https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae5b2.mp3');
    audio.play().catch(e => {});
  }
}

function startGameUI({ word, drawerId, diff, manche }) {
  console.log('startGameUI called with:', { word, drawerId, diff, manche });
  const root = document.getElementById('game-root');
  if (!root) return;

  // Réinitialise le chat et les devineurs à chaque tour
  window.chatMessages = [];
  window.goodGuessers = new Set();
  window.foundAll = false;

  root.innerHTML = `
    <div id="game-area">
      <div class="game-status-bar">
        <div class="status-item"><span class="status-label">Manche:</span><span class="status-value">${manche}</span><span class="status-max">/${window.gameState.maxManches}</span></div>
        <span class="status-dot">●</span>
        <div class="status-item"><span class="status-label">Difficulté:</span><span class="status-diff">${diff}</span></div>
        <div class="status-item">⏰<span id="chrono-value" style="margin-left:5px;">60</span>s</div>
      </div>
      <div id="word-zone"></div>
      <div id="canvas-zone"><canvas id="draw-canvas" width="400" height="240"></canvas></div>
      <div id="tools-zone"></div>
      <div id="result-zone"></div>
    </div>
  `;

  // Chrono global, synchro pour tous
  if (window.chronoInterval) clearInterval(window.chronoInterval);
  window.chronoInterval = null;
  window.chronoTime = 60;
  function updateChronoDisplay() {
    const chronoVal = document.getElementById('chrono-value');
    if (chronoVal) chronoVal.textContent = window.chronoTime;
  }
  window.startChrono = function() {
    window.stopChrono();
    window.chronoTime = 60;
    updateChronoDisplay();
    window.chronoInterval = setInterval(() => {
      window.chronoTime--;
      updateChronoDisplay();
      if (window.chronoTime <= 0) {
        window.stopChrono();
        showResult('⏰ Temps écoulé !');
        if (isHost) {
          broadcast({ type: 'time-up' });
          setTimeout(nextTurn, 2000);
        }
      }
    }, 1000);
  };
  window.stopChrono = function() {
    if (window.chronoInterval) clearInterval(window.chronoInterval);
    window.chronoInterval = null;
  };
  if (!window.foundAll) window.startChrono();

  // Affichage du mot et des outils
  const isDrawer = (isHost ? room : peer.id) === drawerId;
  console.log('isDrawer determined as:', isDrawer, 'drawerId:', drawerId, 'myId:', isHost ? room : peer.id);
  const wordZone = document.getElementById('word-zone');
  const toolsZone = document.getElementById('tools-zone');

  if (isDrawer) {
    wordZone.innerHTML = `<div>Mot à dessiner : <b>${word}</b></div>`;
    toolsZone.innerHTML = `
      <button id="pencil-btn" title="Crayon"><i class="fa-solid fa-pencil"></i></button>
      <button id="eraser-btn" title="Gomme"><i class="fa-solid fa-eraser"></i></button>
      <button id="clear-btn" title="Effacer tout"><i class="fa-solid fa-trash"></i></button>
      <button id="hint-btn" title="Indice"><i class="fa-solid fa-lightbulb"></i></button>
      <div id="chat-zone">
        <div id="chat-messages"></div>
        <input id="chat-input" maxlength="64" placeholder="Votre message ou proposition..." />
        <button id="chat-btn" title="Envoyer">🚀</button>
      </div>
    `;
    console.log('About to call setupDrawing(true) for drawer');
    setupDrawing(true);
  } else {
    const cases = word.replace(/./g, c => (c === ' ' ? ' ' : '_')).split('').join(' ');
    wordZone.innerHTML = `<div>Mot à deviner : <span style="letter-spacing:0.2em;">${cases}</span></div>`;
    toolsZone.innerHTML = `
      <div id="chat-zone">
        <div id="chat-messages"></div>
        <input id="chat-input" maxlength="64" placeholder="Votre message ou proposition..." />
        <button id="chat-btn" title="Envoyer">🚀</button>
      </div>
    `;
    console.log('About to call setupDrawing(false) for guesser');
    setupDrawing(false);
  }

  updateChatUI(word);
  setupChat(drawerId, word);
  setupHintButton(isDrawer, word);
}

function updateChatUI(currentWord) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const normalize = s => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, "");
  const normalizedWord = normalize(currentWord);

  box.innerHTML = (window.chatMessages || []).map(m => {
    const isCorrect = normalize(m.text) === normalizedWord;
    const style = isCorrect ? "style='color:green; background:#caffca; font-weight:bold;'" : "";
    const icon = isCorrect ? "🎉" : "";
    return `<div ${style}><b>${m.pseudo}</b>: ${m.text} ${icon}</div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

function setupChat(drawerId, word) {
  const chatBtn = document.getElementById('chat-btn');
  const chatInput = document.getElementById('chat-input');
  const myId = isHost ? room : peer.id;

  const sendChatMessage = () => {
    const text = chatInput.value.trim();
    if (!text) return;
    const msg = { type: 'chat', text, pseudo: getPseudo(), id: myId };
    if (isHost) {
      handleData(msg);
      broadcast(msg);
    } else if (connections[0]) {
      connections[0].send(msg);
    }
    chatInput.value = '';
    chatInput.focus();
  };

  chatBtn.onclick = sendChatMessage;
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChatMessage();
  });

  // On désactive le champ de chat pour le dessinateur
  if (myId === drawerId) {
    chatInput.disabled = true;
    chatBtn.disabled = true;
  }
}

function setupHintButton(isDrawer, word) {
  if (!isDrawer) return;
  const hintBtn = document.getElementById('hint-btn');
  if (hintBtn) {
    hintBtn.onclick = () => {
      const hint = `Indice : Le mot commence par <b>${word[0].toUpperCase()}</b> et fait ${word.length} lettres.`;
      const msg = { type: 'chat', text: hint, pseudo: '[INDICE]' };
      if (isHost) {
        handleData(msg);
        broadcast(msg);
      } else if (connections[0]) {
        connections[0].send(msg);
      }
    };
  }
}

// --- Logique de dessin ---
let drawing = false, last = null, drawColor = '#222', drawSize = 2.5, isEraser = false;
let canvas, ctx;

function setupDrawing(isDrawer) {
  canvas = document.getElementById('draw-canvas');
  console.log('setupDrawing called, isDrawer:', isDrawer, 'canvas found:', !!canvas);
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = drawColor;
  ctx.lineWidth = drawSize;
  if (isDrawer) {
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', drawMove);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    
    const pencilBtn = document.getElementById('pencil-btn');
    const eraserBtn = document.getElementById('eraser-btn');
    const clearBtn = document.getElementById('clear-btn');
    
    console.log('Buttons found - pencil:', !!pencilBtn, 'eraser:', !!eraserBtn, 'clear:', !!clearBtn);
    
    if (pencilBtn) {
      pencilBtn.onclick = () => { 
        console.log('Pencil button clicked - setting isEraser to false');
        isEraser = false; 
        pencilBtn.style.background = '#38A169';
        pencilBtn.style.color = '#fff';
        eraserBtn.style.background = '#f0f9f0';
        eraserBtn.style.color = '#38A169';
      };
    }
    if (eraserBtn) {
      eraserBtn.onclick = () => { 
        console.log('Eraser button clicked - setting isEraser to true');
        isEraser = true; 
        eraserBtn.style.background = '#38A169';
        eraserBtn.style.color = '#fff';
        pencilBtn.style.background = '#f0f9f0';
        pencilBtn.style.color = '#38A169';
      };
    }
    if (clearBtn) {
      clearBtn.onclick = () => { 
        console.log('Clear button clicked - clearing canvas');
        clearCanvas(); 
        sendDraw({ type: 'clear' }); 
      };
    }
  }
}
function startDraw(e) { 
  console.log('startDraw called, isEraser:', isEraser);
  drawing = true; 
  last = getPos(e); 
}
function drawMove(e) {
  if (!drawing) return;
  const pos = getPos(e);
  console.log('drawMove called, isEraser:', isEraser, 'from:', last, 'to:', pos);
  if (isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 16;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawSize;
  }
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  sendDraw({ type: 'draw', from: last, to: pos, color: isEraser ? 'erase' : drawColor, size: ctx.lineWidth, isEraser });
  last = pos;
}
function endDraw() { 
  console.log('endDraw called');
  drawing = false; 
}
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function clearCanvas() { 
  console.log('clearCanvas called');
  ctx.clearRect(0, 0, canvas.width, canvas.height); 
}
function sendDraw(data) {
  console.log('sendDraw called with data:', data);
  const payload = { type: 'draw', data };
  if (isHost) {
    broadcast(payload);
  } else if (connections[0]) {
    connections[0].send(payload);
  }
}
function receiveDraw(data) {
  console.log('receiveDraw called with data:', data);
  if (data.type === 'clear') {
    clearCanvas();
  } else if (data.type === 'draw') {
    if (data.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = data.size;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.size;
    }
    ctx.beginPath();
    ctx.moveTo(data.from.x, data.from.y);
    ctx.lineTo(data.to.x, data.to.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
}

// --- Gestion des données (P2P) ---
function handleLobbyData(data) {
  if (data.type === 'players') {
    players = data.players;
    updatePlayersList();
  } else if (data.type === 'lobby-chat') {
    if (!window.lobbyChatMessages) window.lobbyChatMessages = [];
    if (!window.lobbyChatMessages.some(m => m._id === data.msg._id)) {
      window.lobbyChatMessages.push(data.msg);
      updateLobbyChat();
    }
  } else if (data.type === 'start') {
    window.gameState.started = true;
    startGameUI(data);
  }
}

function handleGameData(data) {
  if (data.type === 'draw') {
    receiveDraw(data.data);
    if (isHost) {
      broadcast(data);
    }
  } else if (data.type === 'chat') {
    window.chatMessages.push({ pseudo: data.pseudo, text: data.text });
    updateChatUI(window.gameState.currentWord);
    if (isHost) {
      const normalize = s => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, "");
      const drawerId = window.gameState.order[window.gameState.tour - 1];
      if (normalize(data.text) === normalize(window.gameState.currentWord) && data.id !== drawerId && !window.goodGuessers.has(data.id)) {
        window.goodGuessers.add(data.id);
        window.gameState.scores[data.id] = (window.gameState.scores[data.id] || 0) + 1;
        broadcast({ type: 'update-scores', scores: window.gameState.scores });
      }
      const guessers = players.filter(p => p.id !== drawerId);
      if (window.goodGuessers.size > 0 && window.goodGuessers.size >= guessers.length) {
        window.gameState.scores[drawerId] = (window.gameState.scores[drawerId] || 0) + 1;
        broadcast({ type: 'update-scores', scores: window.gameState.scores });
        broadcast({ type: 'all-found' });
        handleGameData({type: 'all-found'});
      }
    }
  } else if (data.type === 'update-scores') {
    window.gameState.scores = data.scores;
  } else if (data.type === 'all-found') {
    if (!window.foundAll) {
      window.foundAll = true;
      stopChrono();
      showResult(`🎉 Le mot a été trouvé par tous !`, true);
      if (isHost) setTimeout(nextTurn, 3000);
    }
  } else if (data.type === 'start') {
    window.gameState.currentWord = data.word;
    window.gameState.order = data.order || [];
    startGameUI(data);
  } else if (data.type === 'time-up') {
    window.stopChrono();
    showResult('⏰ Temps écoulé !');
  } else if (data.type === 'end-game') {
    showFinalScores();
  }
}

function handleData(data) {
  if (window.gameState.started) {
    handleGameData(data);
  } else {
    if (data.type === 'start') {
      window.gameState.started = true;
      window.gameState.currentWord = data.word;
      window.gameState.order = data.order || [];
    }
    handleLobbyData(data);
  }
}

// --- Flux de la partie ---
function nextTurn() {
  const state = window.gameState;
  state.tour++;
  if (state.tour > state.order.length) {
    state.tour = 1;
    state.manche++;
    // Shuffle order for new manche
    state.order = players.map(p => p.id).sort(() => Math.random() - 0.5);
  }
  if (state.manche > state.maxManches) {
    broadcast({ type: 'update-scores', scores: state.scores });
    showFinalScores();
    broadcast({ type: 'end-game' });
    return;
  }
  const difficulties = Object.keys(WORDS);
  const diff = difficulties[Math.floor(Math.random() * difficulties.length)];
  const word = WORDS[diff][Math.floor(Math.random() * WORDS[diff].length)];
  const drawerId = state.order[state.tour - 1];
  state.currentWord = word;
  const turnData = { type: 'start', word, drawerId, diff, manche: state.manche, order: state.order };
  broadcast(turnData);
  handleData(turnData);
}

function startGame() {
  if (window.gameState.started) return;
  window.gameState.started = true;
  window.gameState.manche = 1;
  window.gameState.tour = 0;
  window.gameState.order = players.map(p => p.id).sort(() => Math.random() - 0.5);
  players.forEach(p => { window.gameState.scores[p.id] = 0; });
  nextTurn();
}

// --- Initialisation du Lobby ---
const root = document.getElementById('game-root');
root.innerHTML = `<div id="wait-room">
  <h2>Salle : <span id="room-code">${room}</span></h2>
  <h3>Bienvenue, <span id="me">${pseudo}</span></h3>
  <ul id="players-list"><em>En attente d'autres joueurs...</em></ul>
  <div id="lobby-chat-zone">
    <div id="lobby-chat-messages"></div>
    <input id="lobby-chat-input" maxlength="64" placeholder="Message dans le lobby..." />
    <button id="lobby-chat-btn">🚀</button>
  </div>
  <div id="host-controls" style="display:none;"><button id="start-btn">Démarrer la partie</button></div>
</div>`;

window.lobbyChatMessages = [];
function updateLobbyChat() {
  const box = document.getElementById('lobby-chat-messages');
  if (!box) return;
  box.innerHTML = window.lobbyChatMessages.map(m => `<div><b>${m.pseudo}</b>: ${m.text}</div>`).join('');
  box.scrollTop = box.scrollHeight;
}
function sendLobbyChat(msg) {
  const payload = { type: 'lobby-chat', msg };
  if (isHost) {
    broadcast(payload);
    handleData(payload);
  } else if (connections[0]) {
    connections[0].send(payload);
  }
}
document.getElementById('lobby-chat-btn').onclick = () => {
  const input = document.getElementById('lobby-chat-input');
  const text = input.value.trim();
  if (!text) return;
  const msg = { pseudo: getPseudo(), text, _id: Date.now() + '-' + getPseudo() };
  sendLobbyChat(msg);
  input.value = '';
  input.focus();
};
document.getElementById('lobby-chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('lobby-chat-btn').click();
});

function updatePlayersList() {
  const listElem = document.getElementById('players-list');
  if (!listElem) return;
  const myId = isHost ? room : peer.id;
  if (!players || players.length === 0) {
    listElem.innerHTML = "<em>En attente d'autres joueurs...</em>";
    return;
  }
  listElem.innerHTML = players.map(p => {
    const isMe = p.id === myId;
    const avatarUrl = getAvatarUrl(p.id);
    const editButtonHTML = isMe ? `<button id="edit-pseudo" title="Changer de pseudo">✏️</button>` : '';
    return `
      <li class="player-item">
        <img src="${avatarUrl}" alt="avatar" class="player-avatar">
        <div class="player-pseudo">
            <span class="${isMe ? 'my-pseudo' : ''}">${p.pseudo}</span>
            ${editButtonHTML}
        </div>
      </li>
    `;
  }).join('');
  const editBtn = document.getElementById('edit-pseudo');
  if (editBtn) {
    editBtn.onclick = () => {
      const span = editBtn.previousElementSibling;
      const currentPseudo = span.textContent;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentPseudo;
      input.maxLength = 16;
      span.replaceWith(input);
      input.focus();
      const savePseudoChange = () => {
        const newPseudo = input.value.trim();
        if (newPseudo && newPseudo !== currentPseudo) {
          savePseudo(newPseudo);
          pseudo = newPseudo;
          players = players.map(p => (p.id === myId ? { ...p, pseudo: newPseudo } : p));
          const payload = { type: 'change-pseudo', id: myId, pseudo: newPseudo };
          if (isHost) {
            broadcast({ type: 'players', players });
          } else {
            connections[0].send(payload);
          }
        }
        updatePlayersList();
      };
      input.onblur = savePseudoChange;
      input.onkeydown = e => { if (e.key === 'Enter') input.blur(); };
    };
  }
}

// --- Connexion PeerJS ---
const isHost = window.location.search.includes('host=1');
let peer, connections = [], players = [];

if (isHost) {
  peer = new Peer(room, { debug: 1 });
  players = [{ pseudo, id: room }];
  peer.on('open', id => {
    document.getElementById('host-controls').style.display = 'block';
    document.getElementById('start-btn').onclick = startGame;
    updatePlayersList();
  });
  peer.on('connection', conn => {
    connections.push(conn);
    conn.on('data', data => {
      if (data.type === 'join') {
        if (!players.some(p => p.id === conn.peer)) {
          players.push({ pseudo: data.pseudo, id: conn.peer });
          conn.send({ type: 'players', players });
          broadcast({ type: 'players', players });
          updatePlayersList();
        }
      } else if (data.type === 'change-pseudo') {
        players = players.map(p => (p.id === data.id ? { ...p, pseudo: data.pseudo } : p));
        broadcast({ type: 'players', players });
        updatePlayersList();
      } else {
        broadcast(data);
        handleData(data);
      }
    });
    conn.on('close', () => {
      players = players.filter(p => p.id !== conn.peer);
      connections = connections.filter(c => c.peer !== conn.peer);
      broadcast({ type: 'players', players });
      updatePlayersList();
    });
    conn.on('open', () => {
      conn.send({ type: 'players', players });
    });
  });
} else {
  peer = new Peer(undefined, { debug: 1 });
  peer.on('open', id => {
    const conn = peer.connect(room);
    connections.push(conn);
    conn.on('open', () => conn.send({ type: 'join', pseudo }));
    conn.on('data', handleData);
    conn.on('close', () => {
      alert("La connexion avec l'hôte a été perdue. La page va se recharger.");
      window.location.reload();
    });
  });
}

function broadcast(msg) {
  connections.forEach(c => {
    if (c && c.open) {
      c.send(msg);
    }
  });
}