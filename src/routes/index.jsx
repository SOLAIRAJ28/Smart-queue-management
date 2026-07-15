import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import Landing from '../pages/Landing';
import Login from '../pages/Login';
import Register from '../pages/Register';
import CustomerDashboard from '../pages/CustomerDashboard';
import StaffDashboard from '../pages/StaffDashboard';
import ManagerDashboard from '../pages/ManagerDashboard';
import AdminDashboard from '../pages/AdminDashboard';
import DisplayBoard from '../pages/DisplayBoard';

// Protected Route Component to enforce JWT/Role authentication
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to default home if role unauthorized
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Navigate to="/login?role=customer" replace />} />
      <Route path="/display" element={<DisplayBoard />} />

      {/* Role-Based Protected Routes */}
      <Route
        path="/customer"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRoles={['staff', 'counter_staff']}>
            <StaffDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager"
        element={
          <ProtectedRoute allowedRoles={['manager', 'branch_manager']}>
            <ManagerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Catch-all route redirecting to Landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
export { ProtectedRoute };
