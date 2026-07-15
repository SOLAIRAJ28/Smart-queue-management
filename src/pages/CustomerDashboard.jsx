import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { logout } from '../redux/authSlice';
import { 
  LogOut, User, Ticket, Calendar, History, 
  MapPin, Clock, Star, HelpCircle, X, CheckCircle, Bell, AlertCircle, Sun, Moon
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

  return <span>{elapsed}</span>;
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

const CustomerDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryBranchId = searchParams.get('branchId');
  const { user } = useSelector((state) => state.auth);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  const loggedInUserId = (user?._id || user?.id)?.toString();

  // Lists from API
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [activeToken, setActiveToken] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [tokenHistory, setTokenHistory] = useState([]);
  const [customerStats, setCustomerStats] = useState(null);
  
  // Swap Requests State
  const [swapRequests, setSwapRequests] = useState([]);
  const [eligibleTokens, setEligibleTokens] = useState([]);
  const [selectedSwapToken, setSelectedSwapToken] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapReason, setSwapReason] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [activeIncomingSwap, setActiveIncomingSwap] = useState(null);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [targetTokenData, setTargetTokenData] = useState(null);
  const [swapHistory, setSwapHistory] = useState([]);

  // Modals state
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [queueType, setQueueType] = useState('instant'); // 'instant' or 'appointment'
  const [apptPurpose, setApptPurpose] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [selectedBranch, setSelectedBranch] = useState(queryBranchId || '');
  const [selectedService, setSelectedService] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('regular');
  
  const [apptDate, setApptDate] = useState('');
  const [apptSlot, setApptSlot] = useState('09:00 - 09:30');

  // Feedback Form State
  const [feedbackTokenId, setFeedbackTokenId] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [ratedTokenIds, setRatedTokenIds] = useState(new Set());

  const timeSlots = [
    '09:00 - 09:30', '09:30 - 10:00', '10:00 - 10:30',
    '10:30 - 11:00', '11:00 - 11:30', '11:30 - 12:00',
    '13:00 - 13:30', '13:30 - 14:00', '14:00 - 14:30',
    '14:30 - 15:00', '15:00 - 15:30', '15:30 - 16:00'
  ];

  const socketRef = useRef(null);

  // Connect and manage Socket.IO
  useEffect(() => {
    fetchDashboardData();

    if (!loggedInUserId) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 
      (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:5000');
    socketRef.current = io(socketUrl, { transports: ['websocket'] });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('register_user', loggedInUserId);
      
      const bId = activeToken?.branch?._id || activeToken?.branch;
      if (bId) {
        socketRef.current.emit('join_branch', bId.toString());
      }
    });

    socketRef.current.on('queue_updated', () => {
      fetchDashboardData();
    });

    socketRef.current.on('swapRequested', (data) => {
      const receiverId = data.swap?.receiverCustomer?.toString();
      if (receiverId && receiverId === loggedInUserId) {
        setActiveIncomingSwap(data);
      }
      fetchDashboardData();
    });

    socketRef.current.on('swapAccepted', (data) => {
      if (activeToken && (activeToken._id === data.senderTokenId || activeToken._id === data.receiverTokenId)) {
        setSuccessMessage('Token Swap Completed Successfully.');
      }
      fetchDashboardData();
    });

    socketRef.current.on('swapRejected', (data) => {
      const senderId = data.senderCustomer?.toString();
      if (senderId && senderId === loggedInUserId) {
        setErrorMessage('Your token swap request has been rejected.');
      }
      fetchDashboardData();
    });

    socketRef.current.on('swapCancelled', (data) => {
      const senderId = data.senderCustomer?.toString();
      const receiverId = data.receiverCustomer?.toString();
      if (loggedInUserId && (loggedInUserId === senderId || loggedInUserId === receiverId)) {
        setErrorMessage(data.reason || 'Swap request was cancelled.');
        if (activeIncomingSwap && activeIncomingSwap.swap?._id === data.requestId) {
          setActiveIncomingSwap(null);
        }
      }
      fetchDashboardData();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [loggedInUserId, activeToken?._id]);

  // Fallback direct registry check when user changes
  useEffect(() => {
    if (socketRef.current && loggedInUserId) {
      socketRef.current.emit('register_user', loggedInUserId);
    }
  }, [loggedInUserId]);

  // Join branch socket rooms for real-time updates
  useEffect(() => {
    if (!socketRef.current) return;
    
    const branchIds = new Set();
    if (activeToken?.branch?._id) {
      branchIds.add(activeToken.branch._id.toString());
    } else if (activeToken?.branch) {
      branchIds.add(activeToken.branch.toString());
    }
    
    appointments.forEach((appt) => {
      const bId = appt.branch?._id || appt.branch;
      if (bId) {
        branchIds.add(bId.toString());
      }
    });

    branchIds.forEach((bId) => {
      socketRef.current.emit('join_branch', bId);
    });
  }, [activeToken, appointments]);

  useEffect(() => {
    if (queryBranchId) {
      setSelectedBranch(queryBranchId);
      setQueueType('instant');
      setShowUnifiedModal(true);
    }
  }, [queryBranchId]);

  const fetchDashboardData = async () => {
    try {
      // Fire all independent requests in parallel
      const [
        branchesRes,
        servicesRes,
        activeTokenRes,
        apptsRes,
        historyRes,
      ] = await Promise.all([
        api.get('/branches'),
        api.get('/services'),
        api.get('/tokens/my-active'),
        api.get('/appointments/my'),
        api.get('/tokens/my-history'),
      ]);

      setBranches(branchesRes.data.data.branches.filter(b => b.isActive));
      setServices(servicesRes.data.data.services.filter(s => s.isActive));

      // Auto check-in QR handling
      const scannedBranchId = sessionStorage.getItem('scanBranchId');
      if (scannedBranchId) {
        setSelectedBranch(scannedBranchId);
        setQueueType('instant');
        setShowUnifiedModal(true);
        sessionStorage.removeItem('scanBranchId');
      }

      const token = activeTokenRes.data.data.token;
      setActiveToken(token);
      setPrediction(activeTokenRes.data.data.prediction);

      const histTokens = historyRes.data.data.tokens;
      setTokenHistory(histTokens);
      setRatedTokenIds(new Set(histTokens.filter(t => t.feedbackGiven).map(t => t._id)));

      setAppointments(apptsRes.data.data.appointments);

      // Swap data depends on active token — fire these after token is known
      if (token && token.status === 'waiting') {
        const [pendingSwapsRes, eligibleTokensRes] = await Promise.all([
          api.get('/customer/swaps/pending'),
          api.get(`/customer/swaps/eligible/${token._id}`),
        ]);
        setSwapRequests(pendingSwapsRes.data.data.swapRequests);
        setEligibleTokens(eligibleTokensRes.data.data.tokens);
      } else {
        setSwapRequests([]);
        setEligibleTokens([]);
      }

      // Non-critical secondary data — fire in background, don't block UI
      Promise.all([
        api.get('/customer/profile').then(r => setCustomerStats(r.data.data)).catch(() => {}),
        fetchNotifications(),
        fetchSwapHistory(),
      ]);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };


  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/customer/notifications');
      setNotifications(res.data.data.notifications);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const fetchSwapHistory = async () => {
    try {
      const res = await api.get('/customer/swaps/history');
      setSwapHistory(res.data.data.history);
    } catch (err) {
      console.error('Error fetching swap history:', err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/customer/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/customer/notifications/read-all');
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleIncomingRespond = async (requestId, action) => {
    setSwapLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setActiveIncomingSwap(null);
    try {
      const res = await api.post('/customer/swaps/respond', {
        requestId,
        action,
      });
      setSuccessMessage(res.data.message);
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.message || 'Failed to respond to swap request.');
    } finally {
      setSwapLoading(false);
    }
  };

  const handleProposeClick = () => {
    if (!selectedSwapToken || !swapReason.trim()) return;
    const target = eligibleTokens.find(t => t._id === selectedSwapToken);
    if (target) {
      setTargetTokenData(target);
      setShowProposeModal(true);
    }
  };

  const handleRequestSwap = async () => {
    if (!selectedSwapToken || !swapReason.trim()) return;
    setSwapLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await api.post('/customer/swaps/request', {
        senderTokenId: activeToken._id,
        receiverTokenId: selectedSwapToken,
        reason: swapReason.trim(),
      });
      setSuccessMessage('Swap request sent successfully.');
      setSelectedSwapToken('');
      setSwapReason('');
      setShowProposeModal(false);
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.message || 'Failed to send swap request.');
      setShowProposeModal(false);
    } finally {
      setSwapLoading(false);
    }
  };

  const handleRespondSwap = async (requestId, action) => {
    setSwapLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await api.post('/customer/swaps/respond', {
        requestId,
        action,
      });
      setSuccessMessage(
        action === 'accept'
          ? 'Swap request accepted! Your tokens have been exchanged.'
          : 'Swap request declined.'
      );
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.message || 'Failed to respond to swap request.');
    } finally {
      setSwapLoading(false);
    }
  };

  const handleCancelSwap = async (requestId) => {
    setSwapLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await api.post('/customer/swaps/cancel', { requestId });
      setSuccessMessage('Swap request cancelled.');
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.message || 'Failed to cancel swap request.');
    } finally {
      setSwapLoading(false);
    }
  };

  const handleUnifiedSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!selectedBranch || !selectedService) {
      setErrorMessage('Please select a branch and a service.');
      return;
    }

    if (queueType === 'instant') {
      try {
        const res = await api.post('/customer/token', {
          branchId: selectedBranch,
          serviceId: selectedService,
          priority: selectedPriority,
        });

        if (res.data.status === 'success') {
          const token = res.data.data.token;
          const prediction = res.data.data.prediction;
          const sName = services.find(s => s._id === selectedService)?.name || 'Lobby Service';
          
          setSuccessData({
            type: 'instant',
            tokenNumber: token.tokenNumber,
            serviceName: sName,
            counterName: 'Waiting to be called',
            waitTime: prediction?.waitMinutes || 0,
          });
          fetchDashboardData();
        }
      } catch (err) {
        setErrorMessage(err.response?.data?.message || 'Failed to join queue.');
      }
    } else {
      if (!apptDate || !apptSlot) {
        setErrorMessage('Please fill in all appointment fields.');
        return;
      }
      
      const selectedDate = new Date(apptDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate <= today) {
        setErrorMessage('Please select a future date.');
        return;
      }

      try {
        const res = await api.post('/customer/appointment', {
          branchId: selectedBranch,
          serviceId: selectedService,
          priority: selectedPriority,
          appointmentDate: apptDate,
          timeSlot: apptSlot,
          purpose: apptPurpose,
        });

        if (res.data.status === 'success') {
          const appt = res.data.data.appointment;
          const bName = branches.find(b => b._id === selectedBranch)?.name || '';
          const sName = services.find(s => s._id === selectedService)?.name || '';

          setSuccessData({
            type: 'appointment',
            appointmentId: appt.appointmentId,
            date: appt.appointmentDate || appt.date,
            time: appt.timeSlot,
            serviceName: sName,
            branchName: bName,
          });
          fetchDashboardData();
        }
      } catch (err) {
        setErrorMessage(err.response?.data?.message || 'Failed to book appointment.');
      }
    }
  };

  const handleDownloadReceipt = () => {
    if (!successData) return;
    const content = `========================================
       APEXBANK APPOINTMENT RECEIPT
========================================
Appointment ID : ${successData.appointmentId}
Branch         : ${successData.branchName}
Service        : ${successData.serviceName}
Date           : ${new Date(successData.date).toLocaleDateString()}
Time Slot      : ${successData.time}
Status         : Confirmed
========================================
   Thank you for choosing ApexBank!
========================================`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt_${successData.appointmentId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTrackQueue = () => {
    setShowUnifiedModal(false);
    setSuccessData(null);
  };

  const handleCancelAppt = async (apptId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      const res = await api.patch(`/appointments/${apptId}/cancel`);
      if (res.data.status === 'success') {
        triggerSuccess('Appointment cancelled.');
        fetchDashboardData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel appointment.');
    }
  };

  const handleOpenFeedback = (tokenId) => {
    setFeedbackTokenId(tokenId);
    setFeedbackRating(5);
    setFeedbackComments('');
    setErrorMessage('');
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/feedback', {
        tokenId: feedbackTokenId,
        rating: feedbackRating,
        comments: feedbackComments
      });

      if (res.data.status === 'success') {
        // Optimistically mark this token as rated immediately
        setRatedTokenIds((prev) => new Set([...prev, feedbackTokenId]));
        setShowFeedbackModal(false);
        triggerSuccess('Thank you! Your feedback has been registered.');
        fetchDashboardData();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to submit feedback.');
    }
  };

  const triggerSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col font-sans">
      {/* Top Navbar */}
      <nav className="bg-dark-900 border-b border-dark-800 px-6 py-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="cust-logo-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#D946EF" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
            <path d="M3 10 L4 8 L12 3 L20 8 L21 10" stroke="url(#cust-logo-grad)" />
            <circle cx="12" cy="7" r="1" stroke="url(#cust-logo-grad)" />
            <rect x="2" y="10" width="20" height="2" rx="0.5" stroke="url(#cust-logo-grad)" />
            <line x1="4" y1="12" x2="4" y2="20" stroke="url(#cust-logo-grad)" />
            <line x1="7" y1="12" x2="7" y2="20" stroke="url(#cust-logo-grad)" />
            <line x1="17" y1="12" x2="17" y2="20" stroke="url(#cust-logo-grad)" />
            <line x1="20" y1="12" x2="20" y2="20" stroke="url(#cust-logo-grad)" />
            <circle cx="12" cy="16" r="3" stroke="url(#cust-logo-grad)" />
            <text x="12" y="16" fontSize="5.5" fontWeight="bold" textAnchor="middle" dominantBaseline="central" fill="url(#cust-logo-grad)" stroke="none" fontFamily="sans-serif">$</text>
            <line x1="3" y1="20" x2="21" y2="20" stroke="url(#cust-logo-grad)" />
            <line x1="2" y1="22" x2="22" y2="22" stroke="url(#cust-logo-grad)" />
          </svg>
          <span className="text-lg font-bold text-white tracking-tight flex items-center">
            Nexa<span className="text-primary-500">Queue</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Notification dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
              className="p-2 hover:bg-dark-800 text-dark-400 hover:text-white rounded-lg transition-all duration-200 relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-bounce">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            {showNotificationDropdown && (
              <div className="absolute right-0 mt-2 w-80 glass-panel bg-dark-900 border border-dark-800 shadow-2xl rounded-2xl p-4 space-y-4 z-50">
                <div className="flex justify-between items-center pb-2 border-b border-dark-800">
                  <span className="text-sm font-bold text-white">Notifications</span>
                  {notifications.some(n => !n.read) && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-primary-400 hover:text-primary-300 font-semibold"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {notifications.length > 0 ? (
                    notifications.map(n => (
                      <div
                        key={n._id}
                        className={`p-3 rounded-xl border text-xs space-y-1 transition-all duration-200 ${
                          n.read
                            ? 'bg-dark-950/40 border-dark-800/50 text-dark-400'
                            : 'bg-primary-500/5 border-primary-500/20 text-dark-100 font-medium'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold">{n.title}</span>
                          {!n.read && (
                            <button
                              onClick={() => handleMarkRead(n._id)}
                              className="text-[10px] text-primary-400 hover:text-primary-300 font-semibold shrink-0"
                            >
                              Read
                            </button>
                          )}
                        </div>
                        <p>{n.message}</p>
                        <span className="block text-[9px] text-dark-500">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-dark-500 text-center py-4">No notifications yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-dark-300">
            <User className="w-4 h-4 text-primary-400" />
            <span className="font-medium">{user?.name || 'Customer'}</span>
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

      {/* Dashboard container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-8 space-y-8 relative">
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

        {/* Hello Banner */}
        <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Hello, {user?.name || 'Customer'}!</h1>
          </div>
          <div className="bg-primary-500/10 border border-primary-500/20 px-4 py-2 rounded-xl text-primary-400 text-xs font-semibold">
            Status: Portal Connected
          </div>
        </div>

        {/* Statistics Dashboard */}
        {customerStats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="glass-panel p-4 flex flex-col justify-between space-y-2 border-primary-500/10 bg-dark-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-dark-400">Total Tokens</span>
              <span className="text-3xl font-extrabold text-white">{customerStats.statistics.totalTokens}</span>
            </div>
            <div className="glass-panel p-4 flex flex-col justify-between space-y-2 border-emerald-500/10 bg-dark-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-dark-400">Completed</span>
              <span className="text-3xl font-extrabold text-emerald-400">{customerStats.statistics.completedServices}</span>
            </div>
            <div className="glass-panel p-4 flex flex-col justify-between space-y-2 border-amber-500/10 bg-dark-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-dark-400">Pending</span>
              <span className="text-3xl font-extrabold text-amber-400">{customerStats.statistics.pendingTokens}</span>
            </div>
            <div className="glass-panel p-4 flex flex-col justify-between space-y-2 border-red-500/10 bg-dark-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-dark-400">Cancelled</span>
              <span className="text-3xl font-extrabold text-red-400">{customerStats.statistics.cancelledTokens}</span>
            </div>
            <div className="glass-panel p-4 flex flex-col justify-between space-y-2 border-blue-500/10 bg-dark-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-dark-400">Last Branch</span>
              <span className="text-sm font-bold text-white truncate" title={customerStats.statistics.lastBranchVisited}>
                {customerStats.statistics.lastBranchVisited}
              </span>
            </div>
            <div className="glass-panel p-4 flex flex-col justify-between space-y-2 border-accent-500/10 bg-dark-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-dark-400">Last Counter</span>
              <span className="text-sm font-bold text-accent-400 truncate">
                {customerStats.statistics.lastCounterUsed}
              </span>
            </div>
          </div>
        )}

        {/* Active Ticket Card */}
        {activeToken ? (
          <div className="glass-panel-premium border-primary-500/30 p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary-400">Your Active Ticket</span>
                <h2 className="text-4xl font-extrabold text-white tracking-tight">{activeToken.tokenNumber}</h2>
                <p className="text-sm text-dark-300 font-medium">{activeToken.service?.name}</p>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-dark-400">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary-400" />
                  <span>{activeToken.branch?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent-400" />
                  <span>Status: <strong className="text-white uppercase">{activeToken.status}</strong></span>
                </div>
                {activeToken.status !== 'completed' && activeToken.status !== 'skipped' && (
                  <div className="flex items-center gap-2 bg-dark-900/60 border border-dark-800 px-3 py-1 rounded-xl">
                    <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span>Wait Time: <strong className="text-amber-400"><LiveTicketWaitTimer arrivalTime={activeToken.arrivalTime || activeToken.createdAt} status={activeToken.status} callTime={activeToken.callTime} /></strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Wait Prediction Section */}
            {prediction && (
              <div className="border-t border-dark-800/80 pt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
                <div className="space-y-1">
                  <div className="text-xs text-dark-400 font-semibold flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-primary-400" /> AI Est. Wait Time
                  </div>
                  <div className="text-lg font-bold text-white flex items-center gap-2">
                    {prediction.waitMinutes} mins
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                      prediction.congestionLevel === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      prediction.congestionLevel === 'moderate' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {prediction.congestionLevel}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-dark-300 bg-dark-900/60 border border-dark-800 p-2.5 rounded-xl max-w-md">
                  💡 {prediction.advice}
                </div>
              </div>
            )}

            {/* Slot Exchange/Swap Section */}
            {activeToken.status === 'waiting' ? (
              <div className="border-t border-dark-800/80 pt-6 space-y-6 animate-fade-in">
                <div className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-accent-400" />
                  <h3 className="text-lg font-bold text-white">Lobby Slot Exchange</h3>
                </div>

                {/* Incoming Swap Requests */}
                {swapRequests.some(r => {
                  const receiverId = (r.receiverCustomer?._id || r.receiverCustomer)?.toString();
                  return receiverId && loggedInUserId && receiverId === loggedInUserId;
                }) && (
                  <div className="space-y-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 block">Incoming Swap Requests</span>
                    {swapRequests
                      .filter(r => {
                        const receiverId = (r.receiverCustomer?._id || r.receiverCustomer)?.toString();
                        return receiverId && loggedInUserId && receiverId === loggedInUserId;
                      })
                      .map(request => (
                        <div key={request._id} className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="space-y-1 flex-grow">
                            <span className="text-sm font-semibold text-white">
                              {request.senderCustomer?.fullName || request.senderCustomer?.name} wants to swap slots!
                            </span>
                            <p className="text-xs text-dark-300">
                              Their Token: <strong className="text-white">{request.senderToken?.tokenNumber}</strong> &rarr; Your Token: <strong className="text-white">{activeToken.tokenNumber}</strong>
                            </p>
                            {request.reason && (
                              <p className="text-xs text-amber-200/90 mt-1.5 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                                <strong className="text-amber-100">Reason:</strong> {request.reason}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              disabled={swapLoading}
                              onClick={() => handleIncomingRespond(request._id, 'accept')}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              disabled={swapLoading}
                              onClick={() => handleIncomingRespond(request._id, 'decline')}
                              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Propose a Swap */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary-400 block">Request Slot Swap</span>
                    {eligibleTokens.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        <select
                           value={selectedSwapToken}
                           onChange={(e) => setSelectedSwapToken(e.target.value)}
                           className="glass-input w-full text-sm py-2 px-3 bg-dark-900/80 text-white border-dark-700 rounded-xl"
                        >
                          <option value="">-- Select Active Token --</option>
                          {eligibleTokens.map(token => (
                            <option key={token._id} value={token._id} className="bg-dark-950">
                              Token {token.tokenNumber} ({token.customer?.fullName || token.customer?.name})
                            </option>
                          ))}
                        </select>
                        {selectedSwapToken && (
                          <>
                            <textarea
                              value={swapReason}
                              onChange={(e) => setSwapReason(e.target.value)}
                              placeholder="Reason for requesting the swap (required)..."
                              className="glass-input w-full text-sm py-2 px-3 bg-dark-900/80 text-white border-dark-700 rounded-xl resize-none h-16"
                              required
                            />
                            <button
                              disabled={swapLoading || !selectedSwapToken || !swapReason.trim()}
                              onClick={handleProposeClick}
                              className="w-full py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-dark-800 text-white text-xs font-bold rounded-lg shadow transition-all duration-200"
                            >
                              Send Request
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-dark-400 italic">No other waiting customers in this service to swap with.</p>
                    )}
                  </div>

                  {/* Outgoing Requests */}
                  {swapRequests.some(r => {
                    const senderId = (r.senderCustomer?._id || r.senderCustomer)?.toString();
                    return senderId && loggedInUserId && senderId === loggedInUserId;
                  }) && (
                    <div className="space-y-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-dark-400 block">Sent Swap Requests</span>
                      <div className="space-y-2">
                        {swapRequests
                          .filter(r => {
                            const senderId = (r.senderCustomer?._id || r.senderCustomer)?.toString();
                            return senderId && loggedInUserId && senderId === loggedInUserId;
                          })
                          .map(request => (
                            <div key={request._id} className="p-3 bg-dark-900/60 border border-dark-800 rounded-xl flex justify-between items-center text-xs">
                              <div className="space-y-1">
                                <span className="text-dark-300">
                                  Sent to <strong className="text-white">{request.receiverToken?.tokenNumber}</strong>
                                </span>
                                <span className="block text-[10px] text-dark-500">Status: {request.status}</span>
                                {request.reason && (
                                  <p className="text-[11px] text-dark-400 mt-1 italic">
                                    Reason: "{request.reason}"
                                  </p>
                                )}
                              </div>
                              <button
                                disabled={swapLoading}
                                onClick={() => handleCancelSwap(request._id)}
                                className="px-2.5 py-1 border border-red-500/20 hover:bg-red-500/10 text-red-400 font-semibold rounded-lg transition-colors shrink-0"
                              >
                                Cancel
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeToken.status === 'calling' ? (
              <div className="border-t border-dark-800/80 pt-6">
                <div className="p-4 bg-primary-500/10 border border-primary-500/20 text-primary-400 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  <span>You are currently being served.</span>
                </div>
              </div>
            ) : activeToken.status === 'completed' ? (
              <div className="border-t border-dark-800/80 pt-6">
                <div className="p-4 bg-dark-900/60 border border-dark-800 text-dark-400 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  <span>Service Completed. Token swapping is no longer available.</span>
                </div>
              </div>
            ) : activeToken.status === 'cancelled' ? (
              <div className="border-t border-dark-800/80 pt-6">
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  <span>Token Cancelled. Token swapping is no longer available.</span>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="max-w-xl mx-auto">
            <div className="p-8 text-center space-y-6 group">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white transition-colors">Join Bank Queue</h3>
                <p className="text-dark-400 text-sm max-w-sm mx-auto">Get a token instantly or book an appointment for a future visit.</p>
              </div>
              <div>
                <button
                  onClick={() => {
                    setQueueType('instant');
                    setSelectedBranch('');
                    setSelectedService('');
                    setSelectedPriority('regular');
                    setApptDate('');
                    setApptSlot('09:00 - 09:30');
                    setApptPurpose('');
                    setErrorMessage('');
                    setSuccessData(null);
                    setShowUnifiedModal(true);
                  }}
                  className="btn-primary px-8 py-3"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Swap History List */}
        {swapHistory.length > 0 && (
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-accent-400" />
              Swap History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-dark-800 text-dark-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Tokens</th>
                    <th className="py-3 px-4">Other Customer</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800/40 text-dark-300">
                  {swapHistory.map((swap) => {
                    const senderId = (swap.senderCustomer?._id || swap.senderCustomer)?.toString();
                    const isSender = senderId === user?._id;
                    const displayRole = isSender ? 'Sender' : 'Receiver';
                    const senderTok = swap.senderToken?.tokenNumber ?? '—';
                    const receiverTok = swap.receiverToken?.tokenNumber ?? '—';
                    const displayTokens = isSender
                      ? `${senderTok} ➔ ${receiverTok}`
                      : `${receiverTok} ➔ ${senderTok}`;
                    const displayOther = isSender
                      ? swap.receiverCustomer?.name || 'Other User'
                      : swap.senderCustomer?.name || 'Other User';
                    const displayReason = swap.reason || 'N/A';
                    return (
                      <tr key={swap._id} className="hover:bg-dark-800/20">
                        <td className="py-3 px-4 whitespace-nowrap">{new Date(swap.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSender ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}>
                            {displayRole}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-white">{displayTokens}</td>
                        <td className="py-3 px-4 font-medium text-white">{displayOther}</td>
                        <td className="py-3 px-4 italic text-dark-400 max-w-[150px] truncate" title={displayReason}>{displayReason}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            swap.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            swap.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {swap.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Appointments List */}
        {appointments.length > 0 && (
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-400" />
              Upcoming Appointments
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-dark-800 text-dark-400 font-semibold">
                    <th className="py-3">Branch</th>
                    <th className="py-3">Service</th>
                    <th className="py-3">Date</th>
                    <th className="py-3">Time Slot</th>
                    <th className="py-3">Status</th>
                    <th className="py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800/50">
                  {appointments.map((appt) => (
                    <tr key={appt._id} className="text-dark-200">
                      <td className="py-4 font-medium text-white">{appt.branch?.name}</td>
                      <td className="py-4">{appt.service?.name}</td>
                      <td className="py-4">{new Date(appt.date).toLocaleDateString()}</td>
                      <td className="py-4">{appt.timeSlot}</td>
                      <td className="py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          appt.status === 'scheduled' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' : 
                          appt.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                          'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {appt.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {appt.status === 'scheduled' && (
                          <button
                            onClick={() => handleCancelAppt(appt._id)}
                            className="text-red-400 hover:text-red-300 font-medium text-xs transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Token History & Feedback */}
        {tokenHistory.length > 0 && (
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-primary-400" />
              Lobby Ticket History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-dark-800 text-dark-400 font-semibold">
                    <th className="py-3">Token</th>
                    <th className="py-3">Branch</th>
                    <th className="py-3">Service</th>
                    <th className="py-3">Counter</th>
                    <th className="py-3">Staff Served By</th>
                    <th className="py-3">Date & Time</th>
                    <th className="py-3">Wait Time</th>
                    <th className="py-3">Serve Time</th>
                    <th className="py-3">Status</th>
                    <th className="py-3 text-right">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800/50">
                  {tokenHistory.map((hist) => (
                    <tr key={hist._id} className="text-dark-200">
                      <td className="py-4 font-bold text-white">{hist.tokenNumber}</td>
                      <td className="py-4">{hist.branch?.name}</td>
                      <td className="py-4">{hist.service?.name}</td>
                      <td className="py-4 font-semibold text-accent-400">
                        {hist.counter?.number ? `Counter ${hist.counter.number}` : 'N/A'}
                      </td>
                      <td className="py-4 text-xs font-medium">
                        {hist.staff?.user?.name || hist.staff?.name || 'N/A'}
                      </td>
                      <td className="py-4 text-xs text-dark-300">
                        {new Date(hist.createdAt).toLocaleString()}
                      </td>
                      <td className="py-4 font-mono">{formatTimeDiff(hist.arrivalTime, hist.startedServingAt || hist.callTime || hist.completedAt || hist.updatedAt)}</td>
                      <td className="py-4 font-mono">{hist.status === 'completed' ? formatTimeDiff(hist.startedServingAt || hist.callTime || hist.serveTime, hist.completedAt || hist.completionTime) : 'N/A'}</td>
                      <td className="py-4">
                        <span className={`status-badge ${hist.status}`}>
                          {hist.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {hist.status === 'completed' && (
                          ratedTokenIds.has(hist._id) ? (
                            <span className="status-badge completed">
                              <CheckCircle className="w-3 h-3" /> Rated
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenFeedback(hist._id)}
                              className="btn-outline-primary ml-auto text-xs"
                            >
                              <Star className="w-3 h-3 fill-current" /> Rate Service
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Unified Queue Modal */}
      {showUnifiedModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel max-w-md w-full p-6 space-y-6 relative border-primary-500/20">
            
            <button 
              onClick={() => { setShowUnifiedModal(false); setSuccessData(null); }}
              className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {!successData ? (
              <>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white">Join Banking Queue</h3>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
                    {errorMessage}
                  </div>
                )}

                <form onSubmit={handleUnifiedSubmit} className="space-y-4">
                  {/* Step 1: Choose Queue Type */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-dark-300">Choose Queue Type</label>
                    <div className="grid grid-cols-2 gap-4 bg-dark-950/85 p-1 rounded-xl border border-dark-800">
                      <button
                        type="button"
                        onClick={() => { setQueueType('instant'); setErrorMessage(''); }}
                        className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                          queueType === 'instant' 
                            ? 'bg-primary-600 text-white shadow-sm' 
                            : 'text-dark-400 hover:text-white'
                        }`}
                      >
                        Instant Virtual Token
                      </button>
                      <button
                        type="button"
                        onClick={() => { setQueueType('appointment'); setErrorMessage(''); }}
                        className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                          queueType === 'appointment' 
                            ? 'bg-primary-600 text-white shadow-sm' 
                            : 'text-dark-400 hover:text-white'
                        }`}
                      >
                        Book Appointment
                      </button>
                    </div>
                  </div>

                  {/* Common Field: Select Branch */}
                  {!queryBranchId ? (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-dark-300">Select Branch</label>
                      <select 
                        value={selectedBranch} 
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="glass-input w-full"
                        required
                      >
                        <option value="">-- Choose Branch --</option>
                        {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1 bg-dark-900/60 p-3 rounded-lg border border-dark-800 text-left">
                      <label className="text-xs font-semibold text-dark-400">Selected Branch</label>
                      <div className="text-sm font-bold text-white">
                        {branches.find(b => b._id === selectedBranch)?.name || 'Loading branch...'}
                      </div>
                    </div>
                  )}

                  {/* Common Field: Select Service */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-dark-300">Select Service</label>
                    <select 
                      value={selectedService} 
                      onChange={(e) => setSelectedService(e.target.value)}
                      className="glass-input w-full"
                      required
                    >
                      <option value="">-- Choose Service --</option>
                      {services.map(s => <option key={s._id} value={s._id}>{s.name} ({s.prefix})</option>)}
                    </select>
                  </div>



                  {/* Appointment specific fields */}
                  {queueType === 'appointment' && (
                    <div className="space-y-4 pt-2 border-t border-dark-800/80 animate-fade-in">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-dark-300">Appointment Date</label>
                          <input 
                            type="date" 
                            value={apptDate}
                            onChange={(e) => setApptDate(e.target.value)}
                            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} // Future Date only
                            className="glass-input w-full text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-dark-300">Time Slot</label>
                          <select 
                            value={apptSlot} 
                            onChange={(e) => setApptSlot(e.target.value)}
                            className="glass-input w-full text-sm"
                            required
                          >
                            {timeSlots.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-dark-300">Purpose (Optional)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Open new account, locker query"
                          value={apptPurpose}
                          onChange={(e) => setApptPurpose(e.target.value)}
                          className="glass-input w-full"
                        />
                      </div>
                    </div>
                  )}

                  <button type="submit" className="w-full btn-primary py-3 mt-4 text-white">
                    {queueType === 'instant' ? 'Join Queue' : 'Book Appointment'}
                  </button>
                </form>
              </>
            ) : (
              /* Success Screen */
              <div className="text-center space-y-6 py-4 animate-fade-in">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mx-auto">
                  <CheckCircle className="w-10 h-10" />
                </div>

                {successData.type === 'instant' ? (
                  <>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-white">Token Generated</h3>
                      <p className="text-sm text-dark-400">Your virtual queue token is ready.</p>
                    </div>

                    <div className="bg-dark-950/60 border border-dark-800 rounded-2xl p-6 space-y-4 max-w-sm mx-auto">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-dark-400">Token Number</span>
                        <div className="text-4xl font-extrabold text-white tracking-tight mt-1">{successData.tokenNumber}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dark-800/80 text-left text-sm">
                        <div>
                          <span className="text-xs text-dark-400">Service</span>
                          <div className="font-semibold text-white truncate">{successData.serviceName}</div>
                        </div>
                        <div>
                          <span className="text-xs text-dark-400">Est. Wait Time</span>
                          <div className="font-semibold text-amber-400">{successData.waitTime} mins</div>
                        </div>
                      </div>
                      <div className="pt-2 text-left text-sm border-t border-dark-800/80">
                        <span className="text-xs text-dark-400">Counter</span>
                        <div className="font-semibold text-accent-400">{successData.counterName}</div>
                      </div>
                    </div>

                    <button 
                      onClick={handleTrackQueue}
                      className="w-full btn-primary py-3 mt-4 text-white"
                    >
                      Track Queue
                    </button>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-white">Appointment Booked</h3>
                      <p className="text-sm text-dark-400">Your priority slot has been reserved.</p>
                    </div>

                    <div className="bg-dark-950/60 border border-dark-800 rounded-2xl p-6 space-y-4 max-w-sm mx-auto text-left text-sm">
                      <div className="flex justify-between items-center pb-2 border-b border-dark-800/80">
                        <span className="text-xs font-bold uppercase tracking-wider text-dark-400">Appointment ID</span>
                        <span className="font-mono font-bold text-white">{successData.appointmentId}</span>
                      </div>
                      <div className="space-y-2 pt-2">
                        <div className="flex justify-between">
                          <span className="text-dark-400">Branch</span>
                          <span className="font-semibold text-white">{successData.branchName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-dark-400">Service</span>
                          <span className="font-semibold text-white">{successData.serviceName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-dark-400">Date</span>
                          <span className="font-semibold text-white">{new Date(successData.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-dark-400">Time Slot</span>
                          <span className="font-semibold text-accent-400">{successData.time}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-4">
                      <button 
                        onClick={handleDownloadReceipt}
                        className="w-full btn-primary py-3 text-white flex items-center justify-center gap-2"
                      >
                        Download Receipt
                      </button>
                      <button 
                        onClick={() => { setShowUnifiedModal(false); setSuccessData(null); }}
                        className="w-full btn-secondary py-3 text-white"
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}



      {/* Feedback Rating Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-md w-full p-6 space-y-6 relative border-emerald-500/20">
            <button 
              onClick={() => setShowFeedbackModal(false)}
              className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Rate Your Transaction</h3>
              <p className="text-sm text-dark-400">Share your banking experience to help us improve our branch speed.</p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-dark-300 block">Rating Score</label>
                <div className="flex gap-2 justify-center py-2">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFeedbackRating(val)}
                      className="p-1 hover:scale-110 transition-transform text-amber-400"
                    >
                      <Star className={`w-8 h-8 ${val <= feedbackRating ? 'fill-current' : 'text-dark-600'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-300">Comments / Suggestions</label>
                <textarea 
                  value={feedbackComments}
                  onChange={(e) => setFeedbackComments(e.target.value)}
                  className="glass-input w-full h-28 resize-none"
                  placeholder="Tell us what went well or what we can optimize..."
                  required
                />
              </div>

              <button type="submit" className="w-full btn-primary py-3 mt-4">
                Submit Feedback
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Propose Swap Confirmation Modal */}
      {showProposeModal && targetTokenData && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 space-y-6 border-primary-500/25 bg-dark-900/95 shadow-2xl relative rounded-2xl">
            <button
              onClick={() => setShowProposeModal(false)}
              className="absolute top-4 right-4 text-dark-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-extrabold text-white">PROPOSE TOKEN SWAP</h3>
              <p className="text-xs text-dark-400">Review slot exchange details before sending request</p>
            </div>

            <div className="p-4 bg-dark-950/60 rounded-xl border border-dark-800 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-dark-800">
                <div>
                  <span className="text-[10px] text-dark-500 font-bold uppercase block">Your Token</span>
                  <strong className="text-white text-base">{activeToken?.tokenNumber}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-dark-500 font-bold uppercase block">Target Token</span>
                  <strong className="text-primary-400 text-base">{targetTokenData.tokenNumber}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-dark-800">
                <div>
                  <span className="text-[10px] text-dark-500 font-bold uppercase block">Queue Position</span>
                  <span className="text-white font-medium">#{prediction?.waitMinutes ? Math.max(1, Math.round(prediction.waitMinutes / 15)) : '2'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-dark-500 font-bold uppercase block">Estimated Wait</span>
                  <span className="text-white font-medium">{prediction?.waitMinutes || '15'} mins</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-dark-500 font-bold uppercase block">Recipient</span>
                <span className="text-white font-medium">{targetTokenData.customer?.fullName || targetTokenData.customer?.name}</span>
              </div>

              <div>
                <span className="text-[10px] text-dark-500 font-bold uppercase block">Swap Reason</span>
                <span className="text-white italic">"{swapReason.trim()}"</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowProposeModal(false)}
                className="flex-grow btn-secondary py-2"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowProposeModal(false);
                  await handleRequestSwap();
                }}
                className="flex-grow btn-primary py-2"
              >
                Confirm & Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receiver Swap Notification Alert Panel */}
      {activeIncomingSwap && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 space-y-6 border-amber-500/25 bg-dark-900/95 shadow-2xl relative rounded-2xl">
            <div className="text-center space-y-1">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block font-mono">Token Swap Request</span>
              <h3 className="text-xl font-extrabold text-white">APEXBANK EXCHANGE</h3>
            </div>

            <div className="p-4 bg-dark-950/60 rounded-xl border border-dark-800 space-y-3 text-sm">
              <div>
                <span className="text-[10px] text-dark-500 font-bold uppercase block">Requester Customer</span>
                <strong className="text-white">{activeIncomingSwap.senderName}</strong>
              </div>
              <div className="grid grid-cols-2 gap-4 py-2 border-t border-b border-dark-800/50">
                <div>
                  <span className="text-[10px] text-dark-500 font-bold uppercase block">Their Token</span>
                  <strong className="text-amber-400">{activeIncomingSwap.senderTokenNumber}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-dark-500 font-bold uppercase block">Wants Your Token</span>
                  <strong className="text-white">{activeIncomingSwap.receiverTokenNumber}</strong>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-dark-500 font-bold uppercase block">Reason</span>
                <p className="text-white italic bg-amber-500/5 p-3 rounded-lg border border-amber-500/10 mt-1">
                  "{activeIncomingSwap.swap?.reason}"
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                disabled={swapLoading}
                onClick={() => handleIncomingRespond(activeIncomingSwap.swap._id, 'reject')}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all"
              >
                Reject
              </button>
              <button
                disabled={swapLoading}
                onClick={() => handleIncomingRespond(activeIncomingSwap.swap._id, 'accept')}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;
