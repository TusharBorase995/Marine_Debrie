import { useState, useEffect, useRef } from 'react';

export const useWebSocket = (url) => {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    let fullUrl;
    const envWsUrl = import.meta.env.VITE_WS_URL;

    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      fullUrl = url;
    } else if (envWsUrl) {
      const cleanBase = envWsUrl.replace(/\/$/, '');
      fullUrl = `${cleanBase}${url.startsWith('/') ? '' : '/'}${url}`;
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      fullUrl = `${wsProtocol}//${window.location.hostname}:8000${url}`;
    } else {
      // Production live WebSocket stream on Render
      fullUrl = `wss://marine-debrie.onrender.com${url.startsWith('/') ? '' : '/'}${url}`;
    }

    try {
      const ws = new WebSocket(fullUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setData(parsed);
        } catch (e) {
          console.error("WS Parse error:", e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
      };

      ws.onerror = (err) => {
        setConnected(false);
        setError("WebSocket connection failed");
      };
    } catch (err) {
      setConnected(false);
      setError(err.message);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url]);

  return { data, connected, error };
};

export default useWebSocket;
