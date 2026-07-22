const socket = io();

let currentRoom = null;
let playerId = null;
let username = null;
let isHost = false;
let gameState = 'lobby';
let players = [];
let currentConfig = { undercover: 1, civilians: 3 };
let hasVoted = false;
let isGameStarted = false;

const loginScreen = document.getElementById('loginScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');

const usernameInput = document.getElementById('username');
const roomIdInput = document.getElementById('roomId');
const joinButton = document.getElementById('joinButton');

const roomIdDisplay = document.getElementById('roomIdDisplay');
const playerCount = document.getElementById('playerCount');
const playersContainer = document.getElementById('playersContainer');

const undercoverCount = document.getElementById('undercoverCount');
const civilianCount = document.getElementById('civilianCount');
const totalPlayers = document.getElementById('totalPlayers');
const configuredPlayers = document.getElementById('configuredPlayers');
const configError = document.getElementById('configError');
const startGameBtn = document.getElementById('startGameBtn');

const roleDisplay = document.getElementById('roleDisplay');
const roleIcon = document.getElementById('roleIcon');
const roleTitle = document.getElementById('roleTitle');
const roleWord = document.getElementById('roleWord');
const seenWordBtn = document.getElementById('seenWordBtn');
const waitingMessage = document.getElementById('waitingMessage');

const turnOrderDisplay = document.getElementById('turnOrderDisplay');
const turnOrderList = document.getElementById('turnOrderList');
const startVotingBtn = document.getElementById('startVotingBtn');

const votingDisplay = document.getElementById('votingDisplay');
const votingList = document.getElementById('votingList');
const voteStatus = document.getElementById('voteStatus');

const revelationDisplay = document.getElementById('revelationDisplay');
const revelationContent = document.getElementById('revelationContent');
const continueGameBtn = document.getElementById('continueGameBtn');

const gameOverDisplay = document.getElementById('gameOverDisplay');
const gameOverTitle = document.getElementById('gameOverTitle');
const gameOverContent = document.getElementById('gameOverContent');
const playAgainBtn = document.getElementById('playAgainBtn');

socket.on('connect', () => {
  console.log('Connecté au serveur');
});

socket.on('error', (message) => {
  showToast(message, 'error');
});

socket.on('roomCreated', (data) => {
  currentRoom = data.roomId;
  players = data.players;
  isHost = data.host === socket.id;
  currentConfig = data.config;
  
  roomIdDisplay.textContent = currentRoom;
  updateLobby();
  showScreen('lobby');
  showToast(`Salon ${currentRoom} créé`, 'success');
});

socket.on('roomJoined', (data) => {
  currentRoom = data.roomId;
  players = data.players;
  isHost = data.host === socket.id;
  currentConfig = data.config;
  
  roomIdDisplay.textContent = currentRoom;
  updateLobby();
  showScreen('lobby');
  showToast(`Salon ${currentRoom} rejoint`, 'success');
});

socket.on('playersUpdate', (data) => {
  players = data.players;
  updateLobby();
});

socket.on('playerInfo', (data) => {
  playerId = data.id;
  username = data.username;
  isHost = data.isHost;
});

socket.on('configUpdate', (config) => {
  currentConfig = config;
  undercoverCount.value = config.undercover;
  civilianCount.value = config.civilians;
  updateConfigTotal();
});

socket.on('becomeHost', () => {
  isHost = true;
  showToast('Vous êtes maintenant l\'hôte', 'success');
  updateLobby();
});

socket.on('gameStarted', (data) => {
  isGameStarted = true;
  showScreen('game');
  showToast('La partie commence', 'success');
});

socket.on('roleAssignment', (data) => {
  showRoleCard(data.role, data.word, data.turnOrder);
});

socket.on('allSeenWord', () => {
  showTurnOrder();
});

socket.on('gameReset', () => {
  isGameStarted = false;
  gameState = 'lobby';
  showScreen('lobby');
  showToast('Partie réinitialisée', 'info');
  resetGameUI();
});

socket.on('voteUpdate', (data) => {
  const voteBtn = document.querySelector(`[data-voter-id="${data.voterId}"]`);
  if (voteBtn) {
    voteBtn.textContent = 'Voté';
    voteBtn.disabled = true;
    voteBtn.classList.add('voted');
  }
});

socket.on('voteResult', (data) => {
  showRevelation(data.eliminated, data.eliminatedRole);
});

socket.on('gameOver', (data) => {
  showGameOver(data.winner);
});

