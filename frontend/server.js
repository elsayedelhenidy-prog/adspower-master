const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const express = require("express");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// --- Backend Data Stores ---
let rdps = {};
let accountPool = [];

app.prepare().then(() => {
    const expressApp = express();
    expressApp.use(express.json());

    const server = createServer(expressApp);
    const io = new Server(server, {
        cors: { origin: "*", methods: ["GET", "POST"] }
    });

    // --- API Routes (Moved from backend) ---
    expressApp.post('/api/accounts/upload', (req, res) => {
        const lines = req.body.list.split('\n');
        let count = 0;
        lines.forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 3) {
                accountPool.push({ email: parts[0], password: parts[1], recoveryEmail: parts[2] });
                count++;
            }
        });
        res.json({ success: true, count });
    });

    expressApp.post('/api/commands/login-all', (req, res) => {
        const targetHosts = Object.keys(rdps).filter(h => rdps[h].isOnline && rdps[h].status === 'IDLE');
        let dispatchedCount = 0;
        targetHosts.forEach((hostname) => {
            if (accountPool.length > 0) {
                const account = accountPool.shift();
                const socketId = rdps[hostname].socketId;
                rdps[hostname].status = 'LOGGING_IN';
                rdps[hostname].currentAccount = account.email;
                if (socketId) {
                    io.to(socketId).emit('CMD_LOGIN_NEW', account);
                    dispatchedCount++;
                }
            }
        });
        io.emit('update_rdp_list', Object.values(rdps));
        res.json({ success: true, dispatched: dispatchedCount });
    });

    // --- Socket.IO Logic ---
    io.on('connection', (socket) => {
        socket.on('register_rdp', (data) => {
            rdps[data.hostname] = {
                hostname: data.hostname,
                status: 'IDLE',
                currentAccount: null,
                ip: socket.handshake.address,
                isOnline: true,
                socketId: socket.id
            };
            io.emit('update_rdp_list', Object.values(rdps));
        });

        socket.on('disconnect', () => {
            const hostname = Object.keys(rdps).find(h => rdps[h].socketId === socket.id);
            if (hostname) {
                rdps[hostname].isOnline = false;
                rdps[hostname].status = 'OFFLINE';
                rdps[hostname].socketId = null;
            }
            io.emit('update_rdp_list', Object.values(rdps));
        });

        socket.on('request_otp', async (data, callback) => {
            // Placeholder logic for Guerrilla Mail (can be expanded)
            callback({ otp: null }); 
        });
    });

    // --- Next.js Handler ---
    expressApp.all("*", (req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    server.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Unified Server Ready on http://${hostname}:${port}`);
    });
});
