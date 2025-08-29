// Ra'Katsa - Katsaho : Logique principale

// Liste de mots intégrée
window.WORDS = {
  facile: ["chat", "soleil", "voiture", "croissant", "guitare"],
  moyen: ["téléscope", "parapluie", "sirène", "montgolfière"],
  difficile: ["xylophone", "anémone", "horloge comtoise"]
};

// Utilitaires
function randomRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function savePseudo(pseudo) {
  localStorage.setItem('rakatsa_pseudo', pseudo);
}
function getPseudo() {
  return localStorage.getItem('rakatsa_pseudo') || '';
}

// Fonction pour obtenir l'URL de base (compatible GitHub Pages)
function getBaseUrl() {
  const { origin, pathname } = window.location;
  // Si on est sur GitHub Pages, pathname contient le nom du repo
  const pathParts = pathname.split('/').filter(p => p);
  if (pathParts.length > 0 && !pathParts.includes('index.html') && !pathParts.includes('game.html')) {
    return `${origin}/${pathParts[0]}`;
  }
  return origin;
}
  document.getElementById('create-room').onclick = () => {
    const code = randomRoomCode();
  const url = `${getBaseUrl()}/game.html?room=${code}`;
    const roomSection = document.getElementById('room-section');
    roomSection.style.display = '';
    roomSection.innerHTML = `
      <h2>Votre salle : <span id="room-code">${code}</span></h2>
      <input id="pseudo" placeholder="Votre pseudo" value="${getPseudo()}" maxlength="16" style="margin-bottom:12px;" />
      <br>
      <a href="${url}" id="invite-link">${url}</a>
      <div id="qr"></div>
      <button id="go-to-room">Entrer dans la salle</button>
      <div style="margin-top:12px;font-size:0.95em;">Lien à partager : <br><b>${getBaseUrl()}/game.html?room=${code}</b></div>
    `;
    // QR code
    const qr = new QRious({
      element: document.getElementById('qr'),
      value: url,
      size: 160
    });
    document.getElementById('go-to-room').onclick = () => {
      const pseudo = document.getElementById('pseudo').value.trim();
      if (pseudo.length < 2) return alert('Pseudo trop court');
      savePseudo(pseudo);
      // L'hôte a host=1, l'invitation n'a pas host=1
      window.location.href = `${url}&host=1&pseudo=${encodeURIComponent(pseudo)}`;
    };
  };
  document.getElementById('join-room').onclick = () => {
    const roomSection = document.getElementById('room-section');
    roomSection.style.display = '';
    roomSection.innerHTML = `
      <h2>Rejoindre une salle</h2>
      <input id="room-input" placeholder="Code salle (ex: ABCD)" maxlength="4" style="text-transform:uppercase;margin-bottom:12px;" />
      <br>
      <input id="pseudo" placeholder="Votre pseudo" value="${getPseudo()}" maxlength="16" style="margin-bottom:12px;" />
      <br>
      <button id="join-btn">Rejoindre</button>
    `;
    document.getElementById('join-btn').onclick = () => {
      const code = document.getElementById('room-input').value.trim().toUpperCase();
      const pseudo = document.getElementById('pseudo').value.trim();
      if (code.length !== 4) return alert('Code invalide');
      if (pseudo.length < 2) return alert('Pseudo trop court');
      savePseudo(pseudo);
      window.location.href = `${getBaseUrl()}/game.html?room=${code}&pseudo=${encodeURIComponent(pseudo)}`;
    };
  };
}

// ...la logique du jeu sera ajoutée dans game.html...
