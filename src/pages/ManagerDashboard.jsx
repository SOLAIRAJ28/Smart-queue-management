import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../redux/authSlice';
import { 
  LogOut, User, BarChart2, Users, Clock, Radio, 
  Power, AlertTriangle, RefreshCw, Layers, CheckCircle,
  FileText, Download, Clipboard, Sparkles, Shield, UserX, Award, Sun, Moon
} from 'lucide-react';
import api from '../services/api';
import { io } from 'socket.io-client';

// Chart.js imports
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, 
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler 
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

const ManagerDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // States
  const [activeTab, setActiveTab] = useState('monitor'); // 'monitor', 'staff', 'analytics'
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [counters, setCounters] = useState([]);
  const [queueTokens, setQueueTokens] = useState([]);
  const [services, setServices] = useState([]);
  
  // Real-time queue metrics (for Lobby monitor & Stats Overview)
  const [analytics, setAnalytics] = useState({
    branchName: '',
    branchCode: '',
    branchStatus: '',
    totalTickets: 0,
    activeWaiting: 0,
    servedCount: 0,
    skippedCount: 0,
    callingCount: 0,
    avgWaitTime: 0,
    avgServingTime: 0,
    activeCounters: 0,
    activeStaff: 0,
    peakHour: 'N/A'
  });

  // BI Dashboard Analytics states
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState('today');
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');
  const [analyticsServiceId, setAnalyticsServiceId] = useState('');
  const [analyticsData, setAnalyticsData] = useState({
    kpis: {
      totalTickets: { value: 0, trend: { percent: 0, direction: 'flat' }, description: '' },
      customersServed: { value: 0, trend: { percent: 0, direction: 'flat' }, description: '' },
      avgWaitTime: { value: 0, trend: { percent: 0, direction: 'flat' }, description: '' },
      avgServiceTime: { value: 0, trend: { percent: 0, direction: 'flat' }, description: '' }
    },
    aiBullets: [],
    topPerformers: { branch: 'N/A', counter: 'N/A', staff: 'N/A' },
    attentionAlerts: [],
    branchComparisons: [],
    counterRankings: [],
    customerInsights: {
      mostRequested: 'N/A',
      leastRequested: 'N/A',
      avgVisitDuration: 0,
      returningRate: 0,
      peakVisitTime: 'N/A',
      avgQueueLength: 0
    },
    charts: {
      hourlyCounts: [],
      dailyTrend: []
    }
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const socketRef = useRef(null);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // 1. Fetch branches and services on load
  useEffect(() => {
    fetchBranches();
    fetchServices();
  }, []);

  // 2. Load branch data when selection changes
  useEffect(() => {
    if (selectedBranchId) {
      loadBranchData(selectedBranchId);
      if (activeTab === 'analytics') {
        loadBIAnalytics(selectedBranchId);
      }
    }
  }, [selectedBranchId, activeTab, analyticsTimeframe, analyticsStartDate, analyticsEndDate, analyticsServiceId]);

  // 3. Connect Socket.IO for real-time monitoring
  useEffect(() => {
    if (!selectedBranchId) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 
      (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:5000');
    socketRef.current = io(socketUrl, { transports: ['websocket'] });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join_branch', selectedBranchId);
    });

    const handleUpdate = () => {
      loadBranchData(selectedBranchId);
      if (activeTabRef.current === 'analytics') {
        loadBIAnalytics(selectedBranchId);
      }
    };

    socketRef.current.on('queue_updated', handleUpdate);
    socketRef.current.on('tokenCreated', handleUpdate);
    socketRef.current.on('tokenCalled', handleUpdate);
    socketRef.current.on('tokenCompleted', handleUpdate);
    socketRef.current.on('queueUpdated', handleUpdate);
    socketRef.current.on('counterStatusChanged', handleUpdate);
    socketRef.current.on('service_updated', () => {
      fetchServices();
      if (activeTabRef.current === 'analytics') {
        loadBIAnalytics(selectedBranchId);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [selectedBranchId]);

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches');
      let branchList = res.data.data.branches;
      
      // Strict role check: Branch Managers only see their assigned branch
      if (user?.role === 'branch_manager' && user?.branchId) {
        branchList = branchList.filter(b => b._id === user.branchId);
      }
      
      setBranches(branchList);
      
      if (branchList.length > 0) {
        const targetId = (user?.role === 'branch_manager' && user?.branchId) ? user.branchId : branchList[0]._id;
        setSelectedBranchId(targetId);
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await api.get('/services');
      setServices(res.data.data.services || []);
    } catch (err) {
      console.error('Error fetching services:', err);
    }
  };

  const loadBranchData = async (branchId) => {
    try {
      // All three are independent — fire in parallel
      const [analyticsRes, countersRes, queueRes] = await Promise.all([
        api.get(`/branches/${branchId}/analytics`),
        api.get(`/counters?branch=${branchId}`),
        api.get(`/tokens/branch/${branchId}?all=true`),
      ]);
      setAnalytics(analyticsRes.data.data);
      setCounters(countersRes.data.data.counters);
      setQueueTokens(queueRes.data.data.queue || []);
    } catch (err) {
      console.error('Error loading branch dashboard data:', err);
    }
  };


  const loadBIAnalytics = async (branchId) => {
    setAnalyticsLoading(true);
    try {
      let url = `/reports/analytics?timeframe=${analyticsTimeframe}&branchId=${branchId}`;
      if (analyticsServiceId) url += `&serviceId=${analyticsServiceId}`;
      if (analyticsTimeframe === 'custom' && analyticsStartDate && analyticsEndDate) {
        url += `&startDate=${analyticsStartDate}&endDate=${analyticsEndDate}`;
      }

      const res = await api.get(url);
      if (res.data.status === 'success') {
        setAnalyticsData(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching BI analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleExportBIAnalytics = async (format) => {
    if (format === 'print') {
      window.print();
      return;
    }

    try {
      triggerActionMessage(`Generating ${format.toUpperCase()} summary...`);
      let url = `/reports/generate?period=${analyticsTimeframe}&format=${format}&branchId=${selectedBranchId}`;
      if (analyticsTimeframe === 'custom' && analyticsStartDate && analyticsEndDate) {
        url += `&startDate=${analyticsStartDate}&endDate=${analyticsEndDate}`;
      }
      
      const response = await api.get(url, { responseType: 'blob' });

      const blobType = format === 'pdf' 
        ? 'application/pdf' 
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      
      const blob = new Blob([response.data], { type: blobType });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Branch_${analytics.branchCode}_BI_${analyticsTimeframe}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      link.click();
      
      triggerActionMessage(`${format.toUpperCase()} report exported successfully.`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export report.');
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login?role=manager');
  };

  const triggerActionMessage = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 4000);
  };

  // Filter queues
  const waitingQueue = queueTokens.filter(t => t.status === 'waiting');
  const servingQueue = queueTokens.filter(t => t.status === 'calling');
  const completedQueue = queueTokens.filter(t => t.status === 'completed');
  const skippedQueue = queueTokens.filter(t => t.status === 'skipped');
  const heldQueue = queueTokens.filter(t => t.status === 'cancelled');

  const getChartOptions = (dataValues, title, subtitle, labelName) => {
    const maxVal = dataValues.length > 0 ? Math.max(...dataValues) : 0;
    let stepSize = 5;
    if (maxVal > 200) stepSize = 50;
    else if (maxVal > 100) stepSize = 20;
    else if (maxVal > 50) stepSize = 10;
    else if (maxVal > 10) stepSize = 5;
    else stepSize = 2;

    const maxLimit = Math.ceil((maxVal || 5) / stepSize) * stepSize;

    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: maxLimit,
          ticks: {
            stepSize: stepSize,
            color: '#64748b',
            font: { size: 9, family: 'sans-serif' }
          },
          grid: { color: 'rgba(255, 255, 255, 0.03)', drawTicks: false }
        },
        x: {
          ticks: { color: '#64748b', font: { size: 9, family: 'sans-serif' } },
          grid: { display: false }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { 
            color: '#cbd5e1', 
            font: { size: 10, family: 'sans-serif' },
            boxWidth: 10,
            boxHeight: 6,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        title: {
          display: false
        },
        subtitle: {
          display: false
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 8,
          cornerRadius: 6,
          bodyFont: { size: 10 },
          titleFont: { size: 11, weight: 'bold' },
          callbacks: {
            label: function (context) {
              const val = context.raw;
              const total = dataValues.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? Math.round((val / total) * 100) : 0;
              
              let label = ` ${labelName || 'Value'}: ${val}`;
              if (percentage > 0) {
                label += ` (${percentage}%)`;
              }
              if (selectedBranchId) {
                const branchObj = branches.find(b => b._id === selectedBranchId);
                if (branchObj) {
                  label += ` | Branch: ${branchObj.name}`;
                }
              }
              return label;
            }
          }
        }
      }
    };
  };

  const renderKpiCard = (title, value, unit = '', colorClass = 'text-white') => {
    const hasData = value !== undefined && value !== null;
    return (
      <div className="glass-panel p-4 space-y-1.5 relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
        <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-full blur-lg pointer-events-none group-hover:bg-purple-500/10 transition-all" />
        <div className="text-[10px] text-dark-400 font-bold uppercase tracking-wider">{title}</div>
        <div className={`text-xl font-extrabold ${hasData ? colorClass : 'text-dark-500 text-xs font-semibold'}`}>
          {hasData ? `${value}${unit}` : 'No Data'}
        </div>
      </div>
    );
  };

  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return 'No Data';
    if (seconds === 0) return '0 sec';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s} sec`;
    if (s === 0) return `${m} min`;
    return `${m} min ${s} sec`;
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col font-sans">
      {/* Top Navbar */}
      <nav className="bg-dark-900 border-b border-dark-800 px-6 py-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="mgr-logo-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#D946EF" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
            <path d="M3 10 L4 8 L12 3 L20 8 L21 10" stroke="url(#mgr-logo-grad)" />
            <circle cx="12" cy="7" r="1" stroke="url(#mgr-logo-grad)" />
            <rect x="2" y="10" width="20" height="2" rx="0.5" stroke="url(#mgr-logo-grad)" />
            <line x1="4" y1="12" x2="4" y2="20" stroke="url(#mgr-logo-grad)" />
            <line x1="7" y1="12" x2="7" y2="20" stroke="url(#mgr-logo-grad)" />
            <line x1="17" y1="12" x2="17" y2="20" stroke="url(#mgr-logo-grad)" />
            <line x1="20" y1="12" x2="20" y2="20" stroke="url(#mgr-logo-grad)" />
            <circle cx="12" cy="16" r="3" stroke="url(#mgr-logo-grad)" />
            <text x="12" y="16" fontSize="5.5" fontWeight="bold" textAnchor="middle" dominantBaseline="central" fill="url(#mgr-logo-grad)" stroke="none" fontFamily="sans-serif">$</text>
            <line x1="3" y1="20" x2="21" y2="20" stroke="url(#mgr-logo-grad)" />
            <line x1="2" y1="22" x2="22" y2="22" stroke="url(#mgr-logo-grad)" />
          </svg>
          <span className="text-lg font-bold text-white tracking-tight flex items-center">
            Nexa<span className="text-primary-500">Queue</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-dark-300">
            <User className="w-4 h-4 text-purple-400" />
            <span className="font-medium">{user?.name || 'Branch Manager'}</span>
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

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-8 space-y-8 relative">
        {actionMessage && (
          <div className="p-4 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl text-sm flex items-center gap-2 animate-pulse">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Control Header with Tab selectors */}
        <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Manager Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Branch indicator */}
            <div className="glass-panel py-2 px-4 text-sm font-semibold text-dark-100 bg-dark-900 border border-dark-700 rounded-xl flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Branch: {analytics.branchName || 'Loading...'} ({analytics.branchCode || ''})</span>
            </div>
            {/* Branch Status indicator */}
            {analytics.branchStatus && (
              <div className="glass-panel py-2 px-4 text-sm font-semibold text-dark-100 bg-dark-900 border border-dark-700 rounded-xl flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span>Branch Status: <span className="text-purple-400 font-bold">{analytics.branchStatus}</span></span>
              </div>
            )}

            {/* Refresh Button */}
            <button 
              onClick={() => selectedBranchId && loadBranchData(selectedBranchId)}
              className="p-2.5 bg-dark-800 hover:bg-dark-700 text-dark-200 hover:text-white rounded-xl border border-dark-700 transition-colors flex items-center justify-center"
              title="Refresh Dashboard Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-4 border-b border-dark-800 pb-px">
          <button 
            onClick={() => setActiveTab('monitor')}
            className={`pb-3 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'monitor' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-dark-400 hover:text-white'}`}
          >
            <Layers className="w-4 h-4" /> Queue Monitor
          </button>
          <button 
            onClick={() => setActiveTab('staff')}
            className={`pb-3 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'staff' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-dark-400 hover:text-white'}`}
          >
            <Users className="w-4 h-4" /> Counter Staff
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`pb-3 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-dark-400 hover:text-white'}`}
          >
            <BarChart2 className="w-4 h-4" /> Reports & BI Analytics
          </button>
        </div>

        {/* Tab 1: Queue Monitor */}
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            {/* Core Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="glass-panel p-6 space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="text-xs text-dark-400 font-bold uppercase tracking-wider">Total Tickets Today</div>
                <div className="text-3xl font-extrabold text-white">{analytics.totalTickets}</div>
              </div>
              <div className="glass-panel p-6 space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-primary-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="text-xs text-dark-400 font-bold uppercase tracking-wider">Waiting / Serving</div>
                <div className="text-3xl font-extrabold text-purple-400">
                  {analytics.activeWaiting} <span className="text-sm font-medium text-dark-400">waiting</span> / {analytics.callingCount} <span className="text-sm font-medium text-dark-400">serving</span>
                </div>
              </div>
              <div className="glass-panel p-6 space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="text-xs text-dark-400 font-bold uppercase tracking-wider">Avg Waiting Time</div>
                <div className="text-3xl font-extrabold text-amber-400">
                  {analytics.avgWaitTime !== null && analytics.avgWaitTime !== undefined ? `${analytics.avgWaitTime} mins` : 'No Data'}
                </div>
              </div>
              <div className="glass-panel p-6 space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-accent-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="text-xs text-dark-400 font-bold uppercase tracking-wider">Peak Hour</div>
                <div className="text-base font-extrabold text-purple-300 mt-2">{analytics.peakHour || 'No Data'}</div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-purple-500 animate-pulse" /> Live Queue Monitor
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Waiting Queue list */}
              <div className="glass-panel p-5 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-dark-800 pb-2 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  Waiting Queue ({waitingQueue.length})
                </h3>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {waitingQueue.length > 0 ? (
                    waitingQueue.map(token => (
                      <div key={token._id} className="p-3 bg-dark-900/60 border border-dark-800 rounded-xl flex justify-between items-center">
                        <div>
                          <div className="text-sm font-bold text-white">{token.tokenNumber}</div>
                          <div className="text-[10px] text-dark-400 mt-0.5">{token.service?.name}</div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            token.priority === 'premium' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                            token.priority === 'corporate' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            'bg-dark-800 text-dark-300'
                          }`}>
                            {token.priority}
                          </span>
                          <div className="text-[9px] text-dark-500 mt-1 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(token.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-xs text-dark-500">No waiting customers.</div>
                  )}
                </div>
              </div>

              {/* Serving Queue list */}
              <div className="glass-panel p-5 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-dark-800 pb-2 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping"></span>
                  Customers Being Served ({servingQueue.length})
                </h3>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {servingQueue.length > 0 ? (
                    servingQueue.map(token => (
                      <div key={token._id} className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl flex justify-between items-center">
                        <div>
                          <div className="text-sm font-bold text-white">{token.tokenNumber}</div>
                          <div className="text-[10px] text-purple-300 mt-0.5">{token.service?.name}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-purple-400 block">
                            Counter {token.counter?.number || 'N/A'}
                          </span>
                          <div className="text-[9px] text-dark-400 mt-1">
                            Served by: {token.staff?.user?.name || 'Teller'}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-xs text-dark-500">No customers currently being served.</div>
                  )}
                </div>
              </div>

              {/* Outcomes (Completed / Skipped / Held) */}
              <div className="glass-panel p-5 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-dark-800 pb-2 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  Completed & Skipped Outcomes
                </h3>
                
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {/* Completed */}
                  <div>
                    <h4 className="text-xs font-bold text-dark-400 uppercase tracking-wider mb-2">Completed Today ({completedQueue.length})</h4>
                    <div className="space-y-2">
                      {completedQueue.slice(0, 4).map(t => (
                        <div key={t._id} className="p-2 bg-dark-900/40 border border-dark-800/80 rounded-lg flex justify-between items-center text-xs">
                          <span className="font-semibold text-emerald-400">{t.tokenNumber}</span>
                          <span className="text-dark-400 text-[10px]">{t.service?.prefix} - Counter {t.counter?.number}</span>
                        </div>
                      ))}
                      {completedQueue.length === 0 && <p className="text-[11px] text-dark-500 italic">None completed yet.</p>}
                    </div>
                  </div>

                  {/* Skipped */}
                  <div>
                    <h4 className="text-xs font-bold text-dark-400 uppercase tracking-wider mb-2">Skipped Tokens ({skippedQueue.length})</h4>
                    <div className="space-y-2">
                      {skippedQueue.slice(0, 4).map(t => (
                        <div key={t._id} className="p-2 bg-dark-900/40 border border-dark-800/80 rounded-lg flex justify-between items-center text-xs">
                          <span className="font-semibold text-red-400">{t.tokenNumber}</span>
                          <span className="text-[10px] text-dark-500">Skipped at {t.callTime ? new Date(t.callTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                        </div>
                      ))}
                      {skippedQueue.length === 0 && <p className="text-[11px] text-dark-500 italic">No tokens skipped.</p>}
                    </div>
                  </div>

                  {/* Held / Cancelled */}
                  <div>
                    <h4 className="text-xs font-bold text-dark-400 uppercase tracking-wider mb-2">Held / Cancelled ({heldQueue.length})</h4>
                    <div className="space-y-2">
                      {heldQueue.slice(0, 4).map(t => (
                        <div key={t._id} className="p-2 bg-dark-900/40 border border-dark-800/80 rounded-lg flex justify-between items-center text-xs">
                          <span className="font-semibold text-yellow-500">{t.tokenNumber}</span>
                          <span className="text-[10px] text-dark-500">Cancelled</span>
                        </div>
                      ))}
                      {heldQueue.length === 0 && <p className="text-[11px] text-dark-500 italic">No held or cancelled tokens.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Counter Staff */}
        {activeTab === 'staff' && (
          <div className="glass-panel p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" /> Counter Staff & Teller Activity
              </h2>
              <span className="text-xs text-dark-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full text-purple-400 font-semibold">
                Active counters: {analytics.activeCounters}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-dark-800 text-dark-400 font-semibold">
                    <th className="py-3">Staff Name</th>
                    <th className="py-3">Assigned Counter</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Online / Offline</th>
                    <th className="py-3">Current Customer</th>
                    <th className="py-3 text-right">Completed Today</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800/50">
                  {counters.length > 0 ? (
                    counters.map((c) => {
                      const staffName = c.counterStaff?.staffName || c.currentStaff?.user?.name || 'No staff assigned';
                      const isOnline = (c.counterStaff && (c.counterStaff.status === 'active' || c.counterStaff.status === 'Enabled')) || (c.currentStaff && c.currentStaff.status === 'active');
                      
                      return (
                        <tr key={c._id} className="text-dark-200">
                          <td className="py-4 font-bold text-white">{staffName}</td>
                          <td className="py-4 font-medium text-dark-300">Counter {c.number}</td>
                          <td className="py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                              c.status === 'enabled' 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              Counter {c.status}
                            </span>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                               <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-dark-600'}`} />
                              <span className={`font-semibold ${isOnline ? 'text-emerald-400' : 'text-dark-400'}`}>
                                {isOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 font-bold text-purple-400">
                            {c.currentToken?.tokenNumber || 'Idle'}
                          </td>
                          <td className="py-4 text-right font-bold text-white">
                            {c.completedCountToday || 0}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-dark-400">
                        No teller counters registered for this branch.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Reports & BI Analytics */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Analytics Filters toolbar */}
            <div className="glass-panel p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Timeframe Selector */}
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Timeframe</label>
                  <select
                    value={analyticsTimeframe}
                    onChange={(e) => setAnalyticsTimeframe(e.target.value)}
                    className="glass-input w-full bg-dark-900 text-sm"
                  >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="thisMonth">This Month</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>

                {/* Custom Date Inputs */}
                {analyticsTimeframe === 'custom' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">Start Date</label>
                      <input
                        type="date"
                        value={analyticsStartDate}
                        onChange={(e) => setAnalyticsStartDate(e.target.value)}
                        className="glass-input w-full text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">End Date</label>
                      <input
                        type="date"
                        value={analyticsEndDate}
                        onChange={(e) => setAnalyticsEndDate(e.target.value)}
                        className="glass-input w-full text-sm"
                      />
                    </div>
                  </>
                )}

                {/* Service Selector */}
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Filter by Service</label>
                  <select
                    value={analyticsServiceId}
                    onChange={(e) => setAnalyticsServiceId(e.target.value)}
                    className="glass-input w-full bg-dark-900 text-sm"
                  >
                    <option value="">All Services</option>
                    {services.map(s => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action buttons (Export / Print) */}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-dark-800">
                <button
                  onClick={() => handleExportBIAnalytics('pdf')}
                  className="py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF Summary
                </button>
                <button
                  onClick={() => handleExportBIAnalytics('excel')}
                  className="py-2 px-4 bg-dark-800 hover:bg-dark-700 text-purple-400 border border-dark-700 hover:text-purple-300 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                >
                  <Clipboard className="w-3.5 h-3.5" /> Export Excel Spreadsheet
                </button>
                <button
                  onClick={() => handleExportBIAnalytics('print')}
                  className="py-2 px-4 bg-dark-800 hover:bg-dark-700 text-dark-200 hover:text-white border border-dark-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Print Analytics
                </button>
              </div>
            </div>

            {analyticsLoading ? (
              <div className="glass-panel p-12 flex flex-col justify-center items-center gap-3">
                <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                <div className="text-dark-400 text-xs font-semibold">Loading BI engine models...</div>
              </div>
            ) : (
              <>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {renderKpiCard(
                    analyticsTimeframe === 'today' ? 'Served Today' :
                    analyticsTimeframe === 'yesterday' ? 'Served Yesterday' :
                    analyticsTimeframe === '7days' ? 'Served this Week' :
                    analyticsTimeframe === '30days' ? 'Served (Last 30 Days)' :
                    analyticsTimeframe === 'thisMonth' ? 'Served this Month' : 'Total Served',
                    analyticsData.managerKpis?.customersServedToday
                  )}
                  {renderKpiCard("Waiting Customers", analyticsData.managerKpis?.waitingCustomers, "", "text-amber-400")}
                  {renderKpiCard("Serving Customers", analyticsData.managerKpis?.customersBeingServed, "", "text-purple-400")}
                  {renderKpiCard("Active Counters", analyticsData.managerKpis?.activeCounters, "", "text-emerald-400")}
                  {renderKpiCard("Avg Wait Time", analyticsData.managerKpis?.avgWaitingTime, " mins", 
                    (analyticsData.managerKpis?.avgWaitingTime < 5 ? "text-emerald-400" : 
                     analyticsData.managerKpis?.avgWaitingTime <= 10 ? "text-yellow-400" : "text-red-400")
                  )}
                  {renderKpiCard("Avg Service Time", analyticsData.managerKpis?.avgServiceTime, " mins")}
                  {renderKpiCard("Busiest Service", analyticsData.managerKpis?.mostRequestedService, "", "text-purple-300")}
                  {renderKpiCard("Peak Banking Hour", analyticsData.managerKpis?.peakHour)}
                  {renderKpiCard("Counter Utilization", analyticsData.managerKpis?.counterUtilization, "%", "text-emerald-400")}
                </div>

                {/* Top Performers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top Counter */}
                  <div className="glass-panel p-5 border-purple-500/10 bg-purple-500/[0.02] flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] text-dark-400 font-bold uppercase">Top Counter</div>
                      <div className="text-sm font-bold text-white mt-0.5">{analyticsData.topPerformers?.counter}</div>
                    </div>
                  </div>

                  {/* Top Teller (Completed) Card */}
                  <div className="glass-panel p-5 border-blue-500/10 bg-blue-500/[0.02] flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0 mt-0.5">
                      <Award className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-dark-400 font-bold uppercase">Top Teller (Completed)</div>
                      {analyticsData.topTeller ? (
                        <div className="mt-1">
                          <div className="text-sm font-bold text-white leading-tight">{analyticsData.topTeller.name}</div>
                          <div className="text-[10px] text-purple-400 font-semibold">{analyticsData.topTeller.counterNumber}</div>
                          <div className="text-[10px] text-dark-400">{analyticsData.topTeller.branchName}</div>
                          <div className="text-[11px] text-emerald-400 font-bold mt-0.5">
                            {analyticsData.topTeller.count} Customers Completed
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-dark-500 font-bold italic mt-1">
                          No completed customer data available
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Daily Trend Chart */}
                  <div className="glass-panel p-6 space-y-2">
                    <h4 className="text-sm font-bold text-white">Daily Queue Trend</h4>
                    <p className="text-[11px] text-dark-400">Shows how many customer tickets were issued and completed each day.</p>
                    <div className="h-64">
                      {analyticsData.charts?.dailyTrend && analyticsData.charts.dailyTrend.some(d => d.issued > 0 || d.completed > 0) ? (
                        <Line
                          data={{
                            labels: analyticsData.charts.dailyTrend.map(d => d.date),
                            datasets: [
                              {
                                label: 'Tickets Issued',
                                data: analyticsData.charts.dailyTrend.map(d => d.issued),
                                borderColor: '#8b5cf6',
                                backgroundColor: 'rgba(139, 92, 246, 0.03)',
                                tension: 0.35,
                                fill: true,
                                pointRadius: 2,
                                pointHoverRadius: 5,
                                pointBackgroundColor: '#ffffff'
                              },
                              {
                                label: 'Tickets Completed',
                                data: analyticsData.charts.dailyTrend.map(d => d.completed),
                                borderColor: '#10b981',
                                backgroundColor: 'rgba(16, 185, 129, 0.03)',
                                tension: 0.35,
                                fill: true,
                                pointRadius: 2,
                                pointHoverRadius: 5,
                                pointBackgroundColor: '#ffffff'
                              }
                            ]
                          }}
                          options={getChartOptions(
                            [
                              ...analyticsData.charts.dailyTrend.map(d => d.issued),
                              ...analyticsData.charts.dailyTrend.map(d => d.completed)
                            ],
                            "Daily Queue Traffic",
                            "Traffic flow per day",
                            "Tickets"
                          )}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-dark-900/40 rounded-xl border border-dark-850/50 text-center p-6">
                          <span className="text-3xl mb-1.5">📊</span>
                          <h5 className="text-xs font-bold text-white mb-0.5">No analytics data available</h5>
                          <p className="text-[10px] text-dark-400 max-w-[200px] leading-relaxed">
                            Analytics will appear automatically once customers start using the system.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Peak Hour Chart */}
                  <div className="glass-panel p-6 space-y-2">
                    <h4 className="text-sm font-bold text-white">Peak Hour Analysis</h4>
                    <p className="text-[11px] text-dark-400">Displays the busiest banking hours of operation based on ticket creation.</p>
                    <div className="h-64">
                      {analyticsData.charts?.hourlyCounts && analyticsData.charts.hourlyCounts.some(h => h.issued > 0 || h.completed > 0) ? (
                        <Bar
                          data={{
                            labels: analyticsData.charts.hourlyCounts.map(h => h.hour),
                            datasets: [
                              {
                                label: 'Customers Entered',
                                data: analyticsData.charts.hourlyCounts.map(h => h.issued),
                                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                borderColor: '#8b5cf6',
                                borderWidth: 1.5,
                                borderRadius: 4
                              },
                              {
                                label: 'Completed Services',
                                data: analyticsData.charts.hourlyCounts.map(h => h.completed),
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                borderColor: '#10b981',
                                borderWidth: 1.5,
                                borderRadius: 4
                              }
                            ]
                          }}
                          options={getChartOptions(
                            [
                              ...analyticsData.charts.hourlyCounts.map(h => h.issued),
                              ...analyticsData.charts.hourlyCounts.map(h => h.completed)
                            ],
                            "Peak Banking Hours",
                            "Transaction load across business hours",
                            "Customers"
                          )}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-dark-900/40 rounded-xl border border-dark-850/50 text-center p-6">
                          <span className="text-3xl mb-1.5">📊</span>
                          <h5 className="text-xs font-bold text-white mb-0.5">No analytics data available</h5>
                          <p className="text-[10px] text-dark-400 max-w-[200px] leading-relaxed">
                            Analytics will appear automatically once customers start using the system.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Counter performance bar chart */}
                  <div className="glass-panel p-6 space-y-2 lg:col-span-2">
                    <h4 className="text-sm font-bold text-white">Counter Performance Comparison</h4>
                    <p className="text-[11px] text-dark-400">Compare completed customer workload counts across active banking counters.</p>
                    <div className="h-64">
                      {analyticsData.counterRankings && analyticsData.counterRankings.some(c => c.servedCount > 0) ? (
                        <Bar
                          data={{
                            labels: analyticsData.counterRankings.map(c => `Counter ${c.counterNumber} (${c.staffName})`),
                            datasets: [
                              {
                                label: 'Served Customers',
                                data: analyticsData.counterRankings.map(c => c.servedCount),
                                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                borderColor: '#8b5cf6',
                                borderWidth: 1.5,
                                borderRadius: 5
                              }
                            ]
                          }}
                          options={getChartOptions(
                            analyticsData.counterRankings.map(c => c.servedCount),
                            "Counter Completed Workload",
                            "Total customers served per counter today",
                            "Completed"
                          )}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-dark-900/40 rounded-xl border border-dark-850/50 text-center p-6">
                          <span className="text-3xl mb-1.5">📊</span>
                          <h5 className="text-xs font-bold text-white mb-0.5">No analytics data available</h5>
                          <p className="text-[10px] text-dark-400 max-w-[200px] leading-relaxed">
                            Analytics will appear automatically once customers start using the system.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Counter Performance rankings table */}
                <div className="glass-panel p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-dark-800 pb-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-purple-400" /> Counter Operational Rankings
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-dark-400 font-bold uppercase tracking-wider border-b border-dark-800 text-[9px]">
                          <th className="pb-3 pl-4">Rank</th>
                          <th className="pb-3">Counter</th>
                          <th className="pb-3">Teller Officer</th>
                          <th className="pb-3 text-center">Customers Served</th>
                          <th className="pb-3 text-center">Average Service Duration</th>
                          <th className="pb-3 text-center">Teller Rating</th>
                          <th className="pb-3 pr-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-800/40">
                        {analyticsData.counterRankings && analyticsData.counterRankings.length > 0 ? (
                          analyticsData.counterRankings.map((c, idx) => {
                            const rank = idx + 1;
                            const ratingValue = c.rating || 5.0;
                            const statusOnline = c.status !== 'disabled';
                            
                            return (
                              <tr key={c.id} className="text-dark-200 hover:bg-purple-500/[0.02] transition-all duration-200 group">
                                <td className="py-3.5 pl-4">
                                  {rank === 1 ? (
                                    <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-extrabold">#1 Gold</span>
                                  ) : rank === 2 ? (
                                    <span className="bg-slate-400/10 text-slate-300 border border-slate-400/20 px-2 py-0.5 rounded text-[10px] font-extrabold">#2 Silver</span>
                                  ) : rank === 3 ? (
                                    <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[10px] font-extrabold">#3 Bronze</span>
                                  ) : (
                                    <span className="text-dark-400 font-bold pl-2">#{rank}</span>
                                  )}
                                </td>
                                <td className="py-3.5 font-bold text-white">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/20 transition-all">
                                      <Layers className="w-3 h-3" />
                                    </div>
                                    <span>Counter {c.counterNumber}</span>
                                  </div>
                                </td>
                                <td className="py-3.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-dark-850 border border-dark-800 flex items-center justify-center text-dark-300 text-[10px] font-bold">
                                      {c.staffName ? c.staffName.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <span className="font-semibold text-dark-100">{c.staffName || 'Unassigned'}</span>
                                  </div>
                                </td>
                                <td className="py-3.5 text-center font-extrabold text-white text-sm">
                                  {c.servedCount}
                                </td>
                                <td className="py-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5 text-dark-300">
                                    <Clock className="w-3 h-3 text-purple-500/80" />
                                    <span>{formatDuration(c.avgServiceTime)}</span>
                                  </div>
                                </td>
                                <td className="py-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className="text-amber-400 font-bold">★ {ratingValue.toFixed(1)}</span>
                                    <div className="flex text-amber-500/60 text-[9px] scale-90">
                                      {Array.from({ length: Math.round(ratingValue) }).map((_, i) => (
                                        <span key={i}>★</span>
                                      ))}
                                      {Array.from({ length: 5 - Math.round(ratingValue) }).map((_, i) => (
                                        <span key={i} className="text-dark-700">★</span>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 pr-4 text-center">
                                  {statusOnline ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">
                                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                                      Active
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-dark-800 text-dark-400 border border-dark-700 text-[9px] font-bold">
                                      <span className="w-1 h-1 rounded-full bg-dark-500"></span>
                                      Offline
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="7" className="py-8 text-center text-dark-400 font-semibold">
                              No rankings stats to display.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Customer Insights Grid */}
                <div className="glass-panel p-6 space-y-4">
                  <h3 className="text-base font-bold text-white">Lobby Customer Insights</h3>
                  {analyticsData.customerInsights && (
                    analyticsData.customerInsights.mostRequested ||
                    analyticsData.customerInsights.leastBusiestService ||
                    analyticsData.customerInsights.avgVisitDurationSeconds ||
                    analyticsData.customerInsights.peakHour
                  ) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                      <div className="space-y-1 p-3 rounded-lg bg-dark-900/30 border border-dark-800/40">
                        <div className="text-[10px] text-dark-400 font-bold uppercase tracking-wider">Busiest Service</div>
                        <div className="text-sm font-bold text-purple-400 mt-1">
                          {analyticsData.customerInsights.mostRequested || 'No data available'}
                        </div>
                      </div>
                      <div className="space-y-1 p-3 rounded-lg bg-dark-900/30 border border-dark-800/40">
                        <div className="text-[10px] text-dark-400 font-bold uppercase tracking-wider">Least Busiest Service</div>
                        {analyticsData.customerInsights.leastBusiestService ? (
                          <>
                            <div className="text-sm font-bold text-white mt-1">
                              {analyticsData.customerInsights.leastBusiestService.name}
                            </div>
                            <div className="text-[11px] text-dark-400 font-medium">
                              {analyticsData.customerInsights.leastBusiestService.count} Customers
                            </div>
                          </>
                        ) : (
                          <div className="text-sm font-bold text-dark-500 mt-1">No data available</div>
                        )}
                      </div>
                      <div className="space-y-1 p-3 rounded-lg bg-dark-900/30 border border-dark-800/40">
                        <div className="text-[10px] text-dark-400 font-bold uppercase tracking-wider">Average Visit Duration</div>
                        {analyticsData.customerInsights.avgVisitDurationSeconds !== null && 
                         analyticsData.customerInsights.avgVisitDurationSeconds !== undefined ? (
                          <div className="text-sm font-bold text-white mt-1">
                            {Math.floor(analyticsData.customerInsights.avgVisitDurationSeconds / 60)} min {analyticsData.customerInsights.avgVisitDurationSeconds % 60} sec
                          </div>
                        ) : (
                          <div className="text-sm font-bold text-dark-500 mt-1">No data available</div>
                        )}
                      </div>
                      <div className="space-y-1 p-3 rounded-lg bg-dark-900/30 border border-dark-800/40">
                        <div className="text-[10px] text-dark-400 font-bold uppercase tracking-wider">Busiest Hour</div>
                        {analyticsData.customerInsights.peakHour ? (
                          <>
                            <div className="text-sm font-bold text-white mt-1">
                              {analyticsData.customerInsights.peakHour.range}
                            </div>
                            <div className="text-[11px] text-dark-400 font-medium">
                              {analyticsData.customerInsights.peakHour.count} Customers
                            </div>
                          </>
                        ) : (
                          <div className="text-sm font-bold text-dark-500 mt-1">No data available</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 bg-dark-900/20 rounded-lg text-center p-4">
                      <span className="text-2xl mb-1">📊</span>
                      <h5 className="text-xs font-bold text-white mb-0.5">No analytics data available</h5>
                      <p className="text-[10px] text-dark-400 max-w-[220px] leading-relaxed">
                        Lobby insights will appear automatically once customers start using the system.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ManagerDashboard;
