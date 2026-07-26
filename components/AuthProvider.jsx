'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { registerCustomer, loginCustomer, logoutCustomer, retrieveCustomer } from '@/lib/shop';
import { useCart } from '@/components/CartProvider';

const AuthContext = createContext(null);

/**
 * One source of truth for the shopper session, backed by the Nexvato Shop
 * engine. The signed session token lives in localStorage, so the session
 * survives reloads. On login or register we claim the current guest cart via
 * CartProvider.claimCart() so their order lands in order history.
 *
 * The session is scoped to THIS shop by the server — a token minted here is
 * refused at any other client's store.
 */
export default function AuthProvider({ children }) {
  const { claimCart } = useCart();
  const [customer, setCustomer] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const c = await retrieveCustomer();
      setCustomer(c);
      return c;
    } catch (e) {
      setCustomer(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    refresh().finally(() => { if (alive) setAuthLoading(false); });
    return () => { alive = false; };
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    await loginCustomer(email, password);
    const c = await refresh();
    await claimCart();
    return c;
  }, [refresh, claimCart]);

  const register = useCallback(async ({ email, password, first_name, last_name }) => {
    await registerCustomer({ email, password, first_name, last_name });
    const c = await refresh();
    await claimCart();
    return c;
  }, [refresh, claimCart]);

  const logout = useCallback(async () => {
    logoutCustomer();
    setCustomer(null);
  }, []);

  return (
    <AuthContext.Provider value={{ customer, authLoading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
