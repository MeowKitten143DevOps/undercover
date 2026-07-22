const rooms = require('./rooms');
const wordsData = require('./words.json');

class Game {
  constructor() {
    this.words = wordsData;
  }

  startGame(roomId) {
    const room = rooms.getRoom(roomId);
    if (!room) return null;
    
    // Check minimum players
    if (room.players.length < 3) {
      return { error: 'Minimum 3 joueurs requis' };
    }
    
    // Check config matches players
    const total = room.config.undercover + room.config.civilians;
    if (total !== room.players.length) {
      return { error: 'Le nombre de rôles ne correspond pas au nombre de joueurs' };
    }
    
    // Select word pair
    const pair = this.selectWordPair();
    room.wordPair = pair;
    
    // Distribute roles
    const roles = this.distributeRoles(room);
    
    // Assign roles to players
    const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);
    
    let undercoverCount = room.config.undercover;
    let civilianCount = room.config.civilians;
    
    shuffledPlayers.forEach((player, index) => {
      let role, word;
      
      if (undercoverCount > 0) {
        role = 'undercover';
        word = pair.undercover;
        undercoverCount--;
      } else {
        role = 'civil';
        word = pair.civil;
        civilianCount--;
      }
      
      rooms.assignRole(roomId, player.id, role, word);
    });
    
    // Set game state
    rooms.setGameState(roomId, 'playing');
    
    // Generate turn order
    const turnOrder = room.players.map(p => p.id).sort(() => Math.random() - 0.5);
    room.turnOrder = turnOrder;
    room.currentTurn = 0;
    
    return {
      success: true,
      players: room.players.map(p => ({
        id: p.id,
        username: p.username,
        role: p.role
      }))
    };
  }

  selectWordPair() {
    const index = Math.floor(Math.random() * this.words.length);
    return this.words[index];
  }

  distributeRoles(room) {
    const roles = [];
    const config = room.config;
    
    for (let i = 0; i < config.undercover; i++) {
      roles.push('undercover');
    }
    for (let i = 0; i < config.civilians; i++) {
      roles.push('civil');
    }
    
    return roles.sort(() => Math.random() - 0.5);
  }

  processVote(roomId) {
    const room = rooms.getRoom(roomId);
    if (!room) return null;
    
    const results = rooms.getVoteResults(roomId);
    if (!results) return null;
    
    // Find player with most votes
    let maxVotes = 0;
    let eliminatedId = null;
    
    for (const [playerId, votes] of Object.entries(results)) {
      if (votes > maxVotes) {
        maxVotes = votes;
        eliminatedId = playerId;
      }
    }
    
    if (eliminatedId) {
      const eliminatedPlayer = rooms.getPlayer(roomId, eliminatedId);
      rooms.eliminatePlayer(roomId, eliminatedId);
      
      return {
        eliminated: eliminatedId,
        eliminatedRole: eliminatedPlayer ? eliminatedPlayer.role : null
      };
    }
    
    return { eliminated: null };
  }

  checkGameOver(roomId) {
    const room = rooms.getRoom(roomId);
    if (!room) return null;
    
    const result = rooms.checkVictory(roomId);
    if (result && result.winner) {
      rooms.setGameState(roomId, 'results');
      return result;
    }
    
    return null;
  }
}

module.exports = new Game();