const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});
const path = require('path');

app.use(express.static(__dirname));

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const players = {};

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    // Send existing players to new player
    socket.emit('currentPlayers', players);
    
    // Notify other players about new player
    socket.broadcast.emit('newPlayer', {
        id: socket.id,
        x: 0,
        y: 0,
        z: 0,
        rotation: 0
    });
    
    // Add new player
    players[socket.id] = {
        x: 0,
        y: 0,
        z: 0,
        rotation: 0
    };
    
    // Handle player movement
    socket.on('playerMovement', (movementData) => {
        players[socket.id] = movementData;
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            ...movementData
        });
    });
    
    // Handle shooting
    socket.on('playerShoot', (shootData) => {
        socket.broadcast.emit('playerShot', {
            id: socket.id,
            ...shootData
        });
    });
    
    // Handle NPC hit
    socket.on('npcHit', (npcData) => {
        io.emit('npcDestroyed', npcData);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;

// Only start server if not in Vercel environment
if (process.env.VERCEL !== '1') {
    http.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
module.exports.io = io;
module.exports.http = http;
