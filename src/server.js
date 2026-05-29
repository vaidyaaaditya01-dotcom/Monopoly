const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const GameEngine = require('./gameEngine');

const app = express();
const server = http.createServer(app);

// Render.com requires transports to include polling for WebSocket upgrades
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

const rooms = {};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/room/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.post('/api/create-room', (req, res) => {
  const roomId = uuidv4().substring(0, 8).toUpperCase();
  rooms[roomId] = {
    game: new GameEngine(roomId),
    host: null,
    createdAt: Date.now()
  };
  res.json({ roomId });
});

app.get('/api/room/:roomId', (req, res) => {
  const room = rooms[req.params.roomId];
  if (!room) return res.json({ exists: false });
  res.json({
    exists: true,
    playerCount: room.game.players.length,
    phase: room.game.phase,
    players: room.game.players.map(p => ({ name: p.name, color: p.color, token: p.token }))
  });
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join_room', ({ roomId, playerName, color, token }) => {
    const room = rooms[roomId];
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    if (room.game.phase !== 'waiting') { socket.emit('error', { message: 'Game already in progress' }); return; }

    const takenColors = room.game.players.map(p => p.color);
    const takenNames  = room.game.players.map(p => p.name.toLowerCase());
    if (takenColors.includes(color))                        { socket.emit('error', { message: 'Color already taken' }); return; }
    if (takenNames.includes(playerName.toLowerCase()))      { socket.emit('error', { message: 'Name already taken' }); return; }

    const result = room.game.addPlayer(socket.id, playerName, color, token);
    if (result.error) { socket.emit('error', { message: result.error }); return; }

    if (!room.host) room.host = socket.id;
    socket.join(roomId);
    socket.data.roomId  = roomId;
    socket.data.playerId = socket.id;

    socket.emit('joined_room', {
      roomId,
      playerId: socket.id,
      isHost: room.host === socket.id,
      gameState: room.game.getState('joined').gameState
    });

    io.to(roomId).emit('player_joined', {
      player: result.player,
      gameState: room.game.getState('player_joined').gameState
    });
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.host !== socket.id) { socket.emit('error', { message: 'Only the host can start the game' }); return; }
    const result = room.game.startGame();
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    io.to(roomId).emit('game_started', room.game.getState('game_started'));
  });

  socket.on('roll_dice', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const result = room.game.rollDice(socket.id);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    io.to(roomId).emit('dice_rolled', result);
  });

  socket.on('buy_property', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const result = room.game.buyProperty(socket.id);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    io.to(roomId).emit('property_bought', result);
  });

  socket.on('decline_buy', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const result = room.game.declineBuy(socket.id);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    io.to(roomId).emit('buy_declined', result);
  });

  socket.on('buy_house', ({ roomId, spaceId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const result = room.game.buyHouse(socket.id, spaceId);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    io.to(roomId).emit('house_built', result);
  });

  socket.on('sell_house', ({ roomId, spaceId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const result = room.game.sellHouse(socket.id, spaceId);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    io.to(roomId).emit('house_sold', result);
  });

  socket.on('mortgage_property', ({ roomId, spaceId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const result = room.game.mortgageProperty(socket.id, spaceId);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    io.to(roomId).emit('property_mortgaged', result);
  });

  socket.on('unmortgage_property', ({ roomId, spaceId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const result = room.game.unmortgageProperty(socket.id, spaceId);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    io.to(roomId).emit('property_unmortgaged', result);
  });

  socket.on('pay_jail_fine', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const result = room.game.payJailFine(socket.id);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    io.to(roomId).emit('jail_fine_paid', result);
  });

  socket.on('use_jail_card', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const result = room.game.useGetOutOfJailCard(socket.id);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    io.to(roomId).emit('jail_card_used', result);
  });

  socket.on('end_turn', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const result = room.game.endTurn(socket.id);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    io.to(roomId).emit('turn_ended', result);
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    const room = rooms[roomId];
    room.game.removePlayer(socket.id);
    if (room.host === socket.id && room.game.players.length > 0) {
      room.host = room.game.players[0].id;
    }
    io.to(roomId).emit('player_left', {
      playerId: socket.id,
      gameState: room.game.getState('player_left').gameState
    });
    if (room.game.players.length === 0) delete rooms[roomId];
  });
});

// Clean up old empty rooms every hour
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach(id => {
    if (rooms[id].game.players.length === 0 && now - rooms[id].createdAt > 3_600_000) {
      delete rooms[id];
    }
  });
}, 3_600_000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎲 Monopoly server running on port ${PORT}`);
});