function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  
  if (screen === 'login') {
    loginScreen.classList.add('active');
  } else if (screen === 'lobby') {
    lobbyScreen.classList.add('active');
  } else if (screen === 'game') {
    gameScreen.classList.add('active');
  }
}

function updateLobby() {
  if (!players) return;
  
  const count = players.length;
  playerCount.textContent = `${count} joueurs`;
  
  playersContainer.innerHTML = '';
  players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'player-item';
    if (p.isReady) div.classList.add('ready');
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = p.username;
    if (p.id === socket.id) nameSpan.textContent += ' (vous)';
    
    const statusSpan = document.createElement('span');
    statusSpan.className = 'player-status';
    if (p.isReady) {
      statusSpan.textContent = 'Prêt';
      statusSpan.style.color = '#5a8a5a';
    } else {
      statusSpan.textContent = 'En attente';
      statusSpan.style.color = '#5a5a6a';
    }
    
    const hostSpan = document.createElement('span');
    hostSpan.className = 'player-host';
    if (p.id === players.find(pl => pl.isHost)?.id) {
      hostSpan.textContent = 'Hôte';
    }
    
    div.appendChild(nameSpan);
    div.appendChild(hostSpan);
    div.appendChild(statusSpan);
    playersContainer.appendChild(div);
  });
  
  updateConfigTotal();
  
  const canStart = players.length >= 3 && isHost;
  startGameBtn.disabled = !canStart;
  
  if (players.length < 3) {
    startGameBtn.textContent = 'Minimum 3 joueurs';
  } else if (!isHost) {
    startGameBtn.textContent = 'Seul l\'hôte peut lancer';
  } else {
    startGameBtn.textContent = 'Lancer la partie';
  }
  
  const total = parseInt(undercoverCount.value) + parseInt(civilianCount.value);
  if (total !== players.length && isHost) {
    configError.textContent = `Le total (${total}) ne correspond pas au nombre de joueurs (${players.length})`;
    startGameBtn.disabled = true;
  } else {
    configError.textContent = '';
  }
}

function updateConfigTotal() {
  const u = parseInt(undercoverCount.value) || 0;
  const c = parseInt(civilianCount.value) || 0;
  const total = u + c;
  totalPlayers.textContent = total;
  configuredPlayers.textContent = players.length || 0;
}

function showRoleCard(role, word, turnOrder) {
  roleDisplay.style.display = 'block';
  turnOrderDisplay.style.display = 'none';
  votingDisplay.style.display = 'none';
  revelationDisplay.style.display = 'none';
  gameOverDisplay.style.display = 'none';
  
  const roleNames = {
    civil: 'Civil',
    undercover: 'Undercover'
  };
  
  roleIcon.textContent = role === 'undercover' ? '◆' : '●';
  roleIcon.style.color = role === 'undercover' ? '#d88a7a' : '#7aaa7a';
  roleTitle.textContent = roleNames[role] || 'Inconnu';
  roleWord.textContent = word;
  roleWord.style.color = '#e8e8f0';
  
  seenWordBtn.style.display = 'block';
  waitingMessage.style.display = 'none';
  
  window._turnOrder = turnOrder;
}

joinButton.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  if (!name) {
    showToast('Veuillez entrer un pseudo', 'error');
    return;
  }
  
  const roomId = roomIdInput.value.trim().toUpperCase();
  
  if (roomId) {
    socket.emit('joinRoom', { roomId, username: name });
    showToast('Connexion au salon...', 'info');
  } else {
    socket.emit('createRoom', { username: name });
    showToast('Création du salon...', 'info');
  }
});

usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinButton.click();
});

roomIdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinButton.click();
});

undercoverCount.addEventListener('change', updateConfig);
civilianCount.addEventListener('change', updateConfig);

function updateConfig() {
  if (!isHost) return;
  
  const u = parseInt(undercoverCount.value) || 0;
  const c = parseInt(civilianCount.value) || 0;
  
  const config = { undercover: u, civilians: c };
  socket.emit('updateConfig', config);
}

startGameBtn.addEventListener('click', () => {
  if (!isHost) return;
  socket.emit('startGame');
});

seenWordBtn.addEventListener('click', () => {
  seenWordBtn.style.display = 'none';
  waitingMessage.style.display = 'block';
  socket.emit('seenWord');
});

startVotingBtn.addEventListener('click', () => {
  turnOrderDisplay.style.display = 'none';
  votingDisplay.style.display = 'block';
  showVoting();
});

continueGameBtn.addEventListener('click', () => {
  socket.emit('endVoting');
  revelationDisplay.style.display = 'none';
});

