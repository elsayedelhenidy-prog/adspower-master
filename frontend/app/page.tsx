"use client";

import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Monitor, Play, RefreshCcw, Database, ShieldCheck, Terminal, AlertCircle, Plus } from 'lucide-react';

const SOCKET_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://adspower-master-production.up.railway.app";

interface RDPNode {
    hostname?: string;
    status?: string;
    currentAccount?: string;
    ip?: string;
    isOnline?: boolean;
}

export default function MasterDashboard() {
    const [rdps, setRdps] = useState<RDPNode[]>([]);
    const [accountList, setAccountList] = useState("");
    const [stats, setStats] = useState({ totalAccounts: 0, used: 0 });
    const [statusMsg, setStatusMsg] = useState<{type: string, text: string}>({ type: 'info', text: 'Dashboard Ready' });

    useEffect(() => {
        const socket = io(SOCKET_URL);

        socket.on('update_rdp_list', (data: RDPNode[]) => {
            setRdps(data);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const handleUpload = async () => {
        try {
            const res = await fetch(`${SOCKET_URL}/api/accounts/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ list: accountList })
            });
            const data = await res.json();
            if (data.success) {
                setStats({ ...stats, totalAccounts: data.count });
                setStatusMsg({ type: 'success', text: `Successfully uploaded ${data.count} accounts.` });
                setAccountList("");
            }
        } catch (e) {
            setStatusMsg({ type: 'error', text: 'Upload failed. Check backend connection.' });
        }
    };

    const handleLoginAll = async () => {
        if (rdps.length === 0) {
            setStatusMsg({ type: 'error', text: 'No active RDPs connected.' });
            return;
        }
        try {
            await fetch(`${SOCKET_URL}/api/commands/login-all`, { method: 'POST' });
            setStatusMsg({ type: 'success', text: 'Command "Login New Account" sent to all RDPs.' });
        } catch (e) {
            setStatusMsg({ type: 'error', text: 'Failed to send master command.' });
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-slate-100 font-sans selection:bg-indigo-500/30">
            {/* Header */}
            <header className="border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                            <ShieldCheck className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">AdsPower Master</h1>
                            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Command Center v1.0</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                            <span className="text-xs font-medium text-indigo-400">Server: Railway Online</span>
                        </div>
                        <button 
                            onClick={handleLoginAll}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-bold transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                        >
                            <Play size={18} fill="currentColor" />
                            loginnewaccountallrdp
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
                {/* Status Alert */}
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                    statusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    statusMsg.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                    'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                }`}>
                    <AlertCircle size={20} />
                    <span className="text-sm font-medium">{statusMsg.text}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left: Account Uploader */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Database size={20} className="text-indigo-400" />
                                    Account Pool
                                </h2>
                                <span className="text-xs bg-white/5 px-2 py-1 rounded text-slate-400 font-mono">
                                    {stats.totalAccounts} Ready
                                </span>
                            </div>
                            
                            <div className="space-y-4">
                                <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Paste Accounts (mail:pass:recovery)</label>
                                <textarea 
                                    className="w-full h-48 bg-[#080808] border border-white/5 rounded-xl p-4 text-sm font-mono text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                                    placeholder="user1@mail.com:pass123:recovery1@sharklasers.com&#10;user2@mail.com:pass456:recovery2@sharklasers.com"
                                    value={accountList}
                                    onChange={(e) => setAccountList(e.target.value)}
                                />
                                <button 
                                    onClick={handleUpload}
                                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 border border-white/10 active:scale-95"
                                >
                                    <Plus size={18} />
                                    Upload to Queue
                                </button>
                            </div>
                        </div>

                        {/* System Stats Card */}
                        <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-white/5 rounded-2xl p-6 shadow-xl">
                            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4">Live Statistics</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                    <p className="text-xs text-slate-500 font-medium mb-1">Active Bots</p>
                                    <p className="text-2xl font-bold">{rdps.length}</p>
                                </div>
                                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                    <p className="text-xs text-slate-500 font-medium mb-1">Success Rate</p>
                                    <p className="text-2xl font-bold text-emerald-500">98%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: RDP Monitor */}
                    <div className="lg:col-span-8 bg-[#121212] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Monitor size={20} className="text-indigo-400" />
                                RDP Fleet Monitor
                            </h2>
                            <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                                <RefreshCcw size={18} className="text-slate-500" />
                            </button>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">
                                        <th className="px-6 py-4">RDP Target</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Active Account</th>
                                        <th className="px-6 py-4">IP Address</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {rdps.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-slate-500 italic">
                                                No active RDP agents detected. Connect a bot to see it here.
                                            </td>
                                        </tr>
                                    ) : rdps.map((rdp, i) => (
                                        <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                                                        <Terminal size={14} className="text-indigo-400" />
                                                    </div>
                                                    <span className="font-bold text-sm">{rdp.hostname || 'Unknown Host'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                                    rdp.status === 'IDLE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                    rdp.status === 'LOGGING_IN' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                    rdp.status === 'OFFLINE' ? 'bg-slate-500/10 text-slate-500 border-slate-500/20' :
                                                    'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        rdp.status === 'IDLE' ? 'bg-emerald-500' :
                                                        rdp.status === 'LOGGING_IN' ? 'bg-amber-500' :
                                                        rdp.status === 'OFFLINE' ? 'bg-slate-500' :
                                                        'bg-indigo-500'
                                                    }`}></span>
                                                    {rdp.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-sm font-mono text-slate-400">{rdp.currentAccount || 'N/A'}</span>
                                            </td>
                                            <td className="px-6 py-5 text-sm text-slate-500 font-mono">
                                                {rdp.ip || '0.0.0.0'}
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <button className="text-xs font-bold text-indigo-400 hover:text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Force Logout
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
