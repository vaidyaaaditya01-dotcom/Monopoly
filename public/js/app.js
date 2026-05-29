// === MONOPOLY CLIENT APP ===

const PLAYER_COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c'];
const PLAYER_TOKENS = ['A','B','C','D','E','F','G','H']; // initials fallback

let socket = null;
let myPlayerId = null;
let myRoomId = null;
let isHost = false;
let gameState = null;
let selectedToken = PLAYER_TOKENS[0];
let selectedColor = PLAYER_COLORS[0];
let takenColors = [];

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  initSocket();
  setupLobby();
  setupTabs();

  // Check URL for room
  const path = window.location.pathname;
  const match = path.match(/\/room\/([A-Z0-9]{6,10})/i);
  if (match) {
    const roomId = match[1].toUpperCase();
    showSetup(roomId);
  }
});

function initSocket() {
  socket = io();

  socket.on('joined_room', ({ roomId, playerId, isHost: host, gameState: gs }) => {
    myPlayerId = playerId;
    myRoomId = roomId;
    isHost = host;
    gameState = gs;
    showWaiting(roomId, gs);
  });

  socket.on('player_joined', ({ player, gameState: gs }) => {
    gameState = gs;
    updateWaitingRoom(gs);
    showToast(`${player.name} joined!`, 'info');
  });

  socket.on('player_left', ({ playerId, gameState: gs }) => {
    gameState = gs;
    if (gs.phase === 'waiting') updateWaitingRoom(gs);
    else updateGame(gs);
    showToast('A player left the game', 'info');
  });

  socket.on('game_started', (data) => {
    gameState = data.gameState;
    showGame();
  });

  socket.on('dice_rolled', (data) => {
    const prevState = gameState;
    gameState = data.gameState;
    animateDice(data.gameState.diceResult);
    // Animate player movement step by step
    const movedPlayer = data.gameState.players.find((p, i) => {
      const prev = prevState && prevState.players[i];
      return prev && prev.position !== p.position;
    });
    if (movedPlayer) {
      const prevPlayer = prevState.players.find(p => p.id === movedPlayer.id);
      const fromPos = prevPlayer ? prevPlayer.position : movedPlayer.position;
      const toPos = movedPlayer.position;
      animatePlayerMovement(movedPlayer.id, fromPos, toPos, prevState, data.gameState, () => {
        updateGame(gameState);
        handleGameEvent(data);
      });
    } else {
      setTimeout(() => {
        updateGame(gameState);
        handleGameEvent(data);
      }, 600);
    }
  });

  socket.on('property_bought', (data) => {
    gameState = data.gameState;
    updateGame(gameState);
    showToast(`${data.spaceName} purchased for $${data.price}!`, 'success');
  });

  socket.on('buy_declined', (data) => {
    gameState = data.gameState;
    updateGame(gameState);
  });

  socket.on('house_built', (data) => {
    gameState = data.gameState;
    updateGame(gameState);
    showToast(`House built on ${data.spaceName}!`, 'success');
  });

  socket.on('house_sold', (data) => {
    gameState = data.gameState;
    updateGame(gameState);
  });

  socket.on('property_mortgaged', (data) => {
    gameState = data.gameState;
    updateGame(gameState);
    showToast('Property mortgaged', 'info');
  });

  socket.on('property_unmortgaged', (data) => {
    gameState = data.gameState;
    updateGame(gameState);
    showToast('Property unmortgaged!', 'success');
  });

  socket.on('jail_fine_paid', (data) => {
    gameState = data.gameState;
    updateGame(gameState);
    showToast('Paid $50 jail fine', 'info');
  });

  socket.on('jail_card_used', (data) => {
    gameState = data.gameState;
    updateGame(gameState);
    showToast('Used Get Out of Jail Free card!', 'success');
  });

  socket.on('turn_ended', (data) => {
    gameState = data.gameState;
    if (data.event === 'game_over') {
      showWinner(data.winner);
    }
    updateGame(gameState);
  });

  socket.on('error', ({ message }) => {
    showToast(message, 'error');
  });
}

