import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Volume2, MonitorPlay, Radio, User, Sun, Moon } from 'lucide-react';
import api from '../services/api';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';

const LiveTicketWaitTimer = ({ arrivalTime, status, callTime }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const calculate = () => {
      const start = new Date(arrivalTime);
      const end = status === 'calling' && callTime ? new Date(callTime) : new Date();
      const diffMs = Math.max(0, end - start);
      const diffSecs = Math.floor(diffMs / 1000);
      const mins = Math.floor(diffSecs / 60);
      const secs = diffSecs % 60;
      const pad = (num) => String(num).padStart(2, '0');
      setElapsed(`${pad(mins)}m ${pad(secs)}s`);
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [arrivalTime, status, callTime]);

  return <span className="font-mono text-amber-400 font-bold">{elapsed}</span>;
};

const DisplayBoard = () => {
  const [searchParams] = useSearchParams();
  const queryBranchId = searchParams.get('branch');

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(queryBranchId || '');
  const [nowCalling, setNowCalling] = useState(null);
  const [allCounters, setAllCounters] = useState([]);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [currentTime, setCurrentTime] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const socketRef = useRef(null);
  const loadRef = useRef(null); // always holds latest loadDisplayData
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Time ticking
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch branches on load if no branch selected
  useEffect(() => {
    if (!queryBranchId) {
      api.get('/branches').then(res => {
        const activeBranches = res.data.data.branches.filter(b => b.isActive);
        setBranches(activeBranches);
        if (activeBranches.length > 0) {
          setSelectedBranchId(activeBranches[0]._id);
        }
      });
    }
  }, [queryBranchId]);

  // Generate QR code for customer check-in
  useEffect(() => {
    if (selectedBranchId) {
      const base = import.meta.env.VITE_CLIENT_URL || window.location.origin;
      const targetUrl = `${base}/customer?branchId=${selectedBranchId}`;
      QRCode.toDataURL(targetUrl, { width: 256, margin: 1 }, (err, url) => {
        if (err) {
          console.error('Error generating QR code for lobby:', err);
        } else {
          setQrCodeUrl(url);
        }
      });
    } else {
      setQrCodeUrl('');
    }
  }, [selectedBranchId]);

  // Connect socket and fetch data when branch selection changes
  useEffect(() => {
    if (!selectedBranchId) return;

    // Initial load
    if (loadRef.current) loadRef.current(selectedBranchId);

    // Initialize socket connection
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    socketRef.current = io(socketUrl, { transports: ['websocket'] });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      socketRef.current.emit('join_branch', selectedBranchId);
      // Re-fetch fresh data on (re)connect
      if (loadRef.current) loadRef.current(selectedBranchId);
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
    });

    // Real-time socket events — use loadRef.current to avoid stale closure
    socketRef.current.on('queue_updated', (data) => {
      if (loadRef.current) loadRef.current(selectedBranchId);
      if (data && data.tokenNumber && data.counterNumber) {
        announceToken(data.tokenNumber, data.counterNumber);
      }
    });

    socketRef.current.on('tokenCreated', () => {
      if (loadRef.current) loadRef.current(selectedBranchId);
    });

    socketRef.current.on('tokenCalled', (data) => {
      if (loadRef.current) loadRef.current(selectedBranchId);
      if (data && data.token && data.counterNumber) {
        announceToken(data.token.tokenNumber, data.counterNumber);
      }
    });

    socketRef.current.on('tokenCompleted', () => {
      if (loadRef.current) loadRef.current(selectedBranchId);
    });

    // Immediately update counter statuses when admin toggles a counter
    socketRef.current.on('counterStatusChanged', (data) => {
      if (data && data.counter) {
        // Instant optimistic update — compare as strings to handle ObjectId vs string mismatch
        setAllCounters(prev =>
          prev.map(c =>
            c._id.toString() === data.counter._id.toString()
              ? { ...c, status: data.counter.status }
              : c
          )
        );
      }
      // Also do a full refresh to stay in sync
      if (loadRef.current) loadRef.current(selectedBranchId);
    });

    socketRef.current.on('recall_token', (data) => {
      if (data && data.tokenNumber && data.counterNumber) {
        announceToken(data.tokenNumber, data.counterNumber, true);
      }
    });

    // Polling fallback every 10s to catch any missed socket events
    const pollInterval = setInterval(() => {
      if (loadRef.current) loadRef.current(selectedBranchId);
    }, 10000);

    return () => {
      clearInterval(pollInterval);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [selectedBranchId]);

  // Keep loadRef always pointing to latest function (avoids stale closure in socket callbacks)
  const loadDisplayData = async (branchId) => {
    try {
      // 1. Fetch counters in this branch
      const res = await api.get(`/counters?branch=${branchId}`);
      const counters = res.data.data.counters;
      setAllCounters(counters);

      // 2. Fetch all active tokens (waiting/calling) in this branch
      const queueRes = await api.get(`/tokens/branch/${branchId}`);
      const queue = queueRes.data.data.queue;

      // Filter tokens by status
      const waitingTokens = queue.filter(t => t.status === 'waiting');
      setWaitingQueue(waitingTokens);

      const callingTokens = queue.filter(t => t.status === 'calling');

      // Sort calling tokens by callTime or updatedAt DESC to find the most recently called one
      const sortedCalling = [...callingTokens].sort((a, b) => {
        const dateA = new Date(a.callTime || a.updatedAt);
        const dateB = new Date(b.callTime || b.updatedAt);
        return dateB - dateA;
      });

      if (sortedCalling.length > 0) {
        const topCall = sortedCalling[0];
        setNowCalling({
          tokenNumber: topCall.tokenNumber,
          counterNumber: topCall.counter?.number || 'TBD',
          serviceName: topCall.service?.name || 'Service',
          priority: topCall.priorityCategory || topCall.priority || 'regular',
          updatedAt: topCall.updatedAt
        });
      } else {
        setNowCalling(null);
      }
    } catch (err) {
      console.error('Error fetching display board data:', err);
    }
  };

  // Keep loadRef always in sync with the latest loadDisplayData
  loadRef.current = loadDisplayData;

  const announceToken = (tokenNumber, counterNumber, isRecall = false) => {
    if ('speechSynthesis' in window) {
      // Split characters in token number (e.g. W-2-0-1) for better TTS spelling
      const spacedToken = tokenNumber.split('').join(' ');
      const text = `Token number, ${spacedToken}, please proceed to Counter ${counterNumber}`;
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85; // slightly slower for clarity
      utterance.pitch = 1.0;
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const isServingAny = allCounters.some(c => c.currentToken);
  const hasWaiting = waitingQueue.length > 0;
  const isLobbyIdle = !nowCalling && !isServingAny && !hasWaiting;

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col justify-between p-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center bg-dark-900 border-b border-dark-800 p-4 rounded-xl gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="disp-logo-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#D946EF" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
              <path d="M3 10 L4 8 L12 3 L20 8 L21 10" stroke="url(#disp-logo-grad)" />
              <circle cx="12" cy="7" r="1" stroke="url(#disp-logo-grad)" />
              <rect x="2" y="10" width="20" height="2" rx="0.5" stroke="url(#disp-logo-grad)" />
              <line x1="4" y1="12" x2="4" y2="20" stroke="url(#disp-logo-grad)" />
              <line x1="7" y1="12" x2="7" y2="20" stroke="url(#disp-logo-grad)" />
              <line x1="17" y1="12" x2="17" y2="20" stroke="url(#disp-logo-grad)" />
              <line x1="20" y1="12" x2="20" y2="20" stroke="url(#disp-logo-grad)" />
              <circle cx="12" cy="16" r="3" stroke="url(#disp-logo-grad)" />
              <text x="12" y="16" fontSize="5.5" fontWeight="bold" textAnchor="middle" dominantBaseline="central" fill="url(#disp-logo-grad)" stroke="none" fontFamily="sans-serif">$</text>
              <line x1="3" y1="20" x2="21" y2="20" stroke="url(#disp-logo-grad)" />
              <line x1="2" y1="22" x2="22" y2="22" stroke="url(#disp-logo-grad)" />
            </svg>
            <span className="flex items-center">
              Nexa<span className="text-primary-500">Queue</span>
            </span>
          </div>
          {isConnected ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Connected
            </span>
          ) : (
            <span className="text-xs text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-full animate-pulse">
              Connecting...
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {!queryBranchId && branches.length > 0 && (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="glass-input text-xs font-semibold py-1.5 px-3 rounded-lg"
            >
              {branches.map(b => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          )}
          <div className="text-lg font-bold text-dark-300 font-mono">
            {currentTime || '00:00:00'}
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 hover:bg-dark-800 text-dark-400 hover:text-yellow-400 rounded-lg transition-all duration-200"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Display Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-6 flex-grow items-stretch">
        
        {/* Left Panel: Primary Announcement & Waiting Queue */}
        <div className="lg:col-span-8 space-y-6 flex flex-col">
          {/* Now Serving section */}
          {nowCalling && (
            <div className="glass-panel p-8 flex flex-col justify-center items-center text-center space-y-4 relative overflow-hidden flex-shrink-0">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="text-xl text-primary-400 font-extrabold uppercase tracking-widest animate-pulse">Now Serving</div>
              <div className="text-[100px] font-black text-primary-500 leading-none tracking-wide font-mono drop-shadow-[0_0_15px_rgba(var(--color-primary-500),0.3)]">
                {nowCalling.tokenNumber}
              </div>
              <div className="text-3xl text-white font-extrabold">Counter {nowCalling.counterNumber}</div>
              <div className="flex gap-4 text-xs text-dark-300 font-semibold bg-dark-900 border border-dark-800 px-4 py-1.5 rounded-full">
                <span>Service: <strong className="text-white">{nowCalling.serviceName}</strong></span>
                <span className="w-px bg-dark-700"></span>
                <span className="uppercase">Priority: <strong className="text-accent-400">{nowCalling.priority}</strong></span>
              </div>
              <button 
                onClick={() => announceToken(nowCalling.tokenNumber, nowCalling.counterNumber)}
                className="flex items-center gap-2 text-xs font-bold text-dark-400 hover:text-white bg-dark-800/50 border border-dark-700 px-4 py-2 rounded-full transition-all hover:bg-dark-800 mt-2"
              >
                <Volume2 className="w-4 h-4 text-primary-500" /> Repeat Call
              </button>
            </div>
          )}

          {isLobbyIdle && (
            <div className="glass-panel p-8 flex flex-col justify-center items-center text-center space-y-6 relative overflow-hidden flex-grow min-h-[400px]">
              <div className="w-16 h-16 bg-dark-800 rounded-full flex items-center justify-center mx-auto text-dark-500">
                <MonitorPlay className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">Lobby Idle</h3>
                <p className="text-sm text-dark-400 max-w-sm mx-auto">Tellers are currently not calling any tokens. Please wait for queue alerts.</p>
              </div>
            </div>
          )}

          {/* Waiting Queue section - render if not idle */}
          {!isLobbyIdle && (
            <div className="glass-panel p-6 flex-grow flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-500 animate-pulse"></span>
                Waiting Customers ({waitingQueue.length})
              </h3>
              
              <div className="overflow-x-auto flex-grow">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs text-dark-400 uppercase border-b border-dark-800 font-semibold">
                      <th className="py-3 px-4 text-center">Pos</th>
                      <th className="py-3 px-4">Token Number</th>
                      <th className="py-3 px-4">Service</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4 text-right">Wait Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800/40 text-sm">
                    {waitingQueue.length > 0 ? (
                      waitingQueue.map((token, index) => (
                        <tr key={token._id} className="text-dark-200 hover:bg-dark-900/40 transition-colors">
                          <td className="py-3 px-4 text-center font-bold text-dark-400">{index + 1}</td>
                          <td className="py-3 px-4 font-black text-white font-mono text-base">{token.tokenNumber}</td>
                          <td className="py-3 px-4 font-semibold text-dark-100">{token.service?.name}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              token.priorityCategory === 'premium' || token.priorityCategory === 'corporate'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : token.priorityCategory === 'senior' || token.priorityCategory === 'disabled'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : 'bg-primary-500/10 text-primary-400 border-primary-500/20'
                            }`}>
                              {token.priorityCategory || 'regular'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <LiveTicketWaitTimer arrivalTime={token.arrivalTime} status={token.status} callTime={token.callTime} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-dark-550 text-xs">
                          No other customers are currently waiting in the queue.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Counter Status Panel */}
        <div className="lg:col-span-4 glass-panel p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-4 border-b border-dark-800 pb-2 flex items-center gap-2">
              Counter Status
              <span className="ml-auto text-[10px] font-semibold bg-dark-900 border border-dark-800 text-dark-400 px-2 py-0.5 rounded-full">
                {allCounters.filter(c => c.status === 'enabled').length} / {allCounters.length} Active
              </span>
            </h3>
            <div className="space-y-3">
              {allCounters.length > 0 ? (
                [...allCounters].sort((a, b) => a.number - b.number).map((counter) => {
                  const isEnabled = counter.status === 'enabled';
                  const isServing = isEnabled && !!counter.currentToken;
                  const isStaffActive = counter.counterStaff && (counter.counterStaff.status === 'active' || counter.counterStaff.status === 'Enabled');

                  return (
                    <div
                      key={counter._id}
                      className={`flex flex-col p-4 rounded-xl border gap-3 transition-all ${
                        !isEnabled
                          ? 'bg-dark-950/80 border-dark-800/50 opacity-50'
                          : isServing
                          ? 'bg-accent-500/5 border-accent-500/25 shadow-[0_0_12px_rgba(var(--color-accent-500),0.05)]'
                          : 'bg-dark-900/60 border-dark-800 hover:border-dark-700'
                      }`}
                    >
                      {/* Top Row: Counter Title */}
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${isEnabled ? 'text-white' : 'text-dark-500'}`}>
                            Counter {counter.number}
                          </span>
                          {!isEnabled && (
                            <span className="text-[10px] text-dark-600 italic">Counter Disabled</span>
                          )}
                        </div>
                      </div>

                      {/* Middle Row: Assigned Staff/Teller & Staff Status */}
                      <div className="flex justify-between items-center bg-dark-950/40 p-2 rounded-lg border border-dark-800/50 text-xs">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-dark-400" />
                          <span className="font-medium text-dark-200">
                            {counter.counterStaff?.staffName || (
                              <span className="text-dark-500 italic">Unassigned</span>
                            )}
                          </span>
                        </div>
                        <div>
                          {counter.counterStaff ? (
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              isStaffActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {isStaffActive ? 'Staff Active' : 'Staff Inactive'}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border bg-dark-800/55 text-dark-500 border-dark-800/70">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Current Service & Token Status */}
                      {isEnabled && (
                        <div className="flex justify-between items-center text-xs border-t border-dark-800/40 pt-2.5">
                          <span className="text-dark-400 font-medium">
                            {counter.currentService?.name || 'General Service'}
                          </span>
                          <span>
                            {isServing ? (
                              <span className="font-mono font-black text-accent-400 text-sm">
                                Serving: {counter.currentToken.tokenNumber}
                              </span>
                            ) : (
                              <span className="font-semibold text-dark-550">
                                Idle
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-dark-400 text-xs py-4 text-center">No counters configured for this branch.</p>
              )}
            </div>
          </div>
          {/* QR Code Check-in section */}
          {qrCodeUrl && (
            <div className="mt-6 pt-4 border-t border-dark-800 flex flex-col items-center text-center space-y-2.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-accent-400">
                Scan to Join Queue
              </span>
              <div className="p-2.5 bg-white rounded-xl inline-block shadow-lg shadow-accent-500/5 transition-transform hover:scale-105 duration-300">
                <img src={qrCodeUrl} alt="Scan to join queue" className="w-24 h-24" />
              </div>
              <p className="text-[10px] text-dark-400 max-w-[200px] leading-relaxed">
                Scan with your phone to get your digital ticket instantly.
              </p>
            </div>
          )}

          <div className="text-[10px] text-dark-500 text-center border-t border-dark-800 pt-3 mt-4">
            Please watch this screen. Your token number will flash and announce when ready.
          </div>
        </div>
      </div>


    </div>
  );
};

export default DisplayBoard;
