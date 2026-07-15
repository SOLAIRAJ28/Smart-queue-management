import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../redux/authSlice';
import { 
  LogOut, User, Users, Play, SkipForward, CheckSquare, 
  BellRing, Shuffle, Coffee, HelpCircle, AlertCircle, X, CheckCircle, Star, Clock, Sun, Moon
} from 'lucide-react';
import api from '../services/api';
import { io } from 'socket.io-client';

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

const LiveTicketServeTimer = ({ serveTime }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!serveTime) {
      setElapsed('00m 00s');
      return;
    }
    const calculate = () => {
      const start = new Date(serveTime);
      const diffMs = Math.max(0, new Date() - start);
      const diffSecs = Math.floor(diffMs / 1000);
      const mins = Math.floor(diffSecs / 60);
      const secs = diffSecs % 60;
      const pad = (num) => String(num).padStart(2, '0');
      setElapsed(`${pad(mins)}m ${pad(secs)}s`);
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [serveTime]);

  return <span className="font-mono">{elapsed}</span>;
};

const formatTimeDiff = (start, end) => {
  if (!start) return '00m 00s';
  const startTime = new Date(start);
  const endTime = end ? new Date(end) : new Date();
  const diffMs = Math.max(0, endTime - startTime);
  const diffSecs = Math.floor(diffMs / 1000);
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  const pad = (num) => String(num).padStart(2, '0');
  return `${pad(mins)}m ${pad(secs)}s`;
};

const StaffDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Lobby/Counter state
  const [myCounter, setMyCounter] = useState(null);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals / Feedback
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferService, setTransferService] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);

  // Active customer tracking & history
  const [activeCustomerStats, setActiveCustomerStats] = useState(null);
  const [activeCustomerHistory, setActiveCustomerHistory] = useState([]);

  const socketRef = useRef(null);
  const myCounterRef = useRef(null); // keeps socket closures up-to-date without stale state

  // Keep ref in sync with state
  useEffect(() => {
    myCounterRef.current = myCounter;
  }, [myCounter]);

  useEffect(() => {
    // Fire all three initial fetches in parallel
    Promise.all([
      fetchStaffDetails(),
      fetchServicesList(),
      fetchFeedbackHistory(),
    ]);

    // Connect Socket for real-time queue refresh
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    socketRef.current = io(socketUrl, { transports: ['websocket'] });

    socketRef.current.on('connect', () => {
    });

    socketRef.current.on('queue_updated', () => {
      // Use fast single-counter refresh instead of fetching all counters
      if (myCounterRef.current?._id) {
        fetchMyCounter();
      } else {
        fetchStaffDetails();
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Fetch active customer statistics and visit history when active customer changes
  useEffect(() => {
    const fetchActiveCustomerData = async () => {
      const custId = myCounter?.currentToken?.customer?._id || myCounter?.currentToken?.customer;
      if (!custId) {
        setActiveCustomerStats(null);
        setActiveCustomerHistory([]);
        return;
      }
      try {
        const statsRes = await api.get(`/staff/customer/${custId}/statistics`);
        setActiveCustomerStats(statsRes.data.data);

        const historyRes = await api.get(`/staff/customer/${custId}/history`);
        setActiveCustomerHistory(historyRes.data.data.tokens);
      } catch (err) {
        console.error('Error fetching active customer tracking data:', err);
      }
    };

    fetchActiveCustomerData();
  }, [myCounter?.currentToken?.customer?._id || myCounter?.currentToken?.customer]);

  // Fetch all counters to find the one assigned to this staff member (initial load)
  const fetchStaffDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get('/counters');
      const counters = res.data.data.counters;
      
      const userCounterId = user?.counterId?.toString();
      const userId = (user?._id || user?.id)?.toString();

      const assignedCounter = counters.find((c) => {
        const cId = c._id?.toString();
        if (userCounterId && cId === userCounterId) return true;
        if (c.counterStaff?._id?.toString() === userId) return true;
        if (c.counterStaff?._id?.toString() === userCounterId) return true;
        if (c.currentStaff?.user?._id?.toString() === userId) return true;
        if (c.currentStaff?.user === userId) return true;
        return false;
      });

      if (assignedCounter) {
        setMyCounter(assignedCounter);
        loadBranchQueue(assignedCounter.branch?._id || assignedCounter.branch);

        // Join socket room
        if (socketRef.current && assignedCounter.branch) {
          const bId = assignedCounter.branch._id || assignedCounter.branch;
          socketRef.current.emit('join_branch', bId.toString());
        }
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching staff counter details:', err);
      setLoading(false);
    }
  };

  // Fast single-counter refresh used after button actions (much faster than fetching all counters)
  const fetchMyCounter = async () => {
    const counterId = user?.counterId?.toString() || myCounter?._id?.toString();
    if (!counterId) { fetchStaffDetails(); return; }
    try {
      const res = await api.get(`/counters/${counterId}`);
      const counter = res.data.data.counter;
      if (counter) {
        setMyCounter(counter);
        loadBranchQueue(counter.branch?._id || counter.branch);
      }
    } catch {
      fetchStaffDetails(); // fallback to full reload on error
    }
  };


  const fetchServicesList = async () => {
    try {
      const res = await api.get('/services');
      setServices(res.data.data.services.filter(s => s.isActive));
    } catch (err) {
      console.error('Error fetching services:', err);
    }
  };

  const fetchFeedbackHistory = async () => {
    try {
      const res = await api.get('/feedback/my-feedback');
      if (res.data.status === 'success') {
        setFeedbacks(res.data.data.feedbacks);
      }
    } catch (err) {
      console.error('Error fetching feedback history:', err);
    }
  };

  const loadBranchQueue = async (branchId) => {
    if (!branchId) return;
    try {
      const res = await api.get(`/tokens/branch/${branchId}`);
      // Filter the waiting list for this branch
      setWaitingQueue(res.data.data.queue);
    } catch (err) {
      console.error('Error loading branch queue:', err);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const triggerSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4500);
  };

  const triggerError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(''), 5000);
  };

  // Queue Actions — all use optimistic UI: update state instantly, sync server in background
  const handleCallNext = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setErrorMessage('');
    try {
      const res = await api.post('/queue/call-next');
      if (res.data.status === 'success') {
        if (res.data.data && res.data.data.token) {
          const calledToken = res.data.data.token;
          triggerSuccess(`Called Token: ${calledToken.tokenNumber}`);
          // Optimistic update: show calling token immediately
          setMyCounter(prev => prev ? { ...prev, currentToken: calledToken } : prev);
        } else {
          triggerError('No waiting customers in the queue for your assigned service.');
        }
        fetchMyCounter(); // background sync
      }
    } catch (err) {
      triggerError(err.response?.data?.message || 'Call Next operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartServe = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setErrorMessage('');
    // Optimistic: immediately mark token as serving
    setMyCounter(prev => prev?.currentToken
      ? { ...prev, currentToken: { ...prev.currentToken, status: 'serving', serveTime: new Date().toISOString() } }
      : prev
    );
    try {
      const res = await api.post('/queue/start-serve');
      if (res.data.status === 'success') {
        triggerSuccess('Started serving customer.');
        fetchMyCounter(); // background sync to confirm
      }
    } catch (err) {
      triggerError(err.response?.data?.message || 'Failed to start serving.');
      fetchMyCounter(); // revert via server state
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setErrorMessage('');
    // Optimistic: immediately clear active customer
    const prevCounter = myCounter;
    setMyCounter(prev => prev ? { ...prev, currentToken: null } : prev);
    try {
      const res = await api.post('/queue/skip');
      if (res.data.status === 'success') {
        triggerSuccess('Customer ticket skipped.');
        setActiveCustomerStats(null);
        setActiveCustomerHistory([]);
        fetchMyCounter(); // background sync
      }
    } catch (err) {
      triggerError(err.response?.data?.message || 'Skip operation failed.');
      setMyCounter(prevCounter); // revert on error
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecall = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setErrorMessage('');
    // Recall is fire-and-forget — no state change, just confirm it worked
    try {
      const res = await api.post('/queue/recall');
      if (res.data.status === 'success') {
        triggerSuccess('Recall alarm buzzer triggered.');
      }
    } catch (err) {
      triggerError(err.response?.data?.message || 'Recall operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setErrorMessage('');
    // Optimistic: immediately clear active customer
    const prevCounter = myCounter;
    setMyCounter(prev => prev ? { ...prev, currentToken: null } : prev);
    setActiveCustomerStats(null);
    setActiveCustomerHistory([]);
    try {
      const res = await api.post('/queue/complete');
      if (res.data.status === 'success') {
        triggerSuccess('Service completed successfully!');
        // Background sync both counter state and feedback history
        fetchMyCounter();
        fetchFeedbackHistory();
      }
    } catch (err) {
      triggerError(err.response?.data?.message || 'Completion failed.');
      setMyCounter(prevCounter); // revert on error
    } finally {
      setActionLoading(false);
    }
  };


  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferService) {
      triggerError('Please select a service for transfer.');
      return;
    }
    if (actionLoading) return;
    setActionLoading(true);
    setErrorMessage('');
    try {
      const res = await api.post('/queue/transfer', {
        toServiceId: transferService,
        reason: transferReason,
      });

      if (res.data.status === 'success') {
        setShowTransferModal(false);
        setTransferReason('');
        triggerSuccess('Token transferred successfully.');
        fetchStaffDetails();
      }
    } catch (err) {
      triggerError(err.response?.data?.message || 'Transfer failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col font-sans">
      {/* Top Navbar */}
      <nav className="bg-dark-900 border-b border-dark-800 px-6 py-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="staff-logo-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#D946EF" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
            <path d="M3 10 L4 8 L12 3 L20 8 L21 10" stroke="url(#staff-logo-grad)" />
            <circle cx="12" cy="7" r="1" stroke="url(#staff-logo-grad)" />
            <rect x="2" y="10" width="20" height="2" rx="0.5" stroke="url(#staff-logo-grad)" />
            <line x1="4" y1="12" x2="4" y2="20" stroke="url(#staff-logo-grad)" />
            <line x1="7" y1="12" x2="7" y2="20" stroke="url(#staff-logo-grad)" />
            <line x1="17" y1="12" x2="17" y2="20" stroke="url(#staff-logo-grad)" />
            <line x1="20" y1="12" x2="20" y2="20" stroke="url(#staff-logo-grad)" />
            <circle cx="12" cy="16" r="3" stroke="url(#staff-logo-grad)" />
            <text x="12" y="16" fontSize="5.5" fontWeight="bold" textAnchor="middle" dominantBaseline="central" fill="url(#staff-logo-grad)" stroke="none" fontFamily="sans-serif">$</text>
            <line x1="3" y1="20" x2="21" y2="20" stroke="url(#staff-logo-grad)" />
            <line x1="2" y1="22" x2="22" y2="22" stroke="url(#staff-logo-grad)" />
          </svg>
          <span className="text-lg font-bold text-white tracking-tight flex items-center">
            Nexa<span className="text-primary-500">Queue</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-dark-300">
            <User className="w-4 h-4 text-accent-400" />
            <span className="font-medium">{user?.name || 'Staff Member'}</span>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 hover:bg-dark-800 text-dark-400 hover:text-yellow-400 rounded-lg transition-all duration-200"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-dark-800 text-dark-400 hover:text-red-400 rounded-lg transition-all duration-200"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Main Layout */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        
        {/* Left Panel: Active Teller Controls */}
        <div className="lg:col-span-8 space-y-6">
          {successMessage && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm flex items-center gap-2 animate-pulse">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Active Counter Header */}
          <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="text-xs text-accent-400 font-semibold uppercase tracking-wider">
                {myCounter ? `${myCounter.branch?.name} - Counter ${myCounter.number}` : 'Lobby Setup'}
              </span>
              <h1 className="text-2xl font-bold text-white mt-1">Counter Control Panel</h1>
              <p className="text-dark-400 text-sm mt-1">
                Assigned Service: <strong className="text-white">{myCounter?.currentService?.name || 'None'}</strong>
              </p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl text-emerald-400 text-xs font-semibold uppercase">
              Status: Active / Online
            </div>
          </div>

          {/* Active Serving Token Panel */}
          {myCounter?.currentToken ? (
            <div className="glass-panel-premium border-accent-500/30 p-8 space-y-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent-400">Currently Serving</span>
                  <h2 className="text-5xl font-extrabold text-white tracking-tight">{myCounter.currentToken.tokenNumber}</h2>
                  <p className="text-sm text-dark-300">
                    Service: {myCounter.currentToken.service?.name || 'Default Transaction'}
                  </p>
                  {myCounter.currentToken.serveTime && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl w-fit">
                      <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} />
                      <span>Serving Duration:</span>
                      <LiveTicketServeTimer serveTime={myCounter.currentToken.serveTime} />
                    </div>
                  )}
                </div>
                <div className="px-3.5 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/20 text-accent-400 text-xs font-bold uppercase">
                  {myCounter.currentToken.status}
                </div>
              </div>

              {/* Action Buttons for Active Token */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                {myCounter.currentToken.status === 'calling' && !myCounter.currentToken.serveTime && (
                  <button
                    onClick={handleStartServe}
                    disabled={actionLoading}
                    className="btn-accent py-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Play className="w-4 h-4" />}
                    Start Serving
                  </button>
                )}
                <button
                  onClick={handleRecall}
                  disabled={actionLoading}
                  className="btn-secondary py-3 font-semibold text-sm flex items-center justify-center gap-2 text-accent-400 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {actionLoading ? <span className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" /> : <BellRing className="w-4 h-4" />}
                  Recall Buzzer
                </button>
                <button
                  onClick={() => setShowTransferModal(true)}
                  disabled={actionLoading}
                  className="btn-secondary py-3 font-semibold text-sm flex items-center justify-center gap-2 text-blue-400 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Shuffle className="w-4 h-4" /> Transfer
                </button>
                <button
                  onClick={handleSkip}
                  disabled={actionLoading}
                  className="btn-secondary py-3 font-semibold text-sm flex items-center justify-center gap-2 text-amber-400 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {actionLoading ? <span className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" /> : <SkipForward className="w-4 h-4" />}
                  Skip Customer
                </button>
                <button
                  onClick={handleComplete}
                  disabled={actionLoading}
                  className="col-span-2 md:col-span-4 btn-primary py-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {actionLoading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                  {actionLoading ? 'Processing...' : 'Complete Service'}
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-10 text-center space-y-6">
              <div className="w-16 h-16 bg-accent-500/10 border border-accent-500/20 rounded-2xl flex items-center justify-center text-accent-400 mx-auto">
                <Coffee className="w-8 h-8" />
              </div>
              <div className="max-w-sm mx-auto space-y-2">
                <h3 className="text-xl font-bold text-white">No active customer</h3>
                <p className="text-sm text-dark-400">Your counter is currently idle. Press the button below to fetch the next waiting customer.</p>
              </div>
              <button
                onClick={handleCallNext}
                disabled={actionLoading}
                className="btn-accent px-8 py-3.5 font-bold text-sm mx-auto flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {actionLoading
                  ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Play className="w-4 h-4" />
                }
                {actionLoading ? 'Calling...' : 'Call Next Customer'}
              </button>
            </div>
          )}

          {/* Customer Profile & Queue History Panel */}
          {myCounter?.currentToken?.customer && (
            <div className="glass-panel p-6 space-y-6 border-accent-500/20">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-dark-800">
                <div>
                  <span className="text-[10px] text-accent-400 font-extrabold uppercase tracking-wider">Customer Profile</span>
                  <h3 className="text-xl font-bold text-white mt-0.5">
                    {myCounter.currentToken.customer.fullName || myCounter.currentToken.customer.name}
                  </h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dark-400 mt-1">
                    <span>Username: <strong className="text-dark-200">{myCounter.currentToken.customer.username || 'N/A'}</strong></span>
                    <span>•</span>
                    <span>Email: <strong className="text-dark-200">{myCounter.currentToken.customer.email}</strong></span>
                    <span>•</span>
                    <span>Mobile: <strong className="text-dark-200">{myCounter.currentToken.customer.mobile || myCounter.currentToken.customer.phone}</strong></span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-dark-400 font-extrabold uppercase tracking-wider block">Home Branch</span>
                  <span className="text-xs font-bold text-dark-100 bg-dark-900 px-3 py-1 rounded-lg border border-dark-800 block mt-1">
                    {myCounter.currentToken.customer.branch || 'Main Branch'}
                  </span>
                </div>
              </div>

              {/* Statistics Grid */}
              {activeCustomerStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-dark-900/60 border border-dark-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] text-dark-500 font-extrabold uppercase tracking-widest block">Total Visits</span>
                    <span className="text-2xl font-extrabold text-white block">{activeCustomerStats.totalVisits}</span>
                  </div>
                  <div className="bg-dark-900/60 border border-dark-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] text-dark-500 font-extrabold uppercase tracking-widest block">Tokens Generated</span>
                    <span className="text-2xl font-extrabold text-accent-400 block">{activeCustomerStats.totalTokensGenerated}</span>
                  </div>
                  <div className="bg-dark-900/60 border border-dark-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] text-dark-500 font-extrabold uppercase tracking-widest block">Last Counter</span>
                    <span className="text-lg font-bold text-white block truncate">{activeCustomerStats.lastCounterServed ? `Counter ${activeCustomerStats.lastCounterServed}` : 'N/A'}</span>
                  </div>
                  <div className="bg-dark-900/60 border border-dark-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] text-dark-500 font-extrabold uppercase tracking-widest block">Avg. Serve Time</span>
                    <span className="text-lg font-bold text-emerald-400 block">{activeCustomerStats.averageServiceTime ? `${activeCustomerStats.averageServiceTime}m` : '0m'}</span>
                  </div>
                </div>
              )}

              {/* Frequently Used Services & Assigned Counters */}
              {activeCustomerStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-dark-900/40 border border-dark-800/80 p-4 rounded-xl space-y-2">
                    <h4 className="font-bold text-white uppercase tracking-wider text-[10px] text-dark-400">Frequently Used Services</h4>
                    {activeCustomerStats.frequentlyUsedServices?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {activeCustomerStats.frequentlyUsedServices.map((srv, idx) => (
                          <span key={idx} className="bg-primary-500/10 border border-primary-500/20 text-primary-400 px-2.5 py-1 rounded-lg font-medium">
                            {srv.name} ({srv.count})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-dark-500 italic">No services registered.</p>
                    )}
                  </div>
                  <div className="bg-dark-900/40 border border-dark-800/80 p-4 rounded-xl space-y-2">
                    <h4 className="font-bold text-white uppercase tracking-wider text-[10px] text-dark-400">Previous Counters Assigned</h4>
                    {activeCustomerStats.previousCountersAssigned?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {activeCustomerStats.previousCountersAssigned.map((cnt, idx) => (
                          <span key={idx} className="bg-accent-500/10 border border-accent-500/20 text-accent-400 px-2.5 py-1 rounded-lg font-medium">
                            {cnt}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-dark-500 italic">No counters assigned.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Previous Queue Records List */}
              <div className="space-y-3">
                <h4 className="font-bold text-white uppercase tracking-wider text-[10px] text-dark-400">Previous Queue Records & Visits</h4>
                {activeCustomerHistory.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto border border-dark-800 rounded-xl divide-y divide-dark-800/60 bg-dark-900/20">
                    {activeCustomerHistory.map((histToken) => (
                      <div key={histToken._id} className="p-3 flex justify-between items-center text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{histToken.tokenNumber}</span>
                            <span className="text-dark-500">•</span>
                            <span className="text-dark-300 font-medium">{histToken.service?.name}</span>
                          </div>
                          <div className="text-dark-500 text-[10px]">
                            {new Date(histToken.createdAt).toLocaleString()} • Wait: {formatTimeDiff(histToken.arrivalTime, histToken.startedServingAt || histToken.callTime || histToken.completedAt || histToken.updatedAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-accent-400">
                            {histToken.counter?.number ? `Counter ${histToken.counter.number}` : 'N/A'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            histToken.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-dark-800 text-dark-400'
                          }`}>
                            {histToken.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-dark-400 text-xs italic">No previous visit records found for this branch.</p>
                )}
              </div>
            </div>
          )}

          {/* Rating & Feedback History Panel */}
          <div className="glass-panel p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400 fill-current" /> My Service Rating History
                </h2>
                <p className="text-xs text-dark-400 mt-1">Customer reviews and sentiment analytics for completed tickets.</p>
              </div>
              {feedbacks.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-dark-400 block font-semibold">Average Rating</span>
                    <span className="text-lg font-extrabold text-amber-400">
                      {(feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(1)} ★
                    </span>
                  </div>
                  <div className="bg-dark-800 text-dark-200 text-xs px-2.5 py-1.5 rounded-full font-bold">
                    {feedbacks.length} Ratings
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {feedbacks.length > 0 ? (
                feedbacks.map((f) => (
                  <div key={f._id} className="p-4 rounded-xl bg-dark-900/60 border border-dark-800 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-white text-sm">{f.token?.tokenNumber || 'N/A'}</span>
                        <span className="text-xs text-dark-400 ml-2">({f.service?.name})</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((starVal) => (
                          <Star 
                            key={starVal}
                            className={`w-3.5 h-3.5 ${starVal <= f.rating ? 'text-amber-400 fill-current' : 'text-dark-600'}`} 
                          />
                        ))}
                      </div>
                    </div>
                    {f.comments && (
                      <p className="text-xs text-dark-300 italic leading-relaxed">"{f.comments}"</p>
                    )}
                    <div className="flex justify-between items-center text-[10px] text-dark-500">
                      <span>Rated by: {f.customer?.name || 'Guest/Walk-in'}</span>
                      <span>{new Date(f.createdAt).toLocaleDateString()} {new Date(f.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-dark-400 text-xs py-4 text-center">No feedback entries received yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Live Branch Lobby Queue */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-accent-400" /> Lobby Queue
              </h2>
              <span className="bg-dark-800 text-dark-200 text-xs px-2.5 py-1 rounded-full font-bold">
                {waitingQueue.filter(t => t.status === 'waiting').length} Waiting
              </span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {waitingQueue.length > 0 ? (
                waitingQueue.map((ticket) => (
                  <div 
                    key={ticket._id} 
                    className={`p-3 rounded-xl border flex justify-between items-center transition-all duration-200 ${
                      ticket.status === 'calling' 
                        ? 'bg-accent-500/5 border-accent-500/30' 
                        : 'bg-dark-900/60 border-dark-800'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        {ticket.tokenNumber}
                        {ticket.priority !== 'regular' && (
                          <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">
                            {ticket.priority}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-dark-400 mt-0.5">{ticket.service?.name}</div>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-dark-500">
                        <Clock className="w-3 h-3 text-amber-400/80" />
                        <span>Wait time:</span>
                        <LiveTicketWaitTimer arrivalTime={ticket.arrivalTime || ticket.createdAt} status={ticket.status} callTime={ticket.callTime} />
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                      ticket.status === 'calling' 
                        ? 'bg-accent-500/10 text-accent-400 border-accent-500/20' 
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-dark-400 text-xs py-4 text-center">Queue is empty.</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-md w-full p-6 space-y-6 relative border-accent-500/20">
            <button 
              onClick={() => setShowTransferModal(false)}
              className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Transfer Customer</h3>
              <p className="text-sm text-dark-400">Route this customer to another bank department.</p>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-300">Select Target Service</label>
                <select 
                  value={transferService} 
                  onChange={(e) => setTransferService(e.target.value)}
                  className="glass-input w-full"
                  required
                >
                  <option value="">-- Choose Service --</option>
                  {services
                    .filter(s => s._id !== myCounter?.currentService?._id && s._id !== myCounter?.currentService)
                    .map(s => <option key={s._id} value={s._id}>{s.name}</option>)
                  }
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-300">Transfer Reason</label>
                <textarea 
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="glass-input w-full h-24 resize-none"
                  placeholder="E.g., Customer needs Cashier Withdrawal processing next..."
                />
              </div>

              <button type="submit" className="w-full btn-accent py-3 mt-4 text-white">
                Confirm & Route Customer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;
