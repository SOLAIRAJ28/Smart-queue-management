import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { authStart, authSuccess, authFailure } from '../redux/authSlice';
import { ArrowLeft, Lock, Mail, ShieldAlert, User, Phone, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';

const Login = () => {
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') || 'customer';
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [localError, setLocalError] = useState(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [emailOrPhone, setEmailOrPhone] = useState(''); // Holds raw mobile input
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  React.useEffect(() => {
    const branchId = searchParams.get('branchId');
    if (branchId) {
      sessionStorage.setItem('scanBranchId', branchId);
    }
  }, [searchParams]);

  // Cooldown countdown timer
  React.useEffect(() => {
    let interval = null;
    if (cooldownSeconds > 0) {
      interval = setInterval(() => {
        setCooldownSeconds((prev) => prev - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const formatCooldownTime = (secs) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const handleCustomerLogin = async () => {
    if (!fullName.trim()) {
      setLocalError("Please enter your name.");
      return;
    }
    if (!emailOrPhone.trim()) {
      setLocalError('Please enter your mobile number.');
      return;
    }
    
    let cleanedMobile = emailOrPhone.replace(/\D/g, '');
    if (cleanedMobile.length > 10 && (cleanedMobile.startsWith('91') || cleanedMobile.startsWith('+91'))) {
      cleanedMobile = cleanedMobile.slice(-10);
    }
    
    if (!/^[6-9]\d{9}$/.test(cleanedMobile)) {
      setLocalError('Invalid Mobile Number. Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLocalLoading(true);
    setLocalError(null);
    dispatch(authStart());
    try {
      const res = await api.post('/auth/otp/send', { 
        mobileNumber: cleanedMobile,
        fullName: fullName.trim()
      });
      
      if (res.data.status === 'success') {
        const { user, accessToken, refreshToken } = res.data.data;
        dispatch(authSuccess({ user, token: accessToken, refreshToken }));
        
        setCooldownSeconds(0);

        let redirectPath = '/customer';
        const scanBranchId = sessionStorage.getItem('scanBranchId');
        if (scanBranchId) {
          redirectPath = `/customer?branchId=${scanBranchId}`;
          sessionStorage.removeItem('scanBranchId');
        }
        navigate(redirectPath);
      }
    } catch (err) {
      console.error('Customer login error:', err);
      if (err.response?.status === 429) {
        const cooldown = err.response?.data?.cooldownSeconds || 120;
        setCooldownSeconds(cooldown);
        setLocalError('Too many login attempts detected. Please wait 2 minutes before signing in again.');
      } else {
        const errMsg = err.response?.data?.message || err.message || 'Failed to sign in';
        setLocalError(errMsg);
        dispatch(authFailure(errMsg));
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const getRoleTitle = (r) => {
    switch (r) {
      case 'staff': return 'Staff Counter';
      case 'manager': return 'Manager Desk';
      case 'admin': return 'System Admin';
      default: return 'Customer Portal';
    }
  };

  const getRoleColor = (r) => {
    switch (r) {
      case 'staff': return 'text-accent-400 border-accent-500/20 bg-accent-500/5';
      case 'manager': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
      case 'admin': return 'text-red-400 border-red-500/20 bg-red-500/5';
      default: return 'text-primary-400 border-primary-500/20 bg-primary-500/5';
    }
  };

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Invalid email address').required('Required'),
      password: Yup.string().min(6, 'Password must be at least 6 characters').required('Required'),
    }),
    onSubmit: async (values) => {
      setLocalLoading(true);
      setLocalError(null);
      dispatch(authStart());
      try {
        const response = await api.post('/auth/login', {
          email: values.email,
          password: values.password,
          role,
        });

        if (response.data.status === 'success') {
          const { user, accessToken, refreshToken } = response.data.data;

          // Verify that user role matches the selected login portal
          const isStaffPortal = role === 'staff';
          const isStaffUser = user.role === 'staff' || user.role === 'counter_staff';
          const isManagerPortal = role === 'manager';
          const isManagerUser = user.role === 'manager' || user.role === 'branch_manager';

          if (isStaffPortal ? !isStaffUser : isManagerPortal ? !isManagerUser : user.role !== role) {
            throw new Error(`Unauthorized: This account is registered as a ${user.role}.`);
          }

          dispatch(authSuccess({ user, token: accessToken, refreshToken }));
          let redirectPath = user.role === 'counter_staff' ? '/staff' : user.role === 'branch_manager' ? '/manager' : `/${user.role}`;
          if (user.role === 'customer') {
            const scanBranchId = sessionStorage.getItem('scanBranchId');
            if (scanBranchId) {
              redirectPath = `/customer?branchId=${scanBranchId}`;
              sessionStorage.removeItem('scanBranchId');
            }
          }
          navigate(redirectPath);
        } else {
          throw new Error(response.data.message || 'Login failed');
        }
      } catch (err) {
        const errMsg = err.response?.data?.message || err.message || 'Authentication failed';
        setLocalError(errMsg);
        dispatch(authFailure(errMsg));
      } finally {
        setLocalLoading(false);
      }
    },
  });

  React.useEffect(() => {
    setLocalError(null);
    setLocalLoading(false);
    setEmailOrPhone('');
    setFullName('');
    setCooldownSeconds(0);
    formik.resetForm();
  }, [location.pathname, role]);

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col justify-center items-center px-4 relative font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-primary-600/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-accent-600/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6">
        {/* Back Link */}
        <div className="flex justify-between items-center">
          <Link to="/" className="inline-flex items-center gap-2 text-dark-400 hover:text-white text-sm transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to Home
          </Link>
        </div>

        {/* Card */}
        <div className="login-card p-8 space-y-6 shadow-2xl animate-scale-up">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {role === 'customer' ? 'Quick Check-in' : 'Welcome Back'}
            </h2>
            <div className={`inline-block px-3 py-1 border rounded-full text-xs font-semibold ${getRoleColor(role)}`}>
              {role === 'customer' ? 'Customer Portal' : `Sign In to ${getRoleTitle(role)}`}
            </div>
          </div>

          {localError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{localError}</span>
            </div>
          )}

          {role === 'customer' ? (
            <div className="space-y-4">
              <div className="space-y-4">
                {/* Full Name Input */}
                <div className="space-y-1">
                  <label htmlFor="fullName" className="text-xs font-semibold text-dark-300 block">
                    Full Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-dark-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="glass-input glass-input-icon-left w-full"
                      placeholder="John Doe"
                      disabled={localLoading}
                    />
                  </div>
                </div>

                {/* Mobile Number Input */}
                <div className="space-y-1">
                  <label htmlFor="emailOrPhone" className="text-xs font-semibold text-dark-300 block">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-dark-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      id="emailOrPhone"
                      type="tel"
                      value={emailOrPhone}
                      onChange={(e) => setEmailOrPhone(e.target.value)}
                      className="glass-input glass-input-icon-left w-full"
                      placeholder="e.g. 9876543210"
                      disabled={localLoading}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCustomerLogin}
                  disabled={localLoading || cooldownSeconds > 0}
                  className="w-full btn-primary py-3 flex justify-center items-center mt-6 font-semibold"
                >
                  {localLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Sign In / Register'
                  )}
                </button>

                {cooldownSeconds > 0 && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl text-center space-y-1 mt-4">
                    <div>Login Limit Reached</div>
                    <div className="text-sm font-bold">You can request another login in {formatCooldownTime(cooldownSeconds)}</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={formik.handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-1">
                <label htmlFor="email" className="text-xs font-semibold text-dark-300 block">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-dark-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.email}
                    className="glass-input glass-input-icon-left w-full"
                    placeholder="name@nexaqueue.com"
                  />
                </div>
                {formik.touched.email && formik.errors.email ? (
                  <div className="text-red-400 text-xs mt-0.5">{formik.errors.email}</div>
                ) : null}
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <label htmlFor="password" className="text-xs font-semibold text-dark-300 block">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-dark-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.password}
                    className="glass-input glass-input-icon-left glass-input-icon-right w-full"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-dark-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formik.touched.password && formik.errors.password ? (
                  <div className="text-red-400 text-xs mt-0.5">{formik.errors.password}</div>
                ) : null}
              </div>


              {/* Submit Button */}
              <button
                type="submit"
                disabled={localLoading}
                className="w-full btn-primary py-3 flex justify-center items-center mt-6"
              >
                {localLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;
