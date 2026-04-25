const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Health Check / Version Verify
app.get('/', (req, res) => {
    res.send("<h1>AdsPower Master Backend is Live! (v1.1 - Persistence & Smart Dispatch)</h1>");
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- DATA STORES (Later move to Supabase) ---
// --- DATA STORES (Later move to Supabase) ---
let rdps = {};          // { hostname: { hostname, status, currentAccount, ip, isOnline, socketId } }
let accountPool = [];   // List of { email, password, recoveryEmail }

// --- GUERRILLA MAIL HELPER ---
const GUERRILLA_API = "https://api.guerrillamail.com/ajax.php";

async function getOTPFromGuerrilla(email) {
    try {
        const username = email.split('@')[0];
        console.log(`[Guerrilla] Accessing inbox for: ${username}`);

        // 1. Set the email user
        const setRes = await axios.get(`${GUERRILLA_API}?f=set_email_user&email_user=${username}`);
        const sid_token = setRes.data.sid_token;

        // 2. Check for messages (Retry up to 10 times)
        for (let i = 0; i < 10; i++) {
            console.log(`[Guerrilla] Checking inbox (Attempt ${i + 1})...`);
            const msgRes = await axios.get(`${GUERRILLA_API}?f=get_email_list&offset=0&sid_token=${sid_token}`);
            const messages = msgRes.data.list || [];

            // Find AdsPower OTP message
            const otpMsg = messages.find(m => 
                m.mail_from.toLowerCase().includes('adspower') || 
                m.mail_subject.toLowerCase().includes('verification code')
            );

            if (otpMsg) {
                // Fetch full mail to get the code
                const fullRes = await axios.get(`${GUERRILLA_API}?f=fetch_email&email_id=${otpMsg.mail_id}&sid_token=${sid_token}`);
                const body = fullRes.data.mail_body;
                
                // Extract 6-digit code
                const match = body.match(/\b\d{6}\b/);
                if (match) return match[0];
            }
            await new Promise(r => setTimeout(r, 5000)); // Wait 5s before retry
        }
    } catch (error) {
        console.error("[Guerrilla Error]", error.message);
    }
    return null;
}

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
    console.log(`[RDP Connected] ID: ${socket.id}`);

    socket.on('register_rdp', (data) => {
        // Update or Create RDP entry keyed by Hostname
        rdps[data.hostname] = {
            hostname: data.hostname,
            status: 'IDLE',
            currentAccount: null,
            ip: socket.handshake.address,
            isOnline: true,
            socketId: socket.id
        };
        console.log(`[RDP Registered] ${data.hostname} at ${socket.id}`);
        io.emit('update_rdp_list', Object.values(rdps));
    });

    socket.on('disconnect', () => {
        console.log(`[RDP Disconnected] ${socket.id}`);
        // Find RDP by socketId and set to Offline
        const hostname = Object.keys(rdps).find(h => rdps[h].socketId === socket.id);
        if (hostname) {
            rdps[hostname].isOnline = false;
            rdps[hostname].status = 'OFFLINE';
            rdps[hostname].socketId = null;
        }
        io.emit('update_rdp_list', Object.values(rdps));
    });

    // Bot requests OTP
    socket.on('request_otp', async (data) => {
        const { email } = data;
        console.log(`[OTP Request] For ${email} from ${socket.id}`);
        const otp = await getOTPFromGuerrilla(email);
        socket.emit('otp_response', { success: !!otp, otp });
    });
});

// --- API ENDPOINTS ---

// Upload accounts
app.post('/api/accounts/upload', (req, res) => {
    const { list } = req.body; // Expecting string "mail:pass:recovery"
    const lines = list.split('\n');
    lines.forEach(line => {
        const parts = line.trim().split(':');
        if (parts.length === 3) {
            accountPool.push({
                email: parts[0],
                password: parts[1],
                recoveryEmail: parts[2],
                status: 'AVAILABLE'
            });
        }
    });
    res.json({ success: true, count: accountPool.length });
});

// Trigger Login for all RDPs
app.post('/api/commands/login-all', (req, res) => {
    // Only target RDPs that are ONLINE and IDLE
    const targetHosts = Object.keys(rdps).filter(h => rdps[h].isOnline && rdps[h].status === 'IDLE');
    
    console.log(`[Master Command] Smart Dispatch triggered for ${targetHosts.length} IDLE RDPs`);

    let dispatchedCount = 0;
    targetHosts.forEach((hostname) => {
        if (accountPool.length > 0) {
            const account = accountPool.shift(); // Take one account from pool (Unique)
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Master Backend running on port ${PORT}`);
});
