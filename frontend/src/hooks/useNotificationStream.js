import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to subscribe to SSE notification stream.
 * Falls back to polling if SSE connection fails.
 * @param {function} onNotification - callback receiving notification object
 */
export default function useNotificationStream(onNotification) {
  const esRef = useRef(null);
  const reconnectTimer = useRef(null);
  const onNotificationRef = useRef(onNotification);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_DELAY = 60000;

  // Keep callback ref current without triggering reconnects
  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  const connect = useCallback(() => {
    // Abort any previous connection before opening a new one
    if (esRef.current) {
      esRef.current.abort();
      esRef.current = null;
    }

    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/notifications/stream`;

    const controller = new AbortController();
    esRef.current = controller;
    
    fetch(url, {
      credentials: 'include',
      signal: controller.signal,
    }).then(response => {
      if (!response.ok || !response.body) {
        throw new Error('SSE connection failed');
      }
      reconnectAttempts.current = 0;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function processStream() {
        reader.read().then(({ done, value }) => {
          if (done) {
            // Connection closed normally, reconnect after delay
            scheduleReconnect();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                onNotificationRef.current(data);
              } catch {}
            }
          }
          processStream();
        }).catch((err) => {
          if (err.name !== 'AbortError') {
            scheduleReconnect();
          }
        });
      }
      processStream();
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        scheduleReconnect();
      }
    });
  }, []);

  const scheduleReconnect = useCallback(() => {
    // Exponential backoff: 5s, 10s, 20s, 40s... capped at 60s
    const delay = Math.min(5000 * Math.pow(2, reconnectAttempts.current), MAX_RECONNECT_DELAY);
    reconnectAttempts.current++;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = setTimeout(connect, delay);
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (esRef.current) esRef.current.abort();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);
}