// === LOBBY ===
function setupLobby() {
  document.getElementById('btn-create').addEventListener('click', async () => {
    const res = await fetch('/api/create-room', { method: 'POST' });
    const { roomId } = await res.json();
    history.pushState({}, '', `/room/${roomId}`);
    showSetup(roomId);
  });

  document.getElementById('btn-join').addEventListener('click', () => {
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (!code) { showToast('Enter a room code', 'error'); return; }
    history.pushState({}, '', `/room/${code}`);
    showSetup(code);
  });

  document.getElementById('join-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-join').click();
  });
}

// === SETUP ===
async function showSetup(roomId) {
  // Verify room exists
  const res = await fetch(`/api/room/${roomId}`);
  const info = await res.json();
  if (!info.exists) {
    showToast('Room not found', 'error');
    history.pushState({}, '', '/');
    return;
  }

  takenColors = info.players.map(p => p.color);
  myRoomId = roomId;

  document.getElementById('setup-room-id').textContent = roomId;
  document.getElementById('btn-copy-link').addEventListener('click', () => {
    copyToClipboard(window.location.href);
    showToast('Link copied!', 'success');
  });

  // Build token grid
  const tokenGrid = document.getElementById('token-grid');
  tokenGrid.innerHTML = '';
  PLAYER_TOKENS.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className = 'token-btn' + (i === 0 ? ' selected' : '');
    btn.textContent = t;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.token-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedToken = t;
    });
    tokenGrid.appendChild(btn);
  });

  // Build color grid
  const colorGrid = document.getElementById('color-grid');
  colorGrid.innerHTML = '';
  PLAYER_COLORS.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'color-btn' + (i === 0 ? ' selected' : '') + (takenColors.includes(c) ? ' taken' : '');
    btn.style.background = c;
    btn.disabled = takenColors.includes(c);
    btn.addEventListener('click', () => {
      if (takenColors.includes(c)) return;
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = c;
    });
    colorGrid.appendChild(btn);
  });

  // Auto-select first available color
  const firstAvailable = PLAYER_COLORS.find(c => !takenColors.includes(c));
  if (firstAvailable) {
    selectedColor = firstAvailable;
    const idx = PLAYER_COLORS.indexOf(firstAvailable);
    document.querySelectorAll('.color-btn')[idx]?.classList.add('selected');
    document.querySelectorAll('.color-btn').forEach((b, i) => {
      if (i !== idx) b.classList.remove('selected');
    });
  }

  document.getElementById('btn-enter-room').onclick = () => {
    const name = document.getElementById('player-name').value.trim();
    if (!name) { showToast('Enter your name', 'error'); return; }
    if (!selectedColor) { showToast('Choose a color', 'error'); return; }
    socket.emit('join_room', { roomId, playerName: name, color: selectedColor, token: selectedToken });
  };

  showScreen('setup');
}

// === WAITING ROOM ===
function showWaiting(roomId, gs) {
  const url = window.location.origin + `/room/${roomId}`;
  document.getElementById('invite-url').textContent = url;
  document.getElementById('btn-copy-invite').onclick = () => {
    copyToClipboard(url);
    showToast('Invite link copied!', 'success');
  };

  document.getElementById('btn-start-game').onclick = () => {
    socket.emit('start_game', { roomId });
  };

  updateWaitingRoom(gs);
  showScreen('waiting');
}

