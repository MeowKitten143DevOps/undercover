const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const rooms = require('./rooms');
const game = require('./game');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

function generateRoomId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

io.on('connection', (socket) => {
  console.log('Nouveau client connecté:', socket.id);
  
  let currentRoom = null;
  let username = null;

  socket.on('createRoom', (data) => {
    const { username: user } = data;
    if (!user) {
      socket.emit('error', 'Pseudo requis');
      return;
    }
    
    let roomId;
    let room;
    let attempts = 0;
    
    do {
      roomId = generateRoomId();
      room = rooms.createRoom(roomId, socket.id);
      attempts++;
    } while (!room && attempts < 10);
    
    if (!room) {
      socket.emit('error', 'Impossible de créer un salon');
      return;
    }
    
    currentRoom = roomId;
    username = user;
    
    socket.join(roomId);
    
    const player = rooms.addPlayer(roomId, socket.id, user);
    rooms.setGameState(roomId, 'lobby');
    
    io.to(roomId).emit('roomCreated', {
      roomId: roomId,
      players: rooms.getRoom(roomId).players,
      host: socket.id,
      config: room.config
    });
    
    socket.emit('playerInfo', {
      id: socket.id,
      username: user,
      isHost: true
    });
    
    console.log(`Salon ${roomId} créé par ${user}`);
  });

  socket.on('joinRoom', (data) => {
    const { roomId, username: user } = data;
    if (!roomId || !user) {
      socket.emit('error', 'ID de salon et pseudo requis');
      return;
    }
    
    const room = rooms.getRoom(roomId);
    if (!room) {
      socket.emit('error', 'Salon inexistant');
      return;
    }
    
    if (room.gameState === 'playing') {
      socket.emit('error', 'La partie est déjà en cours');
      return;
    }
    
    currentRoom = roomId;
    username = user;
    
    socket.join(roomId);
    
    const player = rooms.addPlayer(roomId, socket.id, user);
    
    socket.emit('roomJoined', {
      roomId: roomId,
      players: room.players,
      host: room.host,
      config: room.config
    });
    
    io.to(roomId).emit('playersUpdate', {
      players: room.players
    });
    
    socket.emit('playerInfo', {
      id: socket.id,
      username: user,
      isHost: false
    });
    
    socket.emit('configUpdate', room.config);
    
    console.log(`${user} a rejoint le salon ${roomId}`);
  });

  socket.on('updateConfig', (data) => {
    if (!currentRoom) return;
    const room = rooms.getRoom(currentRoom);
    if (!room || room.host !== socket.id) return;
    
    const config = rooms.updateConfig(currentRoom, data);
    if (config) {
      io.to(currentRoom).emit('configUpdate', config);
    }
  });

  socket.on('startGame', () => {
    if (!currentRoom) return;
    const room = rooms.getRoom(currentRoom);
    if (!room || room.host !== socket.id) return;
    
    const result = game.startGame(currentRoom);
    if (result && result.error) {
      socket.emit('error', result.error);
      return;
    }
    
    if (result && result.success) {
      room.players.forEach(player => {
        const info = rooms.getPlayerInfo(currentRoom, player.id);
        io.to(player.id).emit('roleAssignment', {
          role: info.role,
          word: info.word,
          turnOrder: room.turnOrder
        });
      });
      
      io.to(currentRoom).emit('gameStarted', {
        turnOrder: room.turnOrder,
        players: room.players.map(p => ({
          id: p.id,
          username: p.username
        }))
      });
      
      console.log(`Partie démarrée dans le salon ${currentRoom}`);
    }
  });

  socket.on('seenWord', () => {
    if (!currentRoom) return;
    const room = rooms.getRoom(currentRoom);
    if (!room) return;
    
    rooms.setPlayerSeenWord(currentRoom, socket.id);
    
    const allSeen = rooms.allPlayersSeenWord(currentRoom);
    
    if (allSeen) {
      io.to(currentRoom).emit('allSeenWord');
    }
  });

  socket.on('vote', (data) => {
    if (!currentRoom) return;
    const room = rooms.getRoom(currentRoom);
    if (!room) return;
    
    const { targetId } = data;
    if (socket.id === targetId) {
      socket.emit('error', 'Impossible de voter pour soi-même');
      return;
    }
    
    const result = rooms.setVote(currentRoom, socket.id, targetId);
    if (result) {
      io.to(currentRoom).emit('voteUpdate', {
        voterId: socket.id,
        targetId: targetId
      });
    }
  });

  socket.on('endVoting', () => {
    if (!currentRoom) return;
    const room = rooms.getRoom(currentRoom);
    if (!room || room.host !== socket.id) return;
    
    const result = game.processVote(currentRoom);
    if (!result) return;
    
    const gameOver = game.checkGameOver(currentRoom);
    if (gameOver && gameOver.winner) {
      io.to(currentRoom).emit('gameOver', gameOver);
    } else {
      io.to(currentRoom).emit('voteResult', {
        eliminated: result.eliminated,
        eliminatedRole: result.eliminatedRole
      });
      
      rooms.resetVotes(currentRoom);
      
      const finalGameOver = game.checkGameOver(currentRoom);
      if (finalGameOver && finalGameOver.winner) {
        io.to(currentRoom).emit('gameOver', finalGameOver);
      }
    }
  });

  socket.on('resetGame', () => {
    if (!currentRoom) return;
    const room = rooms.getRoom(currentRoom);
    if (!room || room.host !== socket.id) return;
    
    rooms.resetGame(currentRoom);
    io.to(currentRoom).emit('gameReset');
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      const room = rooms.getRoom(currentRoom);
      if (room) {
        const player = rooms.getPlayer(currentRoom, socket.id);
        const isHost = room.host === socket.id;
        
        rooms.removePlayer(currentRoom, socket.id);
        
        if (isHost && room.players.length > 0) {
          room.host = room.players[0].id;
          room.players[0].isHost = true;
          io.to(room.players[0].id).emit('becomeHost');
        }
        
        io.to(currentRoom).emit('playersUpdate', {
          players: room.players
        });
        
        console.log(`${username} a quitté le salon ${currentRoom}`);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Serveur Undercover démarré sur http://localhost:${PORT}`);
  console.log(`Pour jouer en réseau local, utilisez http://IP_LOCALE:${PORT}`);
});