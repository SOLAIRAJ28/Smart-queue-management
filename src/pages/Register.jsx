import React from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { authStart, authSuccess, authFailure } from '../redux/authSlice';
import { ArrowLeft, User, Lock, Mail, Phone, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const branchId = params.get('branchId');
    if (branchId) {
      sessionStorage.setItem('scanBranchId', branchId);
    }
  }, []);

  const formik = useFormik({
    initialValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
    validationSchema: Yup.object({
      name: Yup.string().required('Required'),
      email: Yup.string().email('Invalid email address').required('Required'),
      phone: Yup.string().matches(/^[0-9]+$/, 'Must be only digits').min(10, 'Must be at least 10 digits').required('Required'),
      password: Yup.string().min(6, 'Password must be at least 6 characters').required('Required'),
      confirmPassword: Yup.string()
        .oneOf([Yup.ref('password'), null], 'Passwords must match')
        .required('Required'),
    }),
    onSubmit: async (values) => {
      dispatch(authStart());
      try {
        const response = await api.post('/auth/register', {
          name: values.name,
          email: values.email,
          phone: values.phone,
          password: values.password,
          role: 'customer',
        });

        if (response.data.status === 'success') {
          const { user, accessToken, refreshToken } = response.data.data;
          dispatch(authSuccess({ user, token: accessToken, refreshToken }));
          navigate('/customer');
        } else {
          throw new Error(response.data.message || 'Registration failed');
        }
      } catch (err) {
        const errMsg = err.response?.data?.message || err.message || 'Registration failed';
        dispatch(authFailure(errMsg));
      }
    },
  });

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col justify-center items-center px-4 py-12 relative font-sans">
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
            <h2 className="text-2xl font-bold tracking-tight text-white">Create Account</h2>
            <p className="text-sm text-dark-400">Join virtual lobby queues and book priority appointments</p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
              {error}
            </div>
          )}

          <form onSubmit={formik.handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1">
              <label htmlFor="name" className="text-xs font-semibold text-dark-300 block">Full Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-dark-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="name"
                  name="name"
                  type="text"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.name}
                  className="glass-input glass-input-icon-left w-full"
                  placeholder="John Doe"
                />
              </div>
              {formik.touched.name && formik.errors.name ? (
                <div className="text-red-400 text-xs mt-0.5">{formik.errors.name}</div>
              ) : null}
            </div>

            {/* Email Address */}
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
                  placeholder="john@example.com"
                />
              </div>
              {formik.touched.email && formik.errors.email ? (
                <div className="text-red-400 text-xs mt-0.5">{formik.errors.email}</div>
              ) : null}
            </div>

            {/* Phone Number */}
            <div className="space-y-1">
              <label htmlFor="phone" className="text-xs font-semibold text-dark-300 block">Phone Number</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-dark-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.phone}
                  className="glass-input glass-input-icon-left w-full"
                  placeholder="9876543210"
                />
              </div>
              {formik.touched.phone && formik.errors.phone ? (
                <div className="text-red-400 text-xs mt-0.5">{formik.errors.phone}</div>
              ) : null}
            </div>

            {/* Password */}
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

            {/* Confirm Password */}
            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="text-xs font-semibold text-dark-300 block">Confirm Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-dark-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.confirmPassword}
                  className="glass-input glass-input-icon-left glass-input-icon-right w-full"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-dark-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formik.touched.confirmPassword && formik.errors.confirmPassword ? (
                <div className="text-red-400 text-xs mt-0.5">{formik.errors.confirmPassword}</div>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 flex justify-center items-center mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="text-center text-sm text-dark-400 mt-4">
            Already have an account?{' '}
            <Link to="/login?role=customer" className="text-primary-400 hover:text-primary-300 font-semibold">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
