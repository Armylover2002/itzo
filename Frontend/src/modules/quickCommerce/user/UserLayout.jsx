import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import CustomerLayout from './components/layout/CustomerLayout';

// Wrapped in React.memo — CustomerLayout and Outlet are stable; only re-renders on location change
const UserLayout = React.memo(() => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]); // only fire on pathname change, not search/hash

  return (
    <CustomerLayout>
      <Outlet />
    </CustomerLayout>
  );
});

UserLayout.displayName = 'UserLayout';

export default UserLayout;