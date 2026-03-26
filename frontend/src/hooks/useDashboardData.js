import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

/**
 * Fetches dashboard data with polling support.
 * @param {number} intervalSec - polling interval in seconds (0 = no polling)
 */
export function useDashboardData(intervalSec = 60) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data: d } = await api.get('/dashboard');
      if (mountedRef.current) {
        setData(d);
        setLastUpdated(new Date());
      }
    } catch (e) {
      if (mountedRef.current) setError(e.response?.data?.error || 'فشل تحميل البيانات');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  // Polling
  useEffect(() => {
    if (intervalSec <= 0) return;
    timerRef.current = setInterval(() => fetch(true), intervalSec * 1000);
    return () => clearInterval(timerRef.current);
  }, [intervalSec, fetch]);

  return { data, loading, error, lastUpdated, refresh: () => fetch(false) };
}

/**
 * Fetches HR summary data for HR roles.
 */
export function useHRData(enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    api.get('/reports/hr-summary')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled]);

  return { data, loading };
}
