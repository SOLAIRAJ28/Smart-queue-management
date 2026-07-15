import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../redux/authSlice';
import {
  LogOut, User, Settings, GitCommit, FileText,
  MapPin, Clipboard, Layers, Plus, Power, Edit3, Pencil, X, CheckCircle,
  Lock, Shield, ShieldAlert, AlertTriangle, RefreshCw, QrCode,
  Eye, EyeOff, BarChart2, Users, Clock, Radio, Sparkles, Download, Award, Sun, Moon, Trash2
} from 'lucide-react';
import api from '../services/api';
import QRCode from 'qrcode';
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

const AdminDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Lists state
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [counters, setCounters] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('branches');

  // Modal / Form state
  const [showModal, setShowModal] = useState(null); // 'branch', 'service', 'counter'
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [toasts, setToasts] = useState([]);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [selectedCounterForStaff, setSelectedCounterForStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({ staffName: '', email: '', password: '', confirmPassword: '', status: 'Enabled' });
  const [staffModalErrors, setStaffModalErrors] = useState({});
  const [isEditingStaff, setIsEditingStaff] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [currentStaffData, setCurrentStaffData] = useState(null);
  const [originalStaffStatus, setOriginalStaffStatus] = useState('Enabled');
  const [staffModalLoading, setStaffModalLoading] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [showStaffConfirmPassword, setShowStaffConfirmPassword] = useState(false);
  const [showConfirmStaffStatus, setShowConfirmStaffStatus] = useState(false);

  // Manager Modal states
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [selectedBranchForManager, setSelectedBranchForManager] = useState(null);
  const [managerForm, setManagerForm] = useState({ managerName: '', email: '', password: '', confirmPassword: '', phone: '', status: 'Enabled' });
  const [managerModalErrors, setManagerModalErrors] = useState({});
  const [isEditingManager, setIsEditingManager] = useState(false);
  const [editingManagerId, setEditingManagerId] = useState(null);
  const [currentManagerData, setCurrentManagerData] = useState(null);
  const [managerModalLoading, setManagerModalLoading] = useState(false);
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  const [showManagerConfirmPassword, setShowManagerConfirmPassword] = useState(false);
  const [staffToToggle, setStaffToToggle] = useState(null);
  const [togglingStaffId, setTogglingStaffId] = useState(null);
  const [confirmDisableServiceId, setConfirmDisableServiceId] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [showResetPasswordVisible, setShowResetPasswordVisible] = useState(false);
  const [showDeleteStaffConfirm, setShowDeleteStaffConfirm] = useState(false);

  // Counter branch filter tab
  const [counterBranchFilter, setCounterBranchFilter] = useState('all');
  const [counterToDelete, setCounterToDelete] = useState(null);

  // QR Check-in System state
  const [selectedQRBranch, setSelectedQRBranch] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  // Cryptographic Ledger Verification state
  const [verifyingLedger, setVerifyingLedger] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  // BI Analytics Dashboard state
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState('today');
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');
  const [analyticsBranchId, setAnalyticsBranchId] = useState('');
  const [analyticsCounterId, setAnalyticsCounterId] = useState('');
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

  // Form inputs
  const [branchForm, setBranchForm] = useState({ name: '', code: '', address: '', contact: '', openHour: '09:00', closeHour: '17:00' });
  const [serviceForm, setServiceForm] = useState({ name: '', code: '', description: '', avgServingTime: 15, prefix: '' });
  const [counterForm, setCounterForm] = useState({ number: '', branch: '', currentService: '' });

  useEffect(() => {
    loadAllData();
  }, []);

  const [regionalStats, setRegionalStats] = useState([]);

  const socketRef = useRef(null);

  const loadBIAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      let url = `/reports/analytics?timeframe=${analyticsTimeframe}`;
      if (analyticsBranchId) url += `&branchId=${analyticsBranchId}`;
      if (analyticsCounterId) url += `&counterId=${analyticsCounterId}`;
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
      showToast('Failed to load analytics data.', 'error');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleExportBIAnalytics = async (format) => {
    if (format === 'print') {
      window.print();
      return;
    }

    if (!analyticsBranchId) {
      showToast('Please select a Branch Office before exporting.', 'error');
      return;
    }

    try {
      showToast(`Generating ${format.toUpperCase()} report...`, 'info');
      let url = `/reports/generate?period=${analyticsTimeframe}&format=${format}`;
      if (analyticsBranchId) url += `&branchId=${analyticsBranchId}`;
      
      const response = await api.get(url, { responseType: 'blob' });

      const blobType = format === 'pdf' 
        ? 'application/pdf' 
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      
      const blob = new Blob([response.data], { type: blobType });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `ApexBank_BI_${analyticsTimeframe}_${new Date().toISOString().substring(0,10)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      link.click();
      
      showToast(`${format.toUpperCase()} report exported successfully.`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Failed to export report. Please try again.', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    } else if (activeTab === 'regional') {
      loadBIAnalytics();
    }
  }, [
    activeTab,
    analyticsTimeframe,
    analyticsStartDate,
    analyticsEndDate,
    analyticsBranchId,
    analyticsCounterId,
    analyticsServiceId
  ]);

  useEffect(() => {
    if (activeTab !== 'regional') {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    socketRef.current = io(socketUrl, { transports: ['websocket'] });

    socketRef.current.on('connect', () => {
      if (analyticsBranchId) {
        socketRef.current.emit('join_branch', analyticsBranchId);
      }
    });

    socketRef.current.on('queue_updated', () => {
      loadBIAnalytics();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [activeTab, analyticsBranchId]);

  const loadAllData = async () => {
    try {
      const [branchesRes, servicesRes, countersRes] = await Promise.all([
        api.get('/branches'),
        api.get('/services'),
        api.get('/counters'),
      ]);
      setBranches(branchesRes.data.data.branches);
      setServices(servicesRes.data.data.services);
      setCounters(countersRes.data.data.counters);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await api.get('/audit-logs');
      setAuditLogs(res.data.data.logs);
      setVerificationResult(null);
    } catch (err) {
      console.error('Error loading audit ledger:', err);
    }
  };

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => {
      const updated = [...prev, { id, message, type }];
      if (updated.length > 2) {
        return updated.slice(updated.length - 2);
      }
      return updated;
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2000);
  };

  const verifyLedgerChaining = async () => {
    setVerifyingLedger(true);
    setVerificationResult(null);
    try {
      const res = await api.get('/audit-logs/verify');
      setVerificationResult(res.data.data);
      showToast('Ledger verification completed.', 'success');
    } catch (err) {
      showToast('Ledger validation request failed.', 'error');
    } finally {
      setVerifyingLedger(false);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const triggerSuccess = (msg) => {
    showToast(msg, 'success');
  };

  // Branch CRUD actions
  const handleBranchSubmit = async (e) => {
    e.preventDefault();
    try {
      setErrorMessage('');
      const payload = {
        name: branchForm.name,
        code: branchForm.code.toUpperCase(),
        address: branchForm.address,
        contact: branchForm.contact,
        workingHours: { open: branchForm.openHour, close: branchForm.closeHour }
      };

      const res = await api.post('/branches', payload);
      if (res.data.status === 'success') {
        setShowModal(null);
        showToast(`Branch ${payload.name} created successfully!`, 'success');
        setBranchForm({ name: '', code: '', address: '', contact: '', openHour: '09:00', closeHour: '17:00' });
        loadAllData();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to create branch.');
    }
  };

  const handleToggleBranch = async (id) => {
    try {
      const res = await api.patch(`/branches/${id}/toggle`);
      if (res.data.status === 'success') {
        showToast('Branch status updated.', 'success');
        loadAllData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update branch status.', 'error');
    }
  };

  // Service CRUD actions
  const handleServiceSubmit = async (e) => {
    e.preventDefault();
    try {
      setErrorMessage('');
      const res = await api.post('/services', serviceForm);
      if (res.data.status === 'success') {
        setShowModal(null);
        showToast(`Service ${serviceForm.name} created!`, 'success');
        setServiceForm({ name: '', code: '', description: '', avgServingTime: 15, prefix: '' });
        loadAllData();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to create service.');
    }
  };

  const handleToggleService = async (service) => {
    if (service.isActive) {
      setConfirmDisableServiceId(service._id);
      return;
    }
    proceedToggleService(service._id, service.isActive);
  };

  const proceedToggleService = async (id, currentIsActive) => {
    setConfirmDisableServiceId(null);

    // Optimistic UI update
    const previousServices = [...services];
    setServices(prev => prev.map(s => s._id === id ? { ...s, isActive: !s.isActive } : s));

    try {
      const res = await api.patch(`/admin/services/${id}/status`);
      if (res.data.status === 'success') {
        showToast('Service status updated successfully.', 'success');
        loadAllData();
      }
    } catch (err) {
      setServices(previousServices);
      const reason = err.response?.data?.message || err.message || 'Unknown error';
      showToast(`Unable to update service status. Reason: ${reason}`, 'error');
    }
  };

  // Counter CRUD actions
  const handleCounterSubmit = async (e) => {
    e.preventDefault();
    try {
      setErrorMessage('');
      const res = await api.post('/counters', counterForm);
      if (res.data.status === 'success') {
        setShowModal(null);
        showToast(`Counter #${counterForm.number} created successfully!`, 'success');
        setCounterForm({ number: '', branch: '', currentService: '' });
        loadAllData();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to create counter.');
    }
  };

  const handleToggleCounter = async (id) => {
    try {
      const res = await api.patch(`/counters/${id}/toggle`);
      if (res.data.status === 'success') {
        showToast('Counter status updated.', 'success');
        loadAllData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update counter status.', 'error');
    }
  };

  const handleDeleteCounter = async (id) => {
    try {
      const res = await api.delete(`/counters/${id}`);
      if (res.data.status === 'success') {
        showToast('Counter deleted successfully.', 'success');
        setCounterToDelete(null);
        loadAllData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete counter.', 'error');
      setCounterToDelete(null);
    }
  };

  const handleManageStaff = async (counter) => {
    setSelectedCounterForStaff(counter);
    setStaffModalErrors({});
    setStaffForm({
      staffName: '',
      email: '',
      password: '',
      confirmPassword: '',
      status: 'Enabled',
    });
    setIsEditingStaff(false);
    setEditingStaffId(null);
    setCurrentStaffData(null);
    setShowStaffPassword(false);
    setShowStaffConfirmPassword(false);
    setStaffModalLoading(true);
    setShowStaffModal(true);

    try {
      const res = await api.get(`/admin/counter-staff/${counter._id}`);
      if (res.data.status === 'success' && res.data.data) {
        const staff = res.data.data;
        setCurrentStaffData(staff);
        setStaffForm({
          staffName: staff.staffName,
          email: staff.email,
          password: '',
          confirmPassword: '',
          status: staff.status || 'Enabled',
        });
        setIsEditingStaff(true);
        setEditingStaffId(staff._id);
        setOriginalStaffStatus(staff.status || 'Enabled');
      }
    } catch (err) {
      console.error('Error fetching counter staff details:', err);
      showToast(err.response?.data?.message || 'Error loading staff details', 'error');
    } finally {
      setStaffModalLoading(false);
    }
  };

  const validateStaffForm = () => {
    const errors = {};
    if (!staffForm.staffName.trim()) {
      errors.staffName = 'Staff Full Name is required';
    }
    if (!staffForm.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(staffForm.email)) {
      errors.email = 'Please provide a valid email format';
    }

    if (!isEditingStaff) {
      if (!staffForm.password) {
        errors.password = 'Password is required';
      } else if (staffForm.password.length < 8) {
        errors.password = 'Password must be at least 8 characters';
      }
      if (staffForm.password !== staffForm.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    } else {
      if (staffForm.password) {
        if (staffForm.password.length < 8) {
          errors.password = 'Password must be at least 8 characters';
        }
        if (staffForm.password !== staffForm.confirmPassword) {
          errors.confirmPassword = 'Passwords do not match';
        }
      }
    }

    setStaffModalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStaffSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateStaffForm()) return;
    submitStaffAPI();
  };

  const submitStaffAPI = async () => {
    setStaffModalLoading(true);
    try {
      if (!isEditingStaff) {
        const res = await api.post('/admin/counter-staff', {
          counterId: selectedCounterForStaff._id,
          branchId: selectedCounterForStaff.branch?._id || selectedCounterForStaff.branch,
          staffName: staffForm.staffName,
          email: staffForm.email,
          password: staffForm.password,
          status: 'Enabled',
        });

        if (res.data.status === 'success') {
          showToast('Counter Staff created successfully.', 'success');
          setShowStaffModal(false);
          loadAllData();
        } else {
          showToast(res.data.message || 'Failed to create Counter Staff.', 'error');
        }
      } else {
        const updatePayload = {
          staffName: staffForm.staffName,
          email: staffForm.email,
        };
        if (staffForm.password) {
          updatePayload.password = staffForm.password;
        }

        const res = await api.put(`/admin/counter-staff/${editingStaffId}`, updatePayload);

        if (res.data.status === 'success') {
          showToast('Staff details updated successfully.', 'success');
          setShowStaffModal(false);
          loadAllData();
        } else {
          showToast(res.data.message || 'Failed to update Counter Staff.', 'error');
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'An error occurred';
      showToast(errMsg, 'error');
    } finally {
      setStaffModalLoading(false);
    }
  };

  const handleToggleStaffStatus = (staff) => {
    setStaffToToggle(staff);
    setShowConfirmStaffStatus(true);
  };

  const confirmToggleStaffStatus = async () => {
    if (!staffToToggle) return;
    const staffId = staffToToggle._id;
    const isCurrentlyEnabled = staffToToggle.status === 'active' || staffToToggle.status === 'Enabled';
    
    setShowConfirmStaffStatus(false);
    setTogglingStaffId(staffId);
    
    try {
      const res = await api.patch(`/admin/counter-staff/${staffId}/status`);
      if (res.data.status === 'success') {
        showToast(
          isCurrentlyEnabled 
            ? "Counter Staff account disabled successfully." 
            : "Counter Staff account enabled successfully.", 
          "success"
        );
        await loadAllData();
      } else {
        showToast(res.data.message || "Failed to update status", "error");
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || "Failed to update status", "error");
    } finally {
      setTogglingStaffId(null);
      setStaffToToggle(null);
    }
  };

  const handleDeleteStaff = async () => {
    setStaffModalLoading(true);
    try {
      const res = await api.delete(`/admin/counter-staff/${editingStaffId}`);
      if (res.data.status === 'success') {
        showToast('Counter Staff deleted successfully.', 'success');
        setShowDeleteStaffConfirm(false);
        setShowStaffModal(false);
        loadAllData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete staff.', 'error');
    } finally {
      setStaffModalLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!resetPasswordVal || resetPasswordVal.length < 8) {
      showToast('Password must be at least 8 characters long', 'error');
      return;
    }
    setStaffModalLoading(true);
    try {
      const res = await api.patch(`/admin/counter-staff/${editingStaffId}/password`, {
        password: resetPasswordVal,
      });
      if (res.data.status === 'success') {
        showToast('Password reset successfully.', 'success');
        setShowResetModal(false);
        loadAllData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reset password.', 'error');
    } finally {
      setStaffModalLoading(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setResetPasswordVal(pass);
  };

  const handleManageManager = async (branch) => {
    setSelectedBranchForManager(branch);
    setIsEditingManager(false);
    setEditingManagerId(null);
    setCurrentManagerData(null);
    setShowManagerPassword(false);
    setShowManagerConfirmPassword(false);
    setManagerForm({
      managerName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      status: 'Enabled',
    });
    setManagerModalLoading(true);
    setManagerModalErrors({});
    setShowManagerModal(true);

    try {
      const res = await api.get(`/branch-managers/branch/${branch._id}`);
      if (res.data.status === 'success' && res.data.data) {
        const manager = res.data.data;
        setCurrentManagerData(manager);
        setManagerForm({
          managerName: manager.managerName,
          email: manager.email,
          password: '',
          confirmPassword: '',
          phone: manager.phone,
          status: manager.status || 'Enabled',
        });
        setIsEditingManager(true);
        setEditingManagerId(manager._id);
      }
    } catch (err) {
      console.error('Error fetching manager details:', err);
      showToast(err.response?.data?.message || 'Error loading manager details', 'error');
    } finally {
      setManagerModalLoading(false);
    }
  };

  const validateManagerForm = () => {
    const errors = {};
    if (!managerForm.managerName.trim()) {
      errors.managerName = 'Manager Full Name is required';
    }
    if (!managerForm.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(managerForm.email)) {
      errors.email = 'Please provide a valid email format';
    }
    if (!managerForm.phone.trim()) {
      errors.phone = 'Phone number is required';
    }

    if (!isEditingManager) {
      if (!managerForm.password) {
        errors.password = 'Password is required';
      } else if (managerForm.password.length < 8) {
        errors.password = 'Password must be at least 8 characters';
      }
      if (managerForm.password !== managerForm.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    } else {
      if (managerForm.password) {
        if (managerForm.password.length < 8) {
          errors.password = 'Password must be at least 8 characters';
        }
        if (managerForm.password !== managerForm.confirmPassword) {
          errors.confirmPassword = 'Passwords do not match';
        }
      }
    }

    setManagerModalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleManagerSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateManagerForm()) return;
    submitManagerAPI();
  };

  const submitManagerAPI = async () => {
    setManagerModalLoading(true);
    try {
      if (!isEditingManager) {
        const res = await api.post('/branch-managers', {
          branchId: selectedBranchForManager._id,
          managerName: managerForm.managerName,
          email: managerForm.email,
          password: managerForm.password,
          confirmPassword: managerForm.confirmPassword,
          phone: managerForm.phone,
          status: managerForm.status,
        });

        if (res.data.status === 'success') {
          showToast('Branch Manager created successfully.', 'success');
          setShowManagerModal(false);
          loadAllData();
        } else {
          showToast(res.data.message || 'Failed to create Branch Manager.', 'error');
        }
      } else {
        const updatePayload = {
          managerName: managerForm.managerName,
          email: managerForm.email,
          phone: managerForm.phone,
          status: managerForm.status,
        };
        if (managerForm.password) {
          updatePayload.password = managerForm.password;
          updatePayload.confirmPassword = managerForm.confirmPassword;
        }

        const res = await api.put(`/branch-managers/${editingManagerId}`, updatePayload);

        if (res.data.status === 'success') {
          showToast('Manager details updated successfully.', 'success');
          setShowManagerModal(false);
          loadAllData();
        } else {
          showToast(res.data.message || 'Failed to update Manager details.', 'error');
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'An error occurred';
      showToast(errMsg, 'error');
    } finally {
      setManagerModalLoading(false);
    }
  };

  useEffect(() => {
    if (selectedQRBranch) {
      QRCode.toDataURL(getQRUrl(selectedQRBranch), { width: 256, margin: 2 }, (err, url) => {
        if (err) console.error(err);
        else setQrCodeDataUrl(url);
      });
    } else {
      setQrCodeDataUrl('');
    }
  }, [selectedQRBranch]);

  // Get QR Check-in target URL
  const getQRUrl = (branch) => {
    const base = import.meta.env.VITE_CLIENT_URL || window.location.origin;
    return `${base}/customer?branchId=${branch._id}`;
  };

  const downloadQR = (branch) => {
    if (!qrCodeDataUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = `${branch.name.replace(/\s+/g, '_')}_QR.png`;
    link.click();
  };

  const printQR = (branch) => {
    if (!qrCodeDataUrl) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>Print QR Code - ${branch.name}</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center; }
            img { width: 300px; height: 300px; margin-bottom: 20px; }
            h1 { margin: 0; font-size: 24px; }
            p { font-size: 14px; color: #555; margin-top: 5px; }
          </style>
        </head>
        <body>
          <img src="${qrCodeDataUrl}" />
          <h1>${branch.name}</h1>
          <p>Branch Code: ${branch.code}</p>
          <p>${getQRUrl(branch)}</p>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

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
              if (analyticsBranchId) {
                const branchObj = branches.find(b => b._id === analyticsBranchId);
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
          {hasData ? `${value}${unit}` : 'No data available'}
        </div>
      </div>
    );
  };

  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return 'No completed services';
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
              <linearGradient id="adm-logo-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#D946EF" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
            <path d="M3 10 L4 8 L12 3 L20 8 L21 10" stroke="url(#adm-logo-grad)" />
            <circle cx="12" cy="7" r="1" stroke="url(#adm-logo-grad)" />
            <rect x="2" y="10" width="20" height="2" rx="0.5" stroke="url(#adm-logo-grad)" />
            <line x1="4" y1="12" x2="4" y2="20" stroke="url(#adm-logo-grad)" />
            <line x1="7" y1="12" x2="7" y2="20" stroke="url(#adm-logo-grad)" />
            <line x1="17" y1="12" x2="17" y2="20" stroke="url(#adm-logo-grad)" />
            <line x1="20" y1="12" x2="20" y2="20" stroke="url(#adm-logo-grad)" />
            <circle cx="12" cy="16" r="3" stroke="url(#adm-logo-grad)" />
            <text x="12" y="16" fontSize="5.5" fontWeight="bold" textAnchor="middle" dominantBaseline="central" fill="url(#adm-logo-grad)" stroke="none" fontFamily="sans-serif">$</text>
            <line x1="3" y1="20" x2="21" y2="20" stroke="url(#adm-logo-grad)" />
            <line x1="2" y1="22" x2="22" y2="22" stroke="url(#adm-logo-grad)" />
          </svg>
          <span className="text-lg font-bold text-white tracking-tight flex items-center">
            Nexa<span className="text-primary-500">Queue</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-dark-300">
            <User className="w-4 h-4 text-red-400" />
            <span className="font-medium">{user?.name || 'Administrator'}</span>
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

      {/* Main Administrative Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-8 space-y-8 relative">
        {successMessage && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm flex items-center gap-2 animate-pulse">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Hello Banner */}
        <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">System Administration</h1>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl text-red-400 text-xs font-semibold">
            Mode: Admin Console
          </div>
        </div>

        {/* Console Tab Selector */}
        <div className="flex gap-4 border-b border-dark-800 pb-px">
          <button
            onClick={() => setActiveTab('branches')}
            className={`pb-3 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'branches' ? 'text-red-400 border-b-2 border-red-500' : 'text-dark-400 hover:text-white'}`}
          >
            <MapPin className="w-4 h-4" /> Branches
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`pb-3 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'services' ? 'text-red-400 border-b-2 border-red-500' : 'text-dark-400 hover:text-white'}`}
          >
            <Clipboard className="w-4 h-4" /> Services
          </button>
          <button
            onClick={() => setActiveTab('counters')}
            className={`pb-3 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'counters' ? 'text-red-400 border-b-2 border-red-500' : 'text-dark-400 hover:text-white'}`}
          >
            <Layers className="w-4 h-4" /> Counters
          </button>
          <button
            onClick={() => setActiveTab('regional')}
            className={`pb-3 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'regional' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-dark-400 hover:text-white'}`}
          >
            <BarChart2 className="w-4 h-4" /> Analytics Dashboard
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'audit' ? 'text-red-400 border-b-2 border-red-500' : 'text-dark-400 hover:text-white'}`}
          >
            <Lock className="w-4 h-4" /> Audit Ledger
          </button>
        </div>

        {/* Branches Tab View */}
        {activeTab === 'branches' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Configured Bank Branches</h3>
              <button
                onClick={() => { setShowModal('branch'); setErrorMessage(''); }}
                className="btn-accent py-2 px-4 text-xs font-bold text-white flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Branch
              </button>
            </div>

            <div className="glass-panel p-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-dark-800 text-dark-400 font-semibold">
                    <th className="pb-3">Branch Name</th>
                    <th className="pb-3">Code</th>
                    <th className="pb-3">Address</th>
                    <th className="pb-3">Hours</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800/50">
                  {branches.map(b => (
                    <tr key={b._id} className="text-dark-200">
                      <td className="py-4 font-bold text-white">{b.name}</td>
                      <td className="py-4">{b.code}</td>
                      <td className="py-4 text-xs">{b.address}</td>
                      <td className="py-4 text-xs">{b.workingHours?.open} - {b.workingHours?.close}</td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${b.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {b.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 text-right flex items-center justify-end gap-2">
                        {/* QR Code trigger */}
                        <button
                          onClick={() => setSelectedQRBranch(b)}
                          className="p-1.5 rounded border text-primary-400 border-primary-500/20 hover:border-primary-500/40 hover:bg-primary-500/5"
                          title="View Lobby Check-in QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>

                        {/* Manage Manager */}
                        <button
                          onClick={() => handleManageManager(b)}
                          className="p-1.5 rounded border text-purple-400 border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/5"
                          title="Manage Manager"
                        >
                          <User className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleToggleBranch(b._id)}
                          className={`p-1.5 rounded border ${b.isActive ? 'text-red-400 border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5' : 'text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/5'}`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Services Tab View */}
        {activeTab === 'services' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Registered Transaction Services</h3>
              <button
                onClick={() => { setShowModal('service'); setErrorMessage(''); }}
                className="btn-accent py-2 px-4 text-xs font-bold text-white flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Service
              </button>
            </div>

            <div className="glass-panel p-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-dark-800 text-dark-400 font-semibold">
                    <th className="pb-3">Service</th>
                    <th className="pb-3">Code</th>
                    <th className="pb-3">Prefix</th>
                    <th className="pb-3">Wait (Avg)</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800/50">
                  {services.map(s => (
                    <tr key={s._id} className="text-dark-200">
                      <td className="py-4 font-bold text-white">{s.name}</td>
                      <td className="py-4">{s.code}</td>
                      <td className="py-4 font-mono font-bold text-accent-400">{s.prefix}</td>
                      <td className="py-4 text-xs">{s.avgServingTime} mins</td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${s.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {s.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => handleToggleService(s)}
                          className={`p-1.5 rounded border ${s.isActive ? 'text-red-400 border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5' : 'text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/5'}`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Counters Tab View */}
        {activeTab === 'counters' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Configured Counters</h3>
              <button
                onClick={() => { setShowModal('counter'); setErrorMessage(''); }}
                className="btn-accent py-2 px-4 text-xs font-bold text-white flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Counter
              </button>
            </div>

            {/* Branch Filter Tabs */}
            <div className="glass-panel p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCounterBranchFilter('all')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 border ${
                    counterBranchFilter === 'all'
                      ? 'bg-accent-500 text-white border-accent-500 shadow-lg shadow-accent-500/25'
                      : 'text-dark-300 border-dark-700 hover:border-dark-500 hover:text-white hover:bg-dark-800/50'
                  }`}
                >
                  All Branches ({counters.length})
                </button>
                {branches.map(b => {
                  const count = counters.filter(c => (c.branch?._id || c.branch) === b._id).length;
                  return (
                    <button
                      key={b._id}
                      onClick={() => setCounterBranchFilter(b._id)}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 border flex items-center gap-2 ${
                        counterBranchFilter === b._id
                          ? 'bg-accent-500 text-white border-accent-500 shadow-lg shadow-accent-500/25'
                          : 'text-dark-300 border-dark-700 hover:border-dark-500 hover:text-white hover:bg-dark-800/50'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {b.name}
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
                        counterBranchFilter === b._id ? 'bg-white/20' : 'bg-dark-700'
                      }`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel p-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-dark-800 text-dark-400 font-semibold">
                    <th className="pb-3">Counter</th>
                    {counterBranchFilter === 'all' && <th className="pb-3">Branch Location</th>}
                    <th className="pb-3">Assigned Service</th>
                    <th className="pb-3">Assigned Staff</th>
                    <th className="pb-3">Email</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800/50">
                  {counters
                    .filter(c => counterBranchFilter === 'all' || (c.branch?._id || c.branch) === counterBranchFilter)
                    .sort((a, b) => a.number - b.number)
                    .map(c => (
                    <tr key={c._id} className="text-dark-200 hover:bg-dark-800/30 transition-colors">
                      <td className="py-4 font-bold text-white">Counter {c.number}</td>
                      {counterBranchFilter === 'all' && <td className="py-4">{c.branch?.name}</td>}
                      <td className="py-4 text-xs">{c.currentService?.name}</td>
                      <td className="py-4 text-xs">{c.counterStaff?.staffName || <span className="text-dark-500 italic">Unassigned</span>}</td>
                      <td className="py-4 text-xs font-mono">{c.counterStaff?.email || 'N/A'}</td>
                      <td className="py-4">
                        {c.counterStaff ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${(c.counterStaff.status === 'active' || c.counterStaff.status === 'Enabled') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                            {(c.counterStaff.status === 'active' || c.counterStaff.status === 'Enabled') ? 'ENABLED' : 'DISABLED'}
                          </span>
                        ) : (
                          <span className="text-dark-500 italic text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="py-4 text-right flex items-center justify-end gap-2">
                        {c.counterStaff ? (
                          <button
                            onClick={() => handleManageStaff(c)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-emerald-500/20 text-emerald-400 hover:text-white hover:bg-emerald-500/10 transition-all duration-200 flex items-center gap-1"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit Staff
                          </button>
                        ) : (
                          <button
                            onClick={() => handleManageStaff(c)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-accent-500/20 text-accent-400 hover:text-white hover:bg-accent-500/10 transition-all duration-200"
                          >
                            Manage Staff
                          </button>
                        )}
                        {c.counterStaff ? (
                          <button
                            onClick={() => handleToggleStaffStatus(c.counterStaff)}
                            disabled={togglingStaffId === c.counterStaff._id}
                            className={`p-1.5 rounded border ${(c.counterStaff.status === 'active' || c.counterStaff.status === 'Enabled') ? 'text-red-400 border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5' : 'text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/5'}`}
                            title={(c.counterStaff.status === 'active' || c.counterStaff.status === 'Enabled') ? "Disable Staff Account" : "Enable Staff Account"}
                          >
                            {togglingStaffId === c.counterStaff._id ? (
                              <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Power className="w-3.5 h-3.5" />
                            )}
                          </button>
                        ) : (
                          <button
                            disabled
                            className="p-1.5 rounded border text-dark-600 border-dark-800 cursor-not-allowed opacity-40"
                            title="No staff assigned to this counter"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setCounterToDelete(c)}
                          className="p-1.5 rounded border text-red-400 border-red-500/20 hover:border-red-500/40 hover:bg-red-500/10 transition-all duration-200"
                          title="Delete Counter"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {counters.filter(c => counterBranchFilter === 'all' || (c.branch?._id || c.branch) === counterBranchFilter).length === 0 && (
                    <tr><td colSpan="7" className="py-8 text-center text-dark-500 italic">No counters found for this branch.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Delete Counter Confirmation Modal */}
            {counterToDelete && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="glass-panel p-6 max-w-md w-full mx-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-red-500/10 border border-red-500/20">
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Delete Counter</h3>
                      <p className="text-xs text-dark-400">This action cannot be undone.</p>
                    </div>
                  </div>
                  <p className="text-sm text-dark-200">
                    Are you sure you want to delete <span className="font-bold text-white">Counter {counterToDelete.number}</span>
                    {counterToDelete.branch?.name && <> from <span className="font-bold text-accent-400">{counterToDelete.branch.name}</span></>}?
                    {counterToDelete.counterStaff && <span className="text-red-400 text-xs block mt-1">⚠ This counter has assigned staff that will be unlinked.</span>}
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setCounterToDelete(null)}
                      className="px-4 py-2 text-xs font-semibold rounded-lg border border-dark-700 text-dark-300 hover:text-white hover:border-dark-500 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteCounter(counterToDelete._id)}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Counter
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Regional Monitor Tab View */}
        {/* BI Analytics Dashboard Tab View */}
        {activeTab === 'regional' && (
          <div className="space-y-6">
            {/* Header Toolbar */}
            <div className="glass-panel p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart2 className="w-6 h-6 text-purple-400" /> Executive Analytics & Business Intelligence
                </h3>
              </div>

              {/* Live socket state indicator */}
              <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3.5 py-1.5 rounded-full text-purple-400 text-xs font-semibold uppercase">
                <Radio className="w-4 h-4 animate-pulse" /> Live Dashboard
              </div>
            </div>

            {/* Filters & Export Options */}
            <div className="glass-panel p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Timeframe selector */}
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

                {/* Branch selector */}
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Branch Office</label>
                  <select
                    value={analyticsBranchId}
                    onChange={(e) => {
                      setAnalyticsBranchId(e.target.value);
                      setAnalyticsCounterId('');
                    }}
                    className="glass-input w-full bg-dark-900 text-sm"
                  >
                    <option value="">All Branches</option>
                    {branches.map(b => (
                      <option key={b._id} value={b._id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>

                {/* Counter selector */}
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Counter</label>
                  <select
                    value={analyticsCounterId}
                    onChange={(e) => setAnalyticsCounterId(e.target.value)}
                    className="glass-input w-full bg-dark-900 text-sm"
                    disabled={!analyticsBranchId}
                  >
                    <option value="">All Counters</option>
                    {counters
                      .filter(c => !analyticsBranchId || (c.branch?._id || c.branch) === analyticsBranchId)
                      .map(c => (
                        <option key={c._id} value={c._id}>Counter {c.number}</option>
                      ))}
                  </select>
                </div>

                {/* Service selector */}
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Service</label>
                  <select
                    value={analyticsServiceId}
                    onChange={(e) => setAnalyticsServiceId(e.target.value)}
                    className="glass-input w-full bg-dark-900 text-sm"
                  >
                    <option value="">All Services</option>
                    {services.map(s => (
                      <option key={s._id} value={s._id}>{s.name} ({s.prefix})</option>
                    ))}
                  </select>
                </div>

                {/* Custom date range inputs */}
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
              </div>

              {/* Action buttons (Export / Print) */}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-dark-800">
                <button
                  onClick={() => handleExportBIAnalytics('pdf')}
                  title={!analyticsBranchId ? 'Select a Branch Office to export PDF' : 'Export as PDF'}
                  className={`py-2 px-4 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold ${
                    analyticsBranchId
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'bg-purple-600/40 text-white/50 cursor-not-allowed'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" /> Export PDF
                </button>
                <button
                  onClick={() => handleExportBIAnalytics('excel')}
                  title={!analyticsBranchId ? 'Select a Branch Office to export Excel' : 'Export as Excel'}
                  className={`py-2 px-4 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold border ${
                    analyticsBranchId
                      ? 'bg-dark-800 hover:bg-dark-700 text-purple-400 border-dark-700 hover:text-purple-300'
                      : 'bg-dark-800/40 text-purple-400/40 border-dark-700/40 cursor-not-allowed'
                  }`}
                >
                  <Clipboard className="w-3.5 h-3.5" /> Export Excel
                </button>
                <button
                  onClick={() => handleExportBIAnalytics('print')}
                  className="py-2 px-4 bg-dark-800 hover:bg-dark-700 text-dark-200 hover:text-white border border-dark-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Print Analytics
                </button>
              </div>
              {!analyticsBranchId && (
                <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
                  ⚠️ Select a <strong>Branch Office</strong> above to enable PDF &amp; Excel export.
                </p>
              )}
            </div>

            {/* Loading Indicator */}
            {analyticsLoading ? (
              <div className="glass-panel p-12 flex flex-col justify-center items-center gap-3">
                <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                <div className="text-dark-400 text-xs font-semibold">Loading BI engine models...</div>
              </div>
            ) : (
              <>
                {/* KPI Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {renderKpiCard("Total Branches", analyticsData.adminKpis?.totalBranches)}
                  {renderKpiCard("Active Counters", analyticsData.adminKpis?.activeCounters, "", "text-emerald-400")}
                  {renderKpiCard(
                    analyticsTimeframe === 'today' ? 'Served Today' :
                    analyticsTimeframe === 'yesterday' ? 'Served Yesterday' :
                    analyticsTimeframe === '7days' ? 'Served this Week' :
                    analyticsTimeframe === '30days' ? 'Served (Last 30 Days)' :
                    analyticsTimeframe === 'thisMonth' ? 'Served this Month' : 'Total Served',
                    analyticsData.adminKpis?.customersServedToday
                  )}
                  {renderKpiCard("Waiting Customers", analyticsData.adminKpis?.waitingCustomers, "", "text-amber-400")}
                  {renderKpiCard("Serving Customers", analyticsData.adminKpis?.customersBeingServed, "", "text-purple-400")}
                  {renderKpiCard("Tokens Generated", analyticsData.adminKpis?.totalTokensGeneratedToday)}
                  {renderKpiCard("Cancelled Tokens", analyticsData.adminKpis?.cancelledTokens, "", "text-red-400")}
                  {renderKpiCard("Skipped Tokens", analyticsData.adminKpis?.skippedTokens, "", "text-red-400")}
                  {renderKpiCard("Avg Wait Time", analyticsData.adminKpis?.avgWaitingTime, " mins", 
                    (analyticsData.adminKpis?.avgWaitingTime < 5 ? "text-emerald-400" : 
                     analyticsData.adminKpis?.avgWaitingTime <= 10 ? "text-yellow-400" : "text-red-400")
                  )}
                  {renderKpiCard("Avg Service Time", analyticsData.adminKpis?.avgServiceTime, " mins")}
                  {renderKpiCard("Satisfaction", analyticsData.adminKpis?.customerSatisfactionRating, " ★", "text-amber-400")}
                </div>

                {/* Top Performers Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Top Branch */}
                  <div className="glass-panel p-5 border-emerald-500/10 bg-emerald-500/[0.02] flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] text-dark-400 font-bold uppercase">Top Branch</div>
                      <div className="text-sm font-bold text-white mt-0.5">{analyticsData.topPerformers?.branch}</div>
                    </div>
                  </div>

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
                      <User className="w-5 h-5" />
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

                {/* Branch Comparisons (Admin Only) */}
                {!analyticsBranchId && analyticsData.branchComparisons && analyticsData.branchComparisons.length > 0 && (
                  <div className="glass-panel p-6 space-y-4">
                    <h3 className="text-base font-bold text-white">Branch Office Performance Comparisons</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {analyticsData.branchComparisons.map((bc, idx) => {
                        const isBest = idx === 0;
                        return (
                          <div key={bc.id} className={`p-5 rounded-xl border relative overflow-hidden ${
                            isBest ? 'bg-purple-600/5 border-purple-500/40' : 'bg-dark-900 border-dark-800'
                          }`}>
                            {isBest && (
                              <div className="absolute top-0 right-0 bg-purple-600 text-white text-[9px] font-bold py-1 px-3.5 rounded-bl-xl uppercase">
                                Best Performer
                              </div>
                            )}
                            <div className="text-sm font-bold text-white">{bc.name} ({bc.code})</div>
                            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                              <div>
                                <div className="text-[10px] text-dark-400 font-bold uppercase">Tickets</div>
                                <div className="text-sm font-bold text-white mt-1">{bc.customers}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-dark-400 font-bold uppercase">Avg Wait</div>
                                <div className="text-sm font-bold text-purple-400 mt-1">{bc.avgWait}m</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-dark-400 font-bold uppercase">Rating</div>
                                <div className="text-sm font-bold text-amber-400 mt-1">★ {bc.avgRating}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                                backgroundColor: 'rgba(139, 92, 246, 0.7)',
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

        {/* Cryptographic Audit Trail Tab View */}
        {activeTab === 'audit' && (
          <div className="space-y-6">

            {/* Blockchain validation trigger banner */}
            <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-400" /> Cryptographic Ledger Integrity Check
                </h3>
              </div>
              <button
                onClick={verifyLedgerChaining}
                disabled={verifyingLedger}
                className="btn-accent py-2.5 px-5 text-xs font-bold text-white flex items-center gap-2 hover:bg-red-700 disabled:bg-dark-800 disabled:text-dark-500"
              >
                {verifyingLedger ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" /> Verify Ledger Chain
                  </>
                )}
              </button>
            </div>

            {/* Verification result banner */}
            {verificationResult && (
              <div className={`p-5 rounded-2xl border text-sm flex gap-3 ${verificationResult.isSecure
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-404'
                }`}>
                {verificationResult.isSecure ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-white text-base">Ledger Verified Secure</h4>
                      <p className="text-xs text-dark-300 mt-1">
                        Checked {verificationResult.totalChecked} ledger entries sequentially. All hash linkages and block payload signatures remain intact. No security violations detected.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-6 h-6 text-red-400 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-white text-base">Cryptographic Chain Violation!</h4>
                      <p className="text-xs text-dark-300 mt-1">
                        Detected {verificationResult.violationsFound} alterations or linkages breaks in the audit ledger list! Details below:
                      </p>
                      <ul className="list-disc list-inside mt-2 text-xs text-red-300 space-y-1">
                        {verificationResult.failures.map((f, i) => (
                          <li key={i}>{f.reason} (Log ID: {f.logId})</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Logs List Table */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-white">System Audit Log Ledger</h3>
                <button
                  onClick={loadAuditLogs}
                  className="p-2 bg-dark-800 hover:bg-dark-700 text-dark-200 hover:text-white rounded-lg border border-dark-700 transition-colors"
                  title="Reload Ledger"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="glass-panel p-6 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-dark-800 text-dark-400 font-semibold">
                      <th className="pb-3 w-40">Timestamp</th>
                      <th className="pb-3 w-44">Actor</th>
                      <th className="pb-3 w-36">Action</th>
                      <th className="pb-3">Details</th>
                      <th className="pb-3 w-32">IP Address</th>
                      <th className="pb-3 w-28 text-right">Crypto Hash (SHA-256)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800/50">
                    {auditLogs.length > 0 ? (
                      auditLogs.map(log => (
                        <tr key={log._id} className="text-dark-200 align-top">
                          <td className="py-4 font-medium">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="py-4">
                            <div className="font-bold text-white">{log.actor?.name || 'SYSTEM'}</div>
                            <div className="text-[10px] text-dark-400">{log.actor?.email || 'N/A'}</div>
                          </td>
                          <td className="py-4">
                            <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-mono font-semibold uppercase">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-4 pr-4 text-dark-300 leading-relaxed">{log.description}</td>
                          <td className="py-4 font-mono">{log.ipAddress || '127.0.0.1'}</td>
                          <td className="py-4 text-right">
                            <span className="font-mono text-dark-400 hover:text-emerald-400 cursor-help" title={log.hash}>
                              {log.hash ? `${log.hash.substring(0, 8)}...` : 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-dark-400">
                          No audit trail events captured.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* QR Code Check-in Modal */}
      {selectedQRBranch && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel max-w-sm w-full p-6 space-y-6 relative border-primary-500/20 text-center animate-scale-up">
            <button
              onClick={() => setSelectedQRBranch(null)}
              className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Lobby Check-in QR Code</h3>
              <p className="text-xs text-dark-400">{selectedQRBranch.name} ({selectedQRBranch.code})</p>
            </div>

            {/* Dynamic Local Canvas-based QR Generation */}
            <div className="bg-white p-4 rounded-2xl inline-block shadow-2xl">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt={`${selectedQRBranch.name} QR Check-in`}
                  className="w-52 h-52 object-contain"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-dark-800 text-xs font-semibold">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs text-dark-300 leading-relaxed max-w-xs mx-auto">
                Display this QR code at the physical branch entrance. Customers can scan it with their mobile phones to check-in and join the virtual token lobby instantly.
              </p>
            </div>

            {/* Print, Download, Copy, Close Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(getQRUrl(selectedQRBranch));
                  showToast('URL link copied successfully!', 'success');
                }}
                className="btn-secondary py-2 text-xs text-white flex items-center justify-center gap-1.5"
              >
                Copy Link
              </button>
              <button
                type="button"
                onClick={() => downloadQR(selectedQRBranch)}
                className="btn-accent py-2 text-xs text-white flex items-center justify-center gap-1.5"
                disabled={!qrCodeDataUrl}
              >
                Download QR
              </button>
              <button
                type="button"
                onClick={() => printQR(selectedQRBranch)}
                className="btn-secondary py-2 text-xs text-white flex items-center justify-center gap-1.5"
                disabled={!qrCodeDataUrl}
              >
                Print QR
              </button>
              <button
                type="button"
                onClick={() => setSelectedQRBranch(null)}
                className="btn-accent bg-dark-800 hover:bg-dark-700 py-2 text-xs text-white flex items-center justify-center gap-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showModal === 'branch' && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-md w-full p-6 space-y-6 relative border-red-500/20">
            <button onClick={() => setShowModal(null)} className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white">Register Bank Branch</h3>
            {errorMessage && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{errorMessage}</div>}
            <form onSubmit={handleBranchSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Branch Name</label>
                <input
                  type="text"
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                  className="glass-input w-full"
                  placeholder="ApexBank Main Street"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Branch Code</label>
                  <input
                    type="text"
                    value={branchForm.code}
                    onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
                    className="glass-input w-full"
                    placeholder="NYC01"
                    maxLength={5}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Contact Phone</label>
                  <input
                    type="text"
                    value={branchForm.contact}
                    onChange={(e) => setBranchForm({ ...branchForm, contact: e.target.value })}
                    className="glass-input w-full"
                    placeholder="555-0100"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Full Address</label>
                <input
                  type="text"
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  className="glass-input w-full"
                  placeholder="123 Financial Way, Suite A"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Opening Hours</label>
                  <input
                    type="time"
                    value={branchForm.openHour}
                    onChange={(e) => setBranchForm({ ...branchForm, openHour: e.target.value })}
                    className="glass-input w-full"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Closing Hours</label>
                  <input
                    type="time"
                    value={branchForm.closeHour}
                    onChange={(e) => setBranchForm({ ...branchForm, closeHour: e.target.value })}
                    className="glass-input w-full"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="w-full btn-primary py-3 mt-4">Create Branch</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {showModal === 'service' && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-md w-full p-6 space-y-6 relative border-red-500/20">
            <button onClick={() => setShowModal(null)} className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white">Create Transaction Service</h3>
            {errorMessage && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{errorMessage}</div>}
            <form onSubmit={handleServiceSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Service Name</label>
                <input
                  type="text"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className="glass-input w-full"
                  placeholder="Cash Withdrawal / Deposit"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs text-dark-300 font-semibold">Unique Code</label>
                  <input
                    type="text"
                    value={serviceForm.code}
                    onChange={(e) => setServiceForm({ ...serviceForm, code: e.target.value })}
                    className="glass-input w-full"
                    placeholder="CSH01"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Prefix</label>
                  <input
                    type="text"
                    value={serviceForm.prefix}
                    onChange={(e) => setServiceForm({ ...serviceForm, prefix: e.target.value.toUpperCase() })}
                    className="glass-input w-full"
                    placeholder="W"
                    maxLength={2}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Average Serving Time (Minutes)</label>
                <input
                  type="number"
                  value={serviceForm.avgServingTime}
                  onChange={(e) => setServiceForm({ ...serviceForm, avgServingTime: parseInt(e.target.value) })}
                  className="glass-input w-full"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Description</label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  className="glass-input w-full h-20 resize-none"
                  placeholder="Service description..."
                />
              </div>
              <button type="submit" className="w-full btn-primary py-3 mt-4">Create Service</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Counter Modal */}
      {showModal === 'counter' && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-md w-full p-6 space-y-6 relative border-red-500/20">
            <button onClick={() => setShowModal(null)} className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white">Provision Teller Counter</h3>
            {errorMessage && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{errorMessage}</div>}
            <form onSubmit={handleCounterSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Counter Number</label>
                <input
                  type="number"
                  value={counterForm.number}
                  onChange={(e) => setCounterForm({ ...counterForm, number: parseInt(e.target.value) })}
                  className="glass-input w-full"
                  placeholder="e.g. 5"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Target Branch</label>
                <select
                  value={counterForm.branch}
                  onChange={(e) => setCounterForm({ ...counterForm, branch: e.target.value })}
                  className="glass-input w-full"
                  required
                >
                  <option value="">-- Choose Branch --</option>
                  {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Assigned Service</label>
                <select
                  value={counterForm.currentService}
                  onChange={(e) => setCounterForm({ ...counterForm, currentService: e.target.value })}
                  className="glass-input w-full"
                  required
                >
                  <option value="">-- Choose Service --</option>
                  {services.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full btn-primary py-3 mt-4">Provision Counter</button>
            </form>
          </div>
        </div>
      )}

      {/* Manage Staff Modal */}
      {showStaffModal && selectedCounterForStaff && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel max-w-md w-full p-6 space-y-6 relative border-accent-500/20 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => { if (!staffModalLoading) setShowStaffModal(false); }}
              className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors"
              disabled={staffModalLoading}
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white">
              {isEditingStaff ? 'Edit Counter Staff Account' : 'Create Counter Staff Account'}
            </h3>

            <form onSubmit={handleStaffSubmit} className="space-y-4">
              {/* Counter Name (Disabled) */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Counter Name</label>
                <input
                  type="text"
                  value={`Counter ${selectedCounterForStaff.number}`}
                  className="glass-input w-full opacity-60 cursor-not-allowed bg-dark-900"
                  disabled
                />
              </div>

              {/* Branch Name (Disabled) */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Branch Name</label>
                <input
                  type="text"
                  value={selectedCounterForStaff.branch?.name || 'Unknown Branch'}
                  className="glass-input w-full opacity-60 cursor-not-allowed bg-dark-900"
                  disabled
                />
              </div>

              {/* Staff Full Name */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Staff Full Name</label>
                <input
                  type="text"
                  value={staffForm.staffName}
                  onChange={(e) => setStaffForm({ ...staffForm, staffName: e.target.value })}
                  className={`glass-input w-full ${staffModalErrors.staffName ? 'border-red-500/50' : ''}`}
                  placeholder="e.g. Teller Jane"
                  disabled={staffModalLoading}
                />
                {staffModalErrors.staffName && (
                  <div className="text-red-400 text-xs mt-0.5">{staffModalErrors.staffName}</div>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Email Address</label>
                <input
                  type="email"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  className={`glass-input w-full ${staffModalErrors.email ? 'border-red-500/50' : ''}`}
                  placeholder="name@apexbank.com"
                  disabled={staffModalLoading}
                />
                {staffModalErrors.email && (
                  <div className="text-red-400 text-xs mt-0.5">{staffModalErrors.email}</div>
                )}
              </div>



              {/* Read Only Timestamps */}
              {isEditingStaff && currentStaffData && (
                <div className="grid grid-cols-2 gap-4 text-[10px] text-dark-400 pt-2 border-t border-dark-800">
                  <div>
                    <span className="font-semibold block text-dark-300">Created Date</span>
                    {new Date(currentStaffData.createdAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-semibold block text-dark-300">Last Updated</span>
                    {new Date(currentStaffData.updatedAt).toLocaleString()}
                  </div>
                </div>
              )}

              {/* Security section header for editing */}
              <div className="pt-2 border-t border-dark-800">
                <h4 className="text-xs font-bold text-accent-400 uppercase tracking-wider">Security</h4>
                {isEditingStaff && (
                  <p className="text-[10px] text-dark-400 mt-0.5">Leave blank unless you want to change the password.</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">
                  {isEditingStaff ? 'New Password' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    type={showStaffPassword ? 'text' : 'password'}
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    className={`glass-input w-full pr-10 ${staffModalErrors.password ? 'border-red-500/50' : ''}`}
                    placeholder={isEditingStaff ? '•••••••• (optional)' : '••••••••'}
                    disabled={staffModalLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-dark-400 hover:text-white"
                  >
                    {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {staffModalErrors.password && (
                  <div className="text-red-400 text-xs mt-0.5">{staffModalErrors.password}</div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">
                  {isEditingStaff ? 'Confirm New Password' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <input
                    type={showStaffConfirmPassword ? 'text' : 'password'}
                    value={staffForm.confirmPassword}
                    onChange={(e) => setStaffForm({ ...staffForm, confirmPassword: e.target.value })}
                    className={`glass-input w-full pr-10 ${staffModalErrors.confirmPassword ? 'border-red-500/50' : ''}`}
                    placeholder={isEditingStaff ? '•••••••• (optional)' : '••••••••'}
                    disabled={staffModalLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffConfirmPassword(!showStaffConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-dark-400 hover:text-white"
                  >
                    {showStaffConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {staffModalErrors.confirmPassword && (
                  <div className="text-red-400 text-xs mt-0.5">{staffModalErrors.confirmPassword}</div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="flex flex-col gap-3 pt-4 border-t border-dark-800">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowStaffModal(false)}
                    className="w-1/2 btn-secondary py-2.5 text-xs text-white"
                    disabled={staffModalLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 btn-primary py-2.5 text-xs text-white flex justify-center items-center gap-2"
                    disabled={staffModalLoading}
                  >
                    {staffModalLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      isEditingStaff ? 'Save Changes' : 'Save'
                    )}
                  </button>
                </div>

                {isEditingStaff && (
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setShowDeleteStaffConfirm(true)}
                      className="w-full p-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold transition-colors"
                      disabled={staffModalLoading}
                    >
                      Delete Staff
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Branch Manager Modal */}
      {showManagerModal && selectedBranchForManager && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel max-w-md w-full p-6 space-y-6 relative border-purple-500/20 max-h-[90vh] overflow-y-auto animate-scale-up">
            <button
              type="button"
              onClick={() => { if (!managerModalLoading) setShowManagerModal(false); }}
              className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors"
              disabled={managerModalLoading}
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white">
              {isEditingManager ? 'Edit Branch Manager Account' : 'Create Branch Manager Account'}
            </h3>

            <form onSubmit={handleManagerSubmit} className="space-y-4">
              {/* Branch Name (Read Only) */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Branch Name (Read Only)</label>
                <input
                  type="text"
                  value={selectedBranchForManager.name}
                  className="glass-input w-full opacity-60 cursor-not-allowed bg-dark-900"
                  disabled
                />
              </div>

              {/* Manager Full Name */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Manager Full Name</label>
                <input
                  type="text"
                  value={managerForm.managerName}
                  onChange={(e) => setManagerForm({ ...managerForm, managerName: e.target.value })}
                  className={`glass-input w-full ${managerModalErrors.managerName ? 'border-red-500/50' : ''}`}
                  placeholder="e.g. John Doe"
                  disabled={managerModalLoading}
                />
                {managerModalErrors.managerName && (
                  <div className="text-red-400 text-xs mt-0.5">{managerModalErrors.managerName}</div>
                )}
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Email Address</label>
                <input
                  type="email"
                  value={managerForm.email}
                  onChange={(e) => setManagerForm({ ...managerForm, email: e.target.value })}
                  className={`glass-input w-full ${managerModalErrors.email ? 'border-red-500/50' : ''}`}
                  placeholder="manager@apexbank.com"
                  disabled={managerModalLoading}
                />
                {managerModalErrors.email && (
                  <div className="text-red-400 text-xs mt-0.5">{managerModalErrors.email}</div>
                )}
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Phone Number</label>
                <input
                  type="text"
                  value={managerForm.phone}
                  onChange={(e) => setManagerForm({ ...managerForm, phone: e.target.value })}
                  className={`glass-input w-full ${managerModalErrors.phone ? 'border-red-500/50' : ''}`}
                  placeholder="e.g. +1234567890"
                  disabled={managerModalLoading}
                />
                {managerModalErrors.phone && (
                  <div className="text-red-400 text-xs mt-0.5">{managerModalErrors.phone}</div>
                )}
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Status</label>
                <select
                  value={managerForm.status}
                  onChange={(e) => setManagerForm({ ...managerForm, status: e.target.value })}
                  className="glass-input w-full bg-dark-900 text-white"
                  disabled={managerModalLoading}
                >
                  <option value="Enabled">Enabled</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>

              {/* Timestamps */}
              {isEditingManager && currentManagerData && (
                <div className="grid grid-cols-2 gap-4 text-[10px] text-dark-400 pt-2 border-t border-dark-800">
                  <div>
                    <span className="font-semibold block text-dark-300">Created Date</span>
                    {new Date(currentManagerData.createdAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-semibold block text-dark-300">Last Updated</span>
                    {new Date(currentManagerData.updatedAt).toLocaleString()}
                  </div>
                </div>
              )}

              {/* Security Header */}
              <div className="pt-2 border-t border-dark-800">
                <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Security</h4>
                {isEditingManager && (
                  <p className="text-[10px] text-dark-400 mt-0.5">Leave blank unless you want to change the password.</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">
                  {isEditingManager ? 'New Password' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    type={showManagerPassword ? 'text' : 'password'}
                    value={managerForm.password}
                    onChange={(e) => setManagerForm({ ...managerForm, password: e.target.value })}
                    className={`glass-input w-full pr-10 ${managerModalErrors.password ? 'border-red-500/50' : ''}`}
                    placeholder={isEditingManager ? '•••••••• (optional)' : '••••••••'}
                    disabled={managerModalLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowManagerPassword(!showManagerPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-dark-400 hover:text-white"
                  >
                    {showManagerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {managerModalErrors.password && (
                  <div className="text-red-400 text-xs mt-0.5">{managerModalErrors.password}</div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">
                  {isEditingManager ? 'Confirm New Password' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <input
                    type={showManagerConfirmPassword ? 'text' : 'password'}
                    value={managerForm.confirmPassword}
                    onChange={(e) => setManagerForm({ ...managerForm, confirmPassword: e.target.value })}
                    className={`glass-input w-full pr-10 ${managerModalErrors.confirmPassword ? 'border-red-500/50' : ''}`}
                    placeholder={isEditingManager ? '•••••••• (optional)' : '••••••••'}
                    disabled={managerModalLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowManagerConfirmPassword(!showManagerConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-dark-400 hover:text-white"
                  >
                    {showManagerConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {managerModalErrors.confirmPassword && (
                  <div className="text-red-400 text-xs mt-0.5">{managerModalErrors.confirmPassword}</div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="flex gap-4 pt-4 border-t border-dark-800">
                <button
                  type="button"
                  onClick={() => setShowManagerModal(false)}
                  className="w-1/2 btn-secondary py-2.5 text-xs text-white"
                  disabled={managerModalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 btn-primary py-2.5 text-xs text-white flex justify-center items-center gap-2"
                  disabled={managerModalLoading}
                >
                  {managerModalLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    isEditingManager ? 'Save Changes' : 'Save'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Staff Confirmation Modal */}
      {showDeleteStaffConfirm && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="glass-panel max-w-sm w-full p-6 space-y-6 relative border-red-500/20 text-center">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Remove Staff Account?</h3>
              <p className="text-xs text-dark-300 leading-relaxed">
                Are you sure you want to remove this staff from the counter? This will permanently delete the staff account.
              </p>
            </div>
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteStaffConfirm(false)}
                className="w-1/2 btn-secondary py-2.5 text-xs text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStaff}
                className="w-1/2 btn-accent bg-red-600 hover:bg-red-500 py-2.5 text-xs text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="glass-panel max-w-sm w-full p-6 space-y-4 relative border-yellow-500/20">
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white">Reset Staff Password</h3>
            
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">New Password</label>
                <div className="relative">
                  <input
                    type={showResetPasswordVisible ? 'text' : 'password'}
                    value={resetPasswordVal}
                    onChange={(e) => setResetPasswordVal(e.target.value)}
                    className="glass-input w-full pr-10 font-mono"
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPasswordVisible(!showResetPasswordVisible)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-dark-400 hover:text-white"
                  >
                    {showResetPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="w-full py-2 bg-dark-800 hover:bg-dark-700 text-white rounded-lg text-xs font-semibold border border-dark-700 transition-colors"
                >
                  Generate Temp Password
                </button>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="w-1/2 btn-secondary py-2.5 text-xs text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 btn-primary py-2.5 text-xs text-white"
                >
                  Save Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toggle Staff Account Confirmation Modal */}
      {showConfirmStaffStatus && staffToToggle && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <div className="glass-panel max-w-sm w-full p-6 space-y-6 relative border-red-500/20 text-center animate-fade-in">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">
                {(staffToToggle.status === 'active' || staffToToggle.status === 'Enabled') ? 'Disable Staff Account?' : 'Enable Staff Account?'}
              </h3>
              <p className="text-xs text-dark-300 leading-relaxed">
                {(staffToToggle.status === 'active' || staffToToggle.status === 'Enabled')
                  ? 'Are you sure you want to disable this Counter Staff account?'
                  : 'Do you want to enable this Counter Staff account?'}
              </p>
            </div>
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => { setShowConfirmStaffStatus(false); setStaffToToggle(null); }}
                className="w-1/2 btn-secondary py-2.5 text-xs text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmToggleStaffStatus}
                className={`w-1/2 py-2.5 text-xs font-semibold rounded-lg text-white transition-all duration-200 ${(staffToToggle.status === 'active' || staffToToggle.status === 'Enabled') ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
              >
                {(staffToToggle.status === 'active' || staffToToggle.status === 'Enabled') ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disable Service Confirmation Modal */}
      {confirmDisableServiceId && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <div className="glass-panel max-w-sm w-full p-6 space-y-6 relative border-red-500/20 text-center animate-fade-in">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Disable Service?</h3>
              <p className="text-xs text-dark-300 leading-relaxed">
                Are you sure you want to disable this service? Active counters offering this service will no longer be able to call waiting customers, and customers cannot generate new tokens for it.
              </p>
            </div>
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDisableServiceId(null)}
                className="w-1/2 btn-secondary py-2.5 text-xs text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => proceedToggleService(confirmDisableServiceId, true)}
                className="w-1/2 btn-accent bg-red-600 hover:bg-red-500 py-2.5 text-xs text-white"
              >
                Yes, Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-5 right-5 z-50 space-y-2 max-w-sm w-full">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`p-4 rounded-xl border shadow-lg flex items-center justify-between gap-3 backdrop-blur-md transition-all duration-300 ${t.type === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
          >
            <div className="flex items-center gap-2">
              {t.type === 'error' ? (
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              ) : (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{t.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="text-dark-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
