// ==== auth.js ====
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import db from './db.js';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

// Middleware để xác thực token
function requireAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    const hashed = await bcrypt.hash(password, 10);
    try {
        db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashed);

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
        res.json({ token });
        
    } catch (err) {
        res.status(400).json({ error: 'Username exists' });
    }
});

router.post('/login', async (req, res) => {
    // console.log(req);
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token });
});

router.get('/profile', requireAuth, (req, res) => {
    res.json({ id: req.user.id, username: req.user.username})
});

router.get('/users',requireAuth, (req, res) => {
    const users = db.prepare('SELECT id, username FROM users').all();
    res.json(users);
});

router.get('/messages',requireAuth, (req, res) => {
    console.log(req.user.id + ' fetching messages for user ' + req.query.to);
    const to = parseInt(req.query.to);
    const limit = parseInt(req.query.limit) || 50;       // mặc định 50
    const beforeTimestamp = req.query.before;
    console.log(`Params: to=${to}, limit=${limit}, before=${beforeTimestamp}`);

    let rows;
    if(to) {
        rows = db.prepare(`
            SELECT m.*, u.username AS senderName
            FROM messages m
                JOIN users u ON m.sender_id = u.id
            WHERE ((sender_id = @me AND receiver_id = @to)
                OR (sender_id = @to AND receiver_id = @me))
              AND (@beforeTimestamp IS NULL OR DATETIME(m.timestamp) < DATETIME(@beforeTimestamp))
            ORDER BY timestamp DESC
            LIMIT @limit
        `).all({ me: req.user.id, to, beforeTimestamp, limit });
    }
    else {
        rows = db.prepare(`
            SELECT m.*, u.username AS senderName
            FROM messages m
                JOIN users u ON m.sender_id = u.id
            WHERE receiver_id IS NULL
              AND (@beforeTimestamp IS NULL OR DATETIME(m.timestamp) < DATETIME(@beforeTimestamp))
            ORDER BY timestamp DESC
            LIMIT @limit
        `).all({ beforeTimestamp, limit});
    }
    console.log(`Fetched ${rows.length} messages`);
    res.json(rows); // return newest
})

// Middleware để xác thực người dùng qua socket
function authMiddleware(socket, next) {
    const token = socket.handshake.auth.token;
    if (!token) return next(); // cho phép ẩn danh

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        socket.user = payload;
        next();
    } catch (err) {
        next(); // tiếp tục như người ẩn danh
    }
}


export { router, authMiddleware };
