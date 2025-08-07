// ==== server.js ====
import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Server } from 'socket.io';
import { router as authRouter, authMiddleware } from './auth.js';
import db from './db.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

app.use('/api', authRouter);

const userSockets = new Map();

io.use(authMiddleware);
io.on('connection', (socket) => {
  const user = socket.user || { id: null, username: 'Ẩn danh' };
  if (user.id) userSockets.set(user.id, socket.id);
  console.log(`User connected: ${user.username}`);

  socket.on('send message', ({ to, content }) => {
    console.log(`Message from ${user.username} to ${to || 'public'}: ${content}`);
    db.prepare('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)')
      .run(user.id, to || null, content);

    const msg = { from: user.id, to, content, senderName: user.username };

    if (to) {
      const targetSocket = userSockets.get(to);
      if (targetSocket) io.to(targetSocket).emit('private message', msg);
      io.to(socket.id).emit('private message', msg); // echo back to sender
    } else {
      io.emit('public message', msg);
    }
  });

  socket.on('disconnect', () => {
    if (user.id) userSockets.delete(user.id);
    console.log(`User disconnected: ${user.username}`);
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
