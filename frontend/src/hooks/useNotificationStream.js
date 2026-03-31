import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to subscribe to SSE notification stream.
 * Falls back to polling if SSE connection fails.
 * @param {function} onNotification - callback receiving notification object
 * @returns {{ connected: boolean }}
 */
export default function useNotificationStream(onNotification) {
  const esRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    // Phase 1.2: Use credentials (httpOnly cookie) instead of localStorage token
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/notifications/stream`;

    const controller = new AbortController();
    
    fetch(url, {
      credentials: 'include',
      signal: controller.signal,
    }).then(response => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function processStream() {
        reader.read().then(({ done, value }) => {
          if (done) {
            // Connection closed, reconnect after delay
            reconnectTimer.current = setTimeout(connect, 5000);
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                onNotification(data);
              } catch {}
            }
          }
          processStream();
        }).catch(() => {
          reconnectTimer.current = setTimeout(connect, 5000);
        });
      }
      processStream();
    }).catch(() => {
      // SSE connection failed, will rely on polling fallback
      reconnectTimer.current = setTimeout(connect, 10000);
    });

    esRef.current = controller;
  }, [onNotification]);

  useEffect(() => {
    connect();
    return () => {
      if (esRef.current) esRef.current.abort();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);
}
