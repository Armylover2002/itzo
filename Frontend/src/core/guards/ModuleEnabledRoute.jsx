import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSettings } from '@core/context/SettingsContext';

const VALID_MODULES = new Set(['food', 'quickCommerce']);

export function getFirstEnabledModulePath(settings) {
  const modules = settings?.modules || {};
  if (modules.food !== false) return '/food/user';
  if (modules.quickCommerce !== false) return '/quick';
  return '/user/auth/login';
}

export default function ModuleEnabledRoute({ moduleKey, fallbackTo, children }) {
  const { settings, loading } = useSettings();

  if (!VALID_MODULES.has(moduleKey)) {
    return <Navigate to={fallbackTo || getFirstEnabledModulePath(settings)} replace />;
  }

  if (loading) {
    return null;
  }

  if (settings?.modules?.[moduleKey] === false) {
    return <Navigate to={fallbackTo || getFirstEnabledModulePath(settings)} replace />;
  }

  return children;
}
