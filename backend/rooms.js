class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomId, hostId) {
    if (this.rooms.has(roomId)) {
      return null;
    }
    const room = {
      id: roomId,
      host: hostId,
      players: [],
      gameState: 'lobby', // lobby, setup, playing, voting, results
      config: {
        undercover: 1,
        civilians: 3
      },
      wordPair: null,
      roles: new Map(), // playerId -> role
      votes: new Map(), // voterId -> targetId
      eliminated: new Set(),
      gamePhase: 'lobby',
      turnOrder: [],
      currentTurn: 0
    };
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId) {
    this.rooms.delete(roomId);
  }

  addPlayer(roomId, playerId, username) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    const player = {
      id: playerId,
      username: username,
      role: null,
      word: null,
      isReady: false,
      hasSeenWord: false,
      isHost: room.players.length === 0
    };
    
    room.players.push(player);
    return player;
  }

  removePlayer(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    room.players = room.players.filter(p => p.id !== playerId);
    room.roles.delete(playerId);
    
    if (room.players.length === 0) {
      this.deleteRoom(roomId);
    }
    return room;
  }

  getPlayer(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return room.players.find(p => p.id === playerId);
  }

  setPlayerReady(roomId, playerId) {
    const player = this.getPlayer(roomId, playerId);
    if (player) {
      player.isReady = !player.isReady;
    }
    return player;
  }

  setPlayerSeenWord(roomId, playerId) {
    const player = this.getPlayer(roomId, playerId);
    if (player) {
      player.hasSeenWord = true;
    }
    return player;
  }

  allPlayersSeenWord(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    return room.players.every(p => p.hasSeenWord);
  }

  updateConfig(roomId, config) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.config = { ...room.config, ...config };
    return room.config;
  }

  setGameState(roomId, state) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.gameState = state;
    return room;
  }

  setWordPair(roomId, pair) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.wordPair = pair;
    return room;
  }

  assignRole(roomId, playerId, role, word) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = this.getPlayer(roomId, playerId);
    if (player) {
      player.role = role;
      player.word = word;
      room.roles.set(playerId, { role, word });
    }
    return player;
  }

  getPlayerInfo(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = this.getPlayer(roomId, playerId);
    if (!player) return null;
    
    return {
      role: player.role,
      word: player.word,
      username: player.username
    };
  }

  setVote(roomId, voterId, targetId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (voterId === targetId) return null;
    room.votes.set(voterId, targetId);
    return room.votes;
  }

  getVoteResults(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    const results = {};
    for (const [voter, target] of room.votes) {
      results[target] = (results[target] || 0) + 1;
    }
    return results;
  }

  getAlivePlayers(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return room.players.filter(p => !room.eliminated.has(p.id));
  }

  eliminatePlayer(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.eliminated.add(playerId);
    return room;
  }

  resetVotes(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.votes.clear();
    return room;
  }

  resetGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    room.gameState = 'lobby';
    room.players.forEach(p => {
      p.role = null;
      p.word = null;
      p.isReady = false;
      p.hasSeenWord = false;
    });
    room.roles.clear();
    room.votes.clear();
    room.eliminated.clear();
    room.turnOrder = [];
    room.currentTurn = 0;
    return room;
  }

  getGameSummary(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    const alive = this.getAlivePlayers(roomId);
    const roles = alive.map(p => ({
      id: p.id,
      username: p.username,
      role: p.role
    }));
    
    return {
      alive: alive.length,
      roles: roles,
      eliminated: Array.from(room.eliminated)
    };
  }

  checkVictory(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    const alive = this.getAlivePlayers(roomId);
    const undercover = alive.filter(p => p.role === 'undercover');
    const civilians = alive.filter(p => p.role === 'civil');
    
    // Civils win if all undercover eliminated
    if (undercover.length === 0) {
      return { winner: 'civils' };
    }
    
    // Undercover win if they become majority or equal
    if (undercover.length >= civilians.length) {
      return { winner: 'undercover' };
    }
    
    return { winner: null };
  }
}

module.exports = new RoomManager();