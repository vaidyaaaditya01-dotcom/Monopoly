const { BOARD_SPACES, CHANCE_CARDS, COMMUNITY_CHEST_CARDS, COLOR_GROUPS } = require('./gameData');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class GameEngine {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];
    this.properties = {}; // spaceId -> { ownerId, houses, mortgaged }
    this.currentPlayerIndex = 0;
    this.phase = 'waiting'; // waiting, playing, ended
    this.diceResult = null;
    this.doublesCount = 0;
    this.freeParkingPot = 0;
    this.chanceCards = shuffle(CHANCE_CARDS);
    this.communityChestCards = shuffle(COMMUNITY_CHEST_CARDS);
    this.chanceIndex = 0;
    this.communityChestIndex = 0;
    this.log = [];
    this.pendingAction = null; // { type, data } - waiting for player decision
    this.turnState = 'roll'; // roll, action, end_turn
  }

  addPlayer(socketId, name, color, token) {
    if (this.players.length >= 4) return { error: 'Room is full' };
    if (this.phase !== 'waiting') return { error: 'Game already started' };
    const player = {
      id: socketId,
      name,
      color,
      token,
      money: 1500,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      bankrupt: false,
      doubleCount: 0
    };
    this.players.push(player);
    return { player };
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex(p => p.id === socketId);
    if (idx !== -1) {
      this.players.splice(idx, 1);
      if (this.currentPlayerIndex >= this.players.length) {
        this.currentPlayerIndex = 0;
      }
    }
  }

  startGame() {
    if (this.players.length < 2) return { error: 'Need at least 2 players' };
    this.phase = 'playing';
    this.currentPlayerIndex = 0;
    this.turnState = 'roll';
    this.addLog(`Game started! ${this.players[0].name}'s turn.`);
    return { success: true };
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  rollDice(socketId) {
    const player = this.getCurrentPlayer();
    if (!player || player.id !== socketId) return { error: 'Not your turn' };
    if (this.turnState !== 'roll') return { error: 'Cannot roll now' };

    const die1 = Math.ceil(Math.random() * 6);
    const die2 = Math.ceil(Math.random() * 6);
    const isDoubles = die1 === die2;
    const total = die1 + die2;
    this.diceResult = { die1, die2, total, isDoubles };

    this.addLog(`${player.name} rolled ${die1} + ${die2} = ${total}${isDoubles ? ' (DOUBLES!)' : ''}`);

    if (player.inJail) {
      return this.handleJailRoll(player, die1, die2, isDoubles, total);
    }

    if (isDoubles) {
      this.doublesCount++;
      if (this.doublesCount >= 3) {
        this.addLog(`${player.name} rolled doubles 3 times! Go to Jail!`);
        this.goToJail(player);
        this.doublesCount = 0;
        this.turnState = 'end_turn';
        return this.getState('jail');
      }
    } else {
      this.doublesCount = 0;
    }

    this.movePlayer(player, total);
    const result = this.landOnSpace(player);
    
    if (!this.pendingAction) {
      this.turnState = isDoubles ? 'roll' : 'end_turn';
      if (isDoubles) {
        result.message = (result.message || '') + ' Roll again (doubles)!';
      }
    } else {
      this.turnState = 'action';
    }

    return result;
  }

  handleJailRoll(player, die1, die2, isDoubles, total) {
    player.jailTurns++;
    if (isDoubles) {
      player.inJail = false;
      player.jailTurns = 0;
      this.addLog(`${player.name} rolled doubles and is out of jail!`);
      this.movePlayer(player, total);
      const result = this.landOnSpace(player);
      this.turnState = 'end_turn';
      return result;
    }
    if (player.jailTurns >= 3) {
      player.money -= 50;
      player.inJail = false;
      player.jailTurns = 0;
      this.addLog(`${player.name} paid $50 to leave jail.`);
      this.movePlayer(player, total);
      const result = this.landOnSpace(player);
      this.turnState = 'end_turn';
      return result;
    }
    this.addLog(`${player.name} stays in jail (turn ${player.jailTurns}/3).`);
    this.turnState = 'end_turn';
    return this.getState('stayed_in_jail');
  }

  movePlayer(player, steps) {
    const oldPos = player.position;
    player.position = (player.position + steps) % 40;
    if (player.position < oldPos || (oldPos + steps >= 40)) {
      if (player.position !== 0) {
        player.money += 200;
        this.addLog(`${player.name} passed GO! Collected $200.`);
      }
    }
  }

  landOnSpace(player) {
    const space = BOARD_SPACES[player.position];
    this.addLog(`${player.name} landed on ${space.name}`);

    switch (space.type) {
      case 'go':
        player.money += 200;
        this.addLog(`${player.name} landed on GO! Collected $200.`);
        return this.getState('landed_go');

      case 'property':
      case 'railroad':
      case 'utility':
        return this.handlePropertyLanding(player, space);

      case 'tax':
        player.money -= space.amount;
        this.addLog(`${player.name} paid $${space.amount} in taxes.`);
        this.checkBankruptcy(player);
        return this.getState('tax_paid', { amount: space.amount });

      case 'go_to_jail':
        this.goToJail(player);
        return this.getState('go_to_jail');

      case 'chance':
        return this.drawCard('chance', player);

      case 'community_chest':
        return this.drawCard('community_chest', player);

      case 'free_parking':
        if (this.freeParkingPot > 0) {
          player.money += this.freeParkingPot;
          this.addLog(`${player.name} collected $${this.freeParkingPot} from Free Parking!`);
          this.freeParkingPot = 0;
        }
        return this.getState('free_parking');

      case 'jail':
        return this.getState('just_visiting');

      default:
        return this.getState('normal');
    }
  }

  handlePropertyLanding(player, space) {
    const prop = this.properties[space.id];
    
    if (!prop) {
      // Unowned - offer to buy
      this.pendingAction = { type: 'buy_property', spaceId: space.id, price: space.price };
      this.turnState = 'action';
      return this.getState('can_buy', { space, price: space.price });
    }

    if (prop.ownerId === player.id) {
      this.addLog(`${player.name} owns ${space.name}.`);
      return this.getState('own_property');
    }

    if (prop.mortgaged) {
      this.addLog(`${space.name} is mortgaged. No rent due.`);
      return this.getState('mortgaged');
    }

    // Pay rent
    const owner = this.players.find(p => p.id === prop.ownerId);
    if (!owner || owner.bankrupt) return this.getState('normal');

    const rent = this.calculateRent(space, prop, player);
    player.money -= rent;
    owner.money += rent;
    this.addLog(`${player.name} paid $${rent} rent to ${owner.name} for ${space.name}.`);
    this.checkBankruptcy(player);
    return this.getState('rent_paid', { rent, ownerName: owner.name });
  }

  calculateRent(space, prop, player) {
    if (space.type === 'railroad') {
      const ownedRailroads = Object.values(this.properties)
        .filter(p => p.ownerId === prop.ownerId)
        .map(p => BOARD_SPACES[p.spaceId])
        .filter(s => s && s.type === 'railroad').length;
      return space.rent[ownedRailroads - 1] || 25;
    }

    if (space.type === 'utility') {
      const ownedUtils = Object.values(this.properties)
        .filter(p => p.ownerId === prop.ownerId)
        .map(p => BOARD_SPACES[p.spaceId])
        .filter(s => s && s.type === 'utility').length;
      const multiplier = ownedUtils === 2 ? 10 : 4;
      return (this.diceResult.total) * multiplier;
    }

    // Regular property
    if (prop.houses === 0) {
      // Check monopoly
      const group = COLOR_GROUPS[space.color] || [];
      const allOwned = group.every(id => this.properties[id]?.ownerId === prop.ownerId);
      return allOwned ? space.rent[0] * 2 : space.rent[0];
    }
    const rentIdx = Math.min(prop.houses, 5); // 5 = hotel
    return space.rent[rentIdx];
  }

  drawCard(type, player) {
    let card;
    if (type === 'chance') {
      card = this.chanceCards[this.chanceIndex % this.chanceCards.length];
      this.chanceIndex++;
    } else {
      card = this.communityChestCards[this.communityChestIndex % this.communityChestCards.length];
      this.communityChestIndex++;
    }
    this.addLog(`${player.name} drew: "${card.text}"`);
    return this.applyCardAction(player, card);
  }

  applyCardAction(player, card) {
    const action = card.action;
    switch (action.type) {
      case 'move_to': {
        const oldPos = player.position;
        if (action.collect_go && action.position < oldPos && action.position !== oldPos) {
          player.money += 200;
          this.addLog(`${player.name} passed GO! Collected $200.`);
        }
        player.position = action.position;
        const result = this.landOnSpace(player);
        return { ...result, cardText: card.text };
      }
      case 'move_relative': {
        player.position = ((player.position + action.amount) + 40) % 40;
        const result = this.landOnSpace(player);
        return { ...result, cardText: card.text };
      }
      case 'nearest_railroad': {
        const railroads = [5, 15, 25, 35];
        const nearest = railroads.reduce((best, rr) => {
          const dist = (rr - player.position + 40) % 40;
          return dist < ((best - player.position + 40) % 40) ? rr : best;
        });
        player.position = nearest;
        const result = this.landOnSpace(player);
        return { ...result, cardText: card.text };
      }
      case 'nearest_utility': {
        const utils = [12, 28];
        const nearest = utils.reduce((best, u) => {
          const dist = (u - player.position + 40) % 40;
          return dist < ((best - player.position + 40) % 40) ? u : best;
        });
        player.position = nearest;
        const result = this.landOnSpace(player);
        return { ...result, cardText: card.text };
      }
      case 'gain':
        player.money += action.amount;
        return { ...this.getState('card_gain'), cardText: card.text, amount: action.amount };
      case 'lose':
        player.money -= action.amount;
        this.addLog(`${player.name} paid $${action.amount}.`);
        this.checkBankruptcy(player);
        return { ...this.getState('card_lose'), cardText: card.text, amount: action.amount };
      case 'get_out_of_jail':
        player.getOutOfJailCards++;
        return { ...this.getState('get_out_of_jail_card'), cardText: card.text };
      case 'go_to_jail':
        this.goToJail(player);
        return { ...this.getState('go_to_jail'), cardText: card.text };
      case 'repairs': {
        let total = 0;
        Object.values(this.properties).forEach(p => {
          if (p.ownerId === player.id) {
            if (p.houses < 5) total += p.houses * action.house;
            else total += action.hotel;
          }
        });
        player.money -= total;
        this.addLog(`${player.name} paid $${total} for repairs.`);
        this.checkBankruptcy(player);
        return { ...this.getState('repairs'), cardText: card.text, amount: total };
      }
      case 'pay_each_player': {
        const activePlayers = this.players.filter(p => !p.bankrupt && p.id !== player.id);
        const total = activePlayers.length * action.amount;
        player.money -= total;
        activePlayers.forEach(p => p.money += action.amount);
        this.addLog(`${player.name} paid $${action.amount} to each player.`);
        this.checkBankruptcy(player);
        return { ...this.getState('pay_each'), cardText: card.text };
      }
      case 'collect_from_each': {
        const activePlayers = this.players.filter(p => !p.bankrupt && p.id !== player.id);
        activePlayers.forEach(p => {
          p.money -= action.amount;
          player.money += action.amount;
        });
        this.addLog(`${player.name} collected $${action.amount} from each player.`);
        return { ...this.getState('collect_each'), cardText: card.text };
      }
      default:
        return this.getState('card');
    }
  }

  buyProperty(socketId) {
    const player = this.getCurrentPlayer();
    if (!player || player.id !== socketId) return { error: 'Not your turn' };
    if (!this.pendingAction || this.pendingAction.type !== 'buy_property') return { error: 'No property to buy' };

    const { spaceId, price } = this.pendingAction;
    const space = BOARD_SPACES[spaceId];

    if (player.money < price) return { error: 'Not enough money' };

    player.money -= price;
    this.properties[spaceId] = { ownerId: player.id, spaceId, houses: 0, mortgaged: false };
    this.addLog(`${player.name} bought ${space.name} for $${price}!`);

    this.pendingAction = null;
    this.turnState = this.diceResult?.isDoubles ? 'roll' : 'end_turn';
    return this.getState('bought_property', { spaceName: space.name, price });
  }

  declineBuy(socketId) {
    const player = this.getCurrentPlayer();
    if (!player || player.id !== socketId) return { error: 'Not your turn' };
    
    this.pendingAction = null;
    this.turnState = this.diceResult?.isDoubles ? 'roll' : 'end_turn';
    this.addLog(`${player.name} declined to buy.`);
    return this.getState('declined_buy');
  }

  buyHouse(socketId, spaceId) {
    const player = this.players.find(p => p.id === socketId);
    if (!player) return { error: 'Player not found' };

    const prop = this.properties[spaceId];
    if (!prop || prop.ownerId !== socketId) return { error: 'You do not own this property' };
    if (prop.mortgaged) return { error: 'Property is mortgaged' };
    if (prop.houses >= 5) return { error: 'Already has a hotel' };

    const space = BOARD_SPACES[spaceId];
    if (!space || space.type !== 'property') return { error: 'Cannot build here' };

    // Check monopoly
    const group = COLOR_GROUPS[space.color] || [];
    const hasMonopoly = group.every(id => this.properties[id]?.ownerId === socketId);
    if (!hasMonopoly) return { error: 'Need to own all properties in this color group' };

    const cost = space.houseCost;
    if (player.money < cost) return { error: 'Not enough money' };

    player.money -= cost;
    prop.houses++;
    const buildType = prop.houses === 5 ? 'hotel' : `${prop.houses} house(s)`;
    this.addLog(`${player.name} built a ${buildType} on ${space.name} for $${cost}.`);
    return this.getState('house_built', { spaceName: space.name });
  }

  sellHouse(socketId, spaceId) {
    const player = this.players.find(p => p.id === socketId);
    if (!player) return { error: 'Player not found' };

    const prop = this.properties[spaceId];
    if (!prop || prop.ownerId !== socketId) return { error: 'You do not own this property' };
    if (prop.houses === 0) return { error: 'No houses to sell' };

    const space = BOARD_SPACES[spaceId];
    const refund = Math.floor(space.houseCost / 2);
    player.money += refund;
    prop.houses--;
    this.addLog(`${player.name} sold a house on ${space.name} for $${refund}.`);
    return this.getState('house_sold');
  }

  mortgageProperty(socketId, spaceId) {
    const player = this.players.find(p => p.id === socketId);
    if (!player) return { error: 'Player not found' };

    const prop = this.properties[spaceId];
    if (!prop || prop.ownerId !== socketId) return { error: 'Not your property' };
    if (prop.mortgaged) return { error: 'Already mortgaged' };
    if (prop.houses > 0) return { error: 'Sell houses first' };

    const space = BOARD_SPACES[spaceId];
    player.money += space.mortgage;
    prop.mortgaged = true;
    this.addLog(`${player.name} mortgaged ${space.name} for $${space.mortgage}.`);
    return this.getState('mortgaged_property');
  }

  unmortgageProperty(socketId, spaceId) {
    const player = this.players.find(p => p.id === socketId);
    if (!player) return { error: 'Player not found' };

    const prop = this.properties[spaceId];
    if (!prop || prop.ownerId !== socketId) return { error: 'Not your property' };
    if (!prop.mortgaged) return { error: 'Not mortgaged' };

    const space = BOARD_SPACES[spaceId];
    const cost = Math.floor(space.mortgage * 1.1);
    if (player.money < cost) return { error: 'Not enough money' };

    player.money -= cost;
    prop.mortgaged = false;
    this.addLog(`${player.name} unmortgaged ${space.name} for $${cost}.`);
    return this.getState('unmortgaged_property');
  }

  payJailFine(socketId) {
    const player = this.players.find(p => p.id === socketId);
    if (!player || !player.inJail) return { error: 'Not in jail' };
    if (player.id !== this.getCurrentPlayer().id) return { error: 'Not your turn' };
    if (this.turnState !== 'roll') return { error: 'Already rolled' };

    if (player.money < 50) return { error: 'Not enough money' };
    player.money -= 50;
    player.inJail = false;
    player.jailTurns = 0;
    this.addLog(`${player.name} paid $50 to leave jail.`);
    return this.getState('paid_jail_fine');
  }

  useGetOutOfJailCard(socketId) {
    const player = this.players.find(p => p.id === socketId);
    if (!player || !player.inJail) return { error: 'Not in jail' };
    if (player.id !== this.getCurrentPlayer().id) return { error: 'Not your turn' };
    if (player.getOutOfJailCards <= 0) return { error: 'No get out of jail cards' };

    player.getOutOfJailCards--;
    player.inJail = false;
    player.jailTurns = 0;
    this.addLog(`${player.name} used a Get Out of Jail Free card!`);
    return this.getState('used_jail_card');
  }

  endTurn(socketId) {
    const player = this.getCurrentPlayer();
    if (!player || player.id !== socketId) return { error: 'Not your turn' };
    if (this.turnState !== 'end_turn') return { error: 'Cannot end turn now' };

    this.doublesCount = 0;
    this.diceResult = null;
    this.pendingAction = null;

    // Move to next non-bankrupt player
    let nextIdx = (this.currentPlayerIndex + 1) % this.players.length;
    let attempts = 0;
    while (this.players[nextIdx].bankrupt && attempts < this.players.length) {
      nextIdx = (nextIdx + 1) % this.players.length;
      attempts++;
    }

    const activePlayers = this.players.filter(p => !p.bankrupt);
    if (activePlayers.length <= 1) {
      this.phase = 'ended';
      this.addLog(`🏆 ${activePlayers[0]?.name || 'Nobody'} wins the game!`);
      return { ...this.getState('game_over'), winner: activePlayers[0] };
    }

    this.currentPlayerIndex = nextIdx;
    this.turnState = 'roll';
    const nextPlayer = this.players[nextIdx];
    this.addLog(`${nextPlayer.name}'s turn.`);
    return this.getState('turn_ended');
  }

  goToJail(player) {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    this.addLog(`${player.name} went to jail!`);
  }

  checkBankruptcy(player) {
    if (player.money < 0) {
      player.bankrupt = true;
      // Return all properties to bank
      Object.keys(this.properties).forEach(id => {
        if (this.properties[id].ownerId === player.id) {
          delete this.properties[id];
        }
      });
      this.addLog(`💀 ${player.name} is bankrupt!`);
    }
  }

  addLog(message) {
    this.log.push({ message, time: Date.now() });
    if (this.log.length > 100) this.log.shift();
  }

  getState(event = 'update', extra = {}) {
    return {
      event,
      gameState: {
        phase: this.phase,
        players: this.players,
        properties: this.properties,
        currentPlayerIndex: this.currentPlayerIndex,
        currentPlayerId: this.getCurrentPlayer()?.id,
        turnState: this.turnState,
        diceResult: this.diceResult,
        doublesCount: this.doublesCount,
        freeParkingPot: this.freeParkingPot,
        pendingAction: this.pendingAction,
        log: this.log.slice(-20),
        boardSpaces: BOARD_SPACES
      },
      ...extra
    };
  }
}

module.exports = GameEngine;
