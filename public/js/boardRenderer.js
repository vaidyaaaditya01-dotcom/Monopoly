// Board Renderer - builds the 11x11 monopoly board grid
const BOARD_LAYOUT = [
  // Each entry: [gridRow, gridCol, orientation, spaceId]
  // Bottom row (spaces 0-10), left to right
  [11,11,'corner',0],  // GO - bottom right corner
  [11,10,'bottom',1],
  [11,9,'bottom',2],
  [11,8,'bottom',3],
  [11,7,'bottom',4],
  [11,6,'bottom',5],
  [11,5,'bottom',6],
  [11,4,'bottom',7],
  [11,3,'bottom',8],
  [11,2,'bottom',9],
  [11,1,'corner',10], // Jail - bottom left

  // Left column (spaces 11-19), bottom to top
  [10,1,'left',11],
  [9,1,'left',12],
  [8,1,'left',13],
  [7,1,'left',14],
  [6,1,'left',15],
  [5,1,'left',16],
  [4,1,'left',17],
  [3,1,'left',18],
  [2,1,'left',19],

  // Top left corner (space 20)
  [1,1,'corner',20], // Free Parking

  // Top row (spaces 21-29), left to right
  [1,2,'top',21],
  [1,3,'top',22],
  [1,4,'top',23],
  [1,5,'top',24],
  [1,6,'top',25],
  [1,7,'top',26],
  [1,8,'top',27],
  [1,9,'top',28],
  [1,10,'top',29],

  // Top right corner (space 30)
  [1,11,'corner',30], // Go to Jail

  // Right column (spaces 31-39), top to bottom
  [2,11,'right',31],
  [3,11,'right',32],
  [4,11,'right',33],
  [5,11,'right',34],
  [6,11,'right',35],
  [7,11,'right',36],
  [8,11,'right',37],
  [9,11,'right',38],
  [10,11,'right',39],
];

const COLOR_MAP = {
  brown: '#8B4513', lightblue: '#add8e6', pink: '#ff69b4',
  orange: '#ffa500', red: '#dc143c', yellow: '#ffd700',
  green: '#228b22', darkblue: '#00008b'
};

const SPACE_ICONS = {
  go: '➡️', jail: '🏛️', go_to_jail: '👮', free_parking: '🅿️',
  tax: '💸', chance: '?', community_chest: 'CC', railroad: '🚂', utility: '⚡'
};

function renderBoard(boardSpaces, gameState) {
  const board = document.getElementById('board');
  board.innerHTML = '';

  const cellMap = {};
  BOARD_LAYOUT.forEach(([row, col, orient, spaceId]) => {
    cellMap[spaceId] = { row, col, orient };
  });

  BOARD_LAYOUT.forEach(([row, col, orient, spaceId]) => {
    const space = boardSpaces[spaceId];
    const cell = document.createElement('div');
    cell.className = `cell cell-${orient} cell-${space.type}`;
    if (orient === 'corner') cell.classList.add('cell-corner');
    cell.style.gridRow = row;
    cell.style.gridColumn = col;
    cell.dataset.spaceId = spaceId;

    // Color band for properties
    if (space.type === 'property' && space.color) {
      const band = document.createElement('div');
      band.className = `color-band color-${space.color}`;
      cell.appendChild(band);
    }

    // Cell content
    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.alignItems = 'center';
    content.style.justifyContent = 'center';
    content.style.flex = '1';
    content.style.padding = '1px';

    const icon = document.createElement('div');
    icon.style.fontSize = '0.5rem';
    if (SPACE_ICONS[space.type]) {
      icon.textContent = SPACE_ICONS[space.type];
    }

    const name = document.createElement('div');
    name.className = 'cell-name';
    name.textContent = getShortName(space.name, orient);

    content.appendChild(icon);
    content.appendChild(name);

    if (space.price) {
      const price = document.createElement('div');
      price.className = 'cell-price';
      price.textContent = `$${space.price}`;
      content.appendChild(price);
    }

    cell.appendChild(content);

    // Ownership dot
    if (gameState && gameState.properties[spaceId]) {
      const prop = gameState.properties[spaceId];
      const owner = gameState.players.find(p => p.id === prop.ownerId);
      if (owner) {
        const dot = document.createElement('div');
        dot.className = 'cell-owner-dot';
        dot.style.background = owner.color;
        cell.appendChild(dot);
        cell.style.boxShadow = `inset 0 0 0 2px ${owner.color}44`;
      }
      // Houses/Hotel
      if (prop.houses > 0) {
        const hd = document.createElement('div');
        hd.className = 'houses-display';
        if (prop.houses === 5) {
          const h = document.createElement('div');
          h.className = 'hotel-dot';
          hd.appendChild(h);
        } else {
          for (let i = 0; i < prop.houses; i++) {
            const h = document.createElement('div');
            h.className = 'house-dot';
            hd.appendChild(h);
          }
        }
        cell.appendChild(hd);
      }
    }

    // Player tokens
    if (gameState) {
      const playersHere = gameState.players.filter(p => p.position === spaceId && !p.bankrupt);
      if (playersHere.length > 0) {
        const tokensDiv = document.createElement('div');
        tokensDiv.className = 'board-tokens';
        playersHere.forEach(p => {
          const t = document.createElement('div');
          t.className = 'board-token';
          t.textContent = p.token;
          t.title = p.name;
          tokensDiv.appendChild(t);
        });
        cell.appendChild(tokensDiv);
      }
    }

    // Click handler
    cell.addEventListener('click', () => {
      if (window.onCellClick) window.onCellClick(spaceId, space);
    });

    board.appendChild(cell);
  });
}

function getShortName(name, orient) {
  const maxLen = orient === 'left' || orient === 'right' ? 14 : 12;
  if (name.length <= maxLen) return name;
  // Try to abbreviate
  const subs = { 'Avenue': 'Ave', 'Railroad': 'RR', 'Community Chest': 'Comm. Chest', 'Place': 'Pl' };
  let n = name;
  Object.entries(subs).forEach(([k, v]) => { n = n.replace(k, v); });
  return n;
}

window.renderBoard = renderBoard;