playAgainBtn.addEventListener('click', () => {
  socket.emit('resetGame');
});

document.getElementById('leaveLobby').addEventListener('click', () => {
  if (confirm('Quitter le salon ?')) {
    location.reload();
  }
});

function showTurnOrder() {
  roleDisplay.style.display = 'none';
  turnOrderDisplay.style.display = 'block';
  votingDisplay.style.display = 'none';
  revelationDisplay.style.display = 'none';
  gameOverDisplay.style.display = 'none';
  
  const order = window._turnOrder || [];
  turnOrderList.innerHTML = '';
  
  order.forEach((id, index) => {
    const player = players.find(p => p.id === id);
    if (player) {
      const div = document.createElement('div');
      div.className = 'turn-order-item';
      if (id === socket.id) div.classList.add('current');
      
      const numSpan = document.createElement('span');
      numSpan.className = 'turn-number';
      numSpan.textContent = `${index + 1}.`;
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'turn-name';
      nameSpan.textContent = player.username;
      if (id === socket.id) nameSpan.textContent += ' (vous)';
      
      div.appendChild(numSpan);
      div.appendChild(nameSpan);
      turnOrderList.appendChild(div);
    }
  });
}

function showVoting() {
  const alivePlayers = players.filter(p => {
    return true;
  });
  
  votingList.innerHTML = '';
  hasVoted = false;
  
  alivePlayers.forEach(p => {
    if (p.id === socket.id) return;
    
    const div = document.createElement('div');
    div.className = 'vote-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'vote-name';
    nameSpan.textContent = p.username;
    
    const voteBtn = document.createElement('button');
    voteBtn.className = 'vote-btn';
    voteBtn.textContent = 'Voter';
    voteBtn.dataset.voterId = p.id;
    voteBtn.addEventListener('click', () => {
      if (hasVoted) return;
      socket.emit('vote', { targetId: p.id });
      hasVoted = true;
      voteBtn.textContent = 'Voté';
      voteBtn.disabled = true;
      voteBtn.classList.add('voted');
      
      document.querySelectorAll('.vote-btn').forEach(b => {
        if (b !== voteBtn) {
          b.disabled = true;
        }
      });
      
      voteStatus.textContent = 'Vote enregistré, en attente...';
    });
    
    div.appendChild(nameSpan);
    div.appendChild(voteBtn);
    votingList.appendChild(div);
  });
  
  if (alivePlayers.length <= 1) {
    voteStatus.textContent = 'Plus assez de joueurs pour voter';
  }
}

function showRevelation(eliminatedId, role) {
  votingDisplay.style.display = 'none';
  revelationDisplay.style.display = 'block';
  
  const player = players.find(p => p.id === eliminatedId);
  const roleNames = {
    civil: 'Civil',
    undercover: 'Undercover'
  };
  
  revelationContent.innerHTML = `
    <div class="revelation-content">
      <p>Joueur éliminé :</p>
      <div class="eliminated-name">${player ? player.username : 'Inconnu'}</div>
      <div class="eliminated-role">${roleNames[role] || role}</div>
    </div>
  `;
  
  continueGameBtn.style.display = 'block';
}

function showGameOver(winner) {
  gameOverDisplay.style.display = 'block';
  roleDisplay.style.display = 'none';
  turnOrderDisplay.style.display = 'none';
  votingDisplay.style.display = 'none';
  revelationDisplay.style.display = 'none';
  
  const winners = {
    civils: { text: 'Les Civils gagnent', class: 'winner-civils' },
    undercover: { text: 'Les Undercover gagnent', class: 'winner-undercover' }
  };
  
  const win = winners[winner] || { text: 'Partie terminée', class: '' };
  gameOverTitle.textContent = 'Fin de partie';
  gameOverContent.innerHTML = `
    <div class="game-over-content">
      <div class="winner-text ${win.class}">${win.text}</div>
    </div>
  `;
  
  playAgainBtn.style.display = isHost ? 'block' : 'none';
  if (!isHost) {
    gameOverContent.innerHTML += '<p style="color:#5a5a6a;margin-top:16px;">En attente de l\'hôte...</p>';
  }
}

function resetGameUI() {
  roleDisplay.style.display = 'none';
  turnOrderDisplay.style.display = 'none';
  votingDisplay.style.display = 'none';
  revelationDisplay.style.display = 'none';
  gameOverDisplay.style.display = 'none';
}

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 3000);
}

showScreen('login');
console.log('Undercover - Jeu de déduction');