function updateWaitingRoom(gs) {
  const list = document.getElementById('waiting-players');
  list.innerHTML = '';
  gs.players.forEach((p, i) => {
    const slot = document.createElement('div');
    slot.className = 'player-slot';
    const isHostPlayer = i === 0;
    slot.innerHTML = `
      <div class="player-piece-sm" style="background:${p.color}">${p.name.charAt(0).toUpperCase()}</div>
      <div class="pname">${p.name} ${p.id === myPlayerId ? '(you)' : ''}</div>
      ${isHostPlayer ? '<span class="host-badge">HOST</span>' : ''}
    `;
    list.appendChild(slot);
  });

  // Empty slots
  for (let i = gs.players.length; i < 4; i++) {
    const slot = document.createElement('div');
    slot.className = 'empty-slot';
    slot.textContent = `Waiting for player ${i+1}...`;
    list.appendChild(slot);
  }

  const status = document.getElementById('waiting-status');
  const startBtn = document.getElementById('btn-start-game');
  if (gs.players.length >= 2) {
    status.textContent = `${gs.players.length} players ready. Host can start!`;
    if (isHost) startBtn.style.display = 'block';
  } else {
    status.textContent = `Waiting for more players... (${gs.players.length}/4)`;
    startBtn.style.display = 'none';
  }
}

// === GAME ===
function showGame() {
  showScreen('game');
  renderBoard(gameState.boardSpaces, gameState);
  updateGame(gameState);
  window.onCellClick = handleCellClick;
}

function updateGame(gs) {
  renderBoard(gs.boardSpaces, gs);
  updatePlayersPanel(gs);
  updateActionButtons(gs);
  updateGameLog(gs);
  updateMyProperties(gs);
}

function updatePlayersPanel(gs) {
  const panel = document.getElementById('players-panel');
  panel.innerHTML = '';
  gs.players.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'player-card' + (i === gs.currentPlayerIndex ? ' active-turn' : '') + (p.bankrupt ? ' bankrupt' : '');
    const space = gs.boardSpaces?.[p.position];
    card.innerHTML = `
      <div class="pc-header">
        <div class="turn-indicator ${i === gs.currentPlayerIndex ? '' : 'hidden'}"></div>
        <div class="player-piece-sm" style="background:${p.color}">${p.name.charAt(0).toUpperCase()}</div>
        <div style="display:flex;flex-direction:column;gap:2px;flex:1">
          <div class="pc-name" style="color:${p.color}">${p.name}${p.id === myPlayerId ? ' ★' : ''}</div>
          <div class="pc-pos">${p.inJail ? '🔒 In Jail' : space?.name || ''}</div>
        </div>
        ${p.inJail ? '<span class="pc-jail-badge">JAIL</span>' : ''}
      </div>
      <div class="pc-money">$${p.money.toLocaleString()}</div>
      ${p.bankrupt ? '<div style="font-size:0.7rem;color:#e85c3a">💀 BANKRUPT</div>' : ''}
    `;
    panel.appendChild(card);
  });
}

function updateActionButtons(gs) {
  const isMyTurn = gs.currentPlayerId === myPlayerId;
  const me = gs.players.find(p => p.id === myPlayerId);

  // Hide all first
  ['btn-roll','btn-end-turn','btn-buy','btn-decline','btn-pay-jail','btn-jail-card'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  if (!isMyTurn || !me || me.bankrupt) return;

  if (gs.turnState === 'roll') {
    const rollBtn = document.getElementById('btn-roll');
    rollBtn.classList.remove('hidden');
    rollBtn.onclick = () => socket.emit('roll_dice', { roomId: myRoomId });

    if (me.inJail) {
      if (me.money >= 50) {
        const fineBtn = document.getElementById('btn-pay-jail');
        fineBtn.classList.remove('hidden');
        fineBtn.onclick = () => socket.emit('pay_jail_fine', { roomId: myRoomId });
      }
      if (me.getOutOfJailCards > 0) {
        const cardBtn = document.getElementById('btn-jail-card');
        cardBtn.classList.remove('hidden');
        cardBtn.onclick = () => socket.emit('use_jail_card', { roomId: myRoomId });
      }
    }
  }

  if (gs.turnState === 'action' && gs.pendingAction?.type === 'buy_property') {
    const space = gs.boardSpaces[gs.pendingAction.spaceId];
    document.getElementById('btn-buy').classList.remove('hidden');
    document.getElementById('btn-buy').textContent = `💰 Buy $${space?.price}`;
    document.getElementById('btn-buy').onclick = () => socket.emit('buy_property', { roomId: myRoomId });

    document.getElementById('btn-decline').classList.remove('hidden');
    document.getElementById('btn-decline').onclick = () => socket.emit('decline_buy', { roomId: myRoomId });
  }

  if (gs.turnState === 'end_turn') {
    document.getElementById('btn-end-turn').classList.remove('hidden');
    document.getElementById('btn-end-turn').onclick = () => socket.emit('end_turn', { roomId: myRoomId });
  }
}

function handleGameEvent(data) {
  const popup = document.getElementById('card-popup');
  if (data.cardText) {
    popup.textContent = data.cardText;
    popup.classList.remove('hidden');
    setTimeout(() => popup.classList.add('hidden'), 4000);
  } else {
    popup.classList.add('hidden');
  }
}

function animateDice(diceResult) {
  if (!diceResult) return;
  const d1 = document.getElementById('die1');
  const d2 = document.getElementById('die2');
  const disp = document.getElementById('dice-display');
  disp.classList.remove('hidden');
  d1.classList.add('rolling');
  d2.classList.add('rolling');
  d1.textContent = diceResult.die1;
  d2.textContent = diceResult.die2;
  setTimeout(() => { d1.classList.remove('rolling'); d2.classList.remove('rolling'); }, 600);
}

// Get center coordinates of a board cell relative to board-wrap
function getCellCenter(spaceId) {
  const cell = document.querySelector(`[data-space-id="${spaceId}"]`);
  const board = document.getElementById('board');
  if (!cell || !board) return null;
  const boardRect = board.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  return {
    x: cellRect.left - boardRect.left + cellRect.width / 2,
    y: cellRect.top - boardRect.top + cellRect.height / 2
  };
}

function animatePlayerMovement(playerId, fromPos, toPos, prevState, finalState, onComplete) {
  const TOTAL_SPACES = 40;

  // Build step sequence
  let steps = [fromPos];
  if (toPos >= fromPos) {
    for (let i = fromPos + 1; i <= toPos; i++) steps.push(i % TOTAL_SPACES);
  } else {
    for (let i = fromPos + 1; i < TOTAL_SPACES; i++) steps.push(i);
    for (let i = 0; i <= toPos; i++) steps.push(i);
  }

  if (steps.length <= 1) { setTimeout(onComplete, 200); return; }

  const player = finalState.players.find(p => p.id === playerId);
  if (!player) { onComplete(); return; }

  // Render the board first (without the moving player at final pos)
  const startState = JSON.parse(JSON.stringify(prevState));
  renderBoard(startState.boardSpaces, startState);

  // Create a floating piece overlay
  const boardEl = document.getElementById('board');
  const boardWrap = document.querySelector('.board-wrap');
  if (!boardEl || !boardWrap) { onComplete(); return; }

  const piece = document.createElement('div');
  piece.className = 'player-piece floating-piece';
  piece.style.background = player.color;
  piece.style.borderColor = 'rgba(255,255,255,0.8)';
  piece.textContent = player.name.charAt(0).toUpperCase();
  piece.style.position = 'absolute';
  piece.style.zIndex = '20';
  piece.style.pointerEvents = 'none';
  piece.style.transition = 'left 0.18s cubic-bezier(0.4,0,0.2,1), top 0.18s cubic-bezier(0.4,0,0.2,1)';
  piece.style.width = '18px';
  piece.style.height = '18px';
  piece.style.fontSize = '9px';
  piece.style.fontWeight = '800';
  piece.style.borderWidth = '2px';
  piece.style.borderStyle = 'solid';
  piece.style.boxShadow = '0 2px 8px rgba(0,0,0,0.6)';
  boardWrap.appendChild(piece);

  // Position at start
  const startCenter = getCellCenter(steps[0]);
  if (startCenter) {
    piece.style.left = (startCenter.x - 9) + 'px';
    piece.style.top = (startCenter.y - 9) + 'px';
  }

  let stepIndex = 1;
  const STEP_DELAY = 160;

  function doStep() {
    if (stepIndex >= steps.length) {
      // Final state render, remove overlay piece
      boardWrap.removeChild(piece);
      renderBoard(finalState.boardSpaces, finalState);
      setTimeout(onComplete, 100);
      return;
    }
    const pos = steps[stepIndex];
    const center = getCellCenter(pos);
    if (center) {
      piece.style.left = (center.x - 9) + 'px';
      piece.style.top = (center.y - 9) + 'px';
    }
    stepIndex++;
    setTimeout(doStep, STEP_DELAY);
  }

  // Start after dice animation
  setTimeout(doStep, 700);
}

function updateGameLog(gs) {
  const logDiv = document.getElementById('game-log');
  logDiv.innerHTML = '';
  const entries = gs.log || [];
  [...entries].reverse().forEach((entry, i) => {
    const div = document.createElement('div');
    div.className = 'log-entry' + (i === 0 ? ' new' : '');
    div.textContent = entry.message;
    logDiv.appendChild(div);
  });
}

function updateMyProperties(gs) {
  const div = document.getElementById('my-properties');
  div.innerHTML = '';
  const me = gs.players.find(p => p.id === myPlayerId);
  if (!me) return;

  const myProps = Object.entries(gs.properties || {})
    .filter(([id, prop]) => prop.ownerId === myPlayerId)
    .map(([id, prop]) => ({ spaceId: parseInt(id), prop, space: gs.boardSpaces[id] }));

  if (myProps.length === 0) {
    div.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;padding:0.5rem;">No properties yet</div>';
    return;
  }

  myProps.forEach(({ spaceId, prop, space }) => {
    if (!space) return;
    const item = document.createElement('div');
    item.className = 'prop-item';

    const colorBadge = document.createElement('div');
    colorBadge.className = 'prop-color-badge';
    const colorMap = { brown:'#8B4513',lightblue:'#add8e6',pink:'#ff69b4',orange:'#ffa500',red:'#dc143c',yellow:'#ffd700',green:'#228b22',darkblue:'#00008b' };
    colorBadge.style.background = colorMap[space.color] || '#888';

    const name = document.createElement('div');
    name.className = 'prop-name';
    name.textContent = space.name;

    const status = document.createElement('div');
    if (prop.mortgaged) {
      status.className = 'prop-mortgaged';
      status.textContent = 'MORTGAGED';
    } else if (prop.houses > 0) {
      status.className = 'prop-houses';
      status.textContent = prop.houses === 5 ? '🏨' : '🏠'.repeat(prop.houses);
    }

    item.appendChild(colorBadge);
    item.appendChild(name);
    item.appendChild(status);
    item.addEventListener('click', () => showPropertyModal(spaceId, prop, space, gs));
    div.appendChild(item);
  });
}

function handleCellClick(spaceId, space) {
  if (!gameState) return;
  const prop = gameState.properties[spaceId];
  showPropertyModal(spaceId, prop, space, gameState);
}

function showPropertyModal(spaceId, prop, space, gs) {
  if (!space || (space.type !== 'property' && space.type !== 'railroad' && space.type !== 'utility')) return;

  const colorMap = { brown:'#8B4513',lightblue:'#add8e6',pink:'#ff69b4',orange:'#ffa500',red:'#dc143c',yellow:'#ffd700',green:'#228b22',darkblue:'#00008b' };
  const owner = prop ? gs.players.find(p => p.id === prop.ownerId) : null;
  const isMyProperty = prop && prop.ownerId === myPlayerId;
  const me = gs.players.find(p => p.id === myPlayerId);

  let rentRows = '';
  if (space.rent) {
    const labels = ['Site only', '1 House', '2 Houses', '3 Houses', '4 Houses', 'Hotel'];
    space.rent.forEach((r, i) => {
      rentRows += `<tr><td>${labels[i]}</td><td>$${r}</td></tr>`;
    });
  } else if (space.type === 'railroad') {
    rentRows = space.rent.map((r, i) => `<tr><td>${i+1} Railroad(s)</td><td>$${r}</td></tr>`).join('');
  } else if (space.type === 'utility') {
    rentRows = `<tr><td>1 Utility</td><td>4× dice</td></tr><tr><td>2 Utilities</td><td>10× dice</td></tr>`;
  }

  let actionsHtml = '';
  if (isMyProperty && gs.currentPlayerId === myPlayerId) {
    if (space.type === 'property') {
      const { COLOR_GROUPS } = {};
      actionsHtml += `<button class="btn btn-secondary" onclick="buildHouse(${spaceId})">🏠 Build House ($${space.houseCost})</button>`;
      if (prop.houses > 0) actionsHtml += `<button class="btn btn-secondary" onclick="sellHouse(${spaceId})">🔨 Sell House</button>`;
    }
    if (!prop.mortgaged && prop.houses === 0) actionsHtml += `<button class="btn btn-secondary" onclick="mortgageProp(${spaceId})">📋 Mortgage ($${space.mortgage})</button>`;
    if (prop.mortgaged) actionsHtml += `<button class="btn btn-secondary" onclick="unmortgageProp(${spaceId})">✅ Unmortgage ($${Math.floor(space.mortgage*1.1)})</button>`;
  }

  document.getElementById('modal-body').innerHTML = `
    <div class="modal-prop-header">
      <div class="modal-color-band" style="background:${colorMap[space.color] || '#888'}"></div>
      <div>
        <div class="modal-prop-name">${space.name}</div>
        ${owner ? `<div style="font-size:0.8rem;color:${owner.color}">Owned by ${owner.name}</div>` : '<div style="font-size:0.8rem;color:var(--text-muted)">Unowned</div>'}
        ${prop?.mortgaged ? '<div style="font-size:0.75rem;color:#e85c3a">⚠️ Mortgaged</div>' : ''}
      </div>
    </div>
    <div class="modal-prop-price">Price: <strong>$${space.price || 'N/A'}</strong> | Mortgage: <strong>$${space.mortgage || 'N/A'}</strong></div>
    ${rentRows ? `<table class="rent-table"><tbody>${rentRows}</tbody></table>` : ''}
    ${actionsHtml ? `<div class="modal-actions">${actionsHtml}</div>` : ''}
  `;

  document.getElementById('property-modal').classList.remove('hidden');
}

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('property-modal').classList.add('hidden');
});

document.getElementById('property-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('property-modal')) {
    document.getElementById('property-modal').classList.add('hidden');
  }
});

window.buildHouse = (spaceId) => {
  document.getElementById('property-modal').classList.add('hidden');
  socket.emit('buy_house', { roomId: myRoomId, spaceId });
};
window.sellHouse = (spaceId) => {
  document.getElementById('property-modal').classList.add('hidden');
  socket.emit('sell_house', { roomId: myRoomId, spaceId });
};
window.mortgageProp = (spaceId) => {
  document.getElementById('property-modal').classList.add('hidden');
  socket.emit('mortgage_property', { roomId: myRoomId, spaceId });
};
window.unmortgageProp = (spaceId) => {
  document.getElementById('property-modal').classList.add('hidden');
  socket.emit('unmortgage_property', { roomId: myRoomId, spaceId });
};

// === WINNER ===
function showWinner(winner) {
  if (!winner) return;
  document.getElementById('winner-name').textContent = winner.name;
  document.getElementById('winner-overlay').classList.remove('hidden');
}
document.getElementById('btn-play-again').addEventListener('click', () => {
  window.location.href = '/';
});

// === TABS ===
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
    });
  });
}

// === HELPERS ===
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}
