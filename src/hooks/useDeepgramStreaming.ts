import { useState, useRef, useCallback, useEffect } from 'react';

interface UseDeepgramStreamingReturn {
  isConnected: boolean;
  isConnecting: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  sendAudio: (data: ArrayBuffer | Blob) => void;
  clearTranscript: () => void;
  isReady: () => boolean; // Función para verificar si está listo de forma síncrona
}

// Construir URL del WebSocket usando la misma URL base que la API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const getWebSocketUrl = (): string => {
  // Convertir URL HTTP/HTTPS a WS/WSS
  const url = new URL(API_BASE_URL);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  // Limpiar pathname (remover trailing slash) y agregar endpoint
  const basePath = url.pathname.replace(/\/$/, '');
  return `${protocol}//${url.host}${basePath}/api/transcriptions/stream`;
};

const WS_URL = getWebSocketUrl();

export const useDeepgramStreaming = (): UseDeepgramStreamingReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const isConnectedRef = useRef(false); // Ref para verificación síncrona
  
  const connect = useCallback(async (): Promise<boolean> => {
    // Verificar usando ref para evitar problemas de estado asíncrono
    if (wsRef.current?.readyState === WebSocket.OPEN && isConnectedRef.current) {
      return true;
    }
    
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    isConnectedRef.current = false; // Reset ref
    setIsConnecting(true);
    setError(null);
    setIsConnected(false);
    
    return new Promise((resolve) => {
      let resolved = false;
      let connectionTimeout: ReturnType<typeof setTimeout> | null = null;
      
      try {
        const ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
          // Waiting for "connected" message from server
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'connected':
                isConnectedRef.current = true;
                setIsConnected(true);
                setIsConnecting(false);
                if (connectionTimeout) clearTimeout(connectionTimeout);
                if (!resolved) {
                  resolved = true;
                  resolve(true);
                }
                break;
                
              case 'transcript':
                if (data.is_final) {
                  setTranscript(prev => {
                    const newText = data.text?.trim() || '';
                    if (!newText) return prev;
                    return prev ? `${prev} ${newText}` : newText;
                  });
                  setInterimTranscript('');
                } else {
                  setInterimTranscript(data.text || '');
                }
                break;
                
              case 'error':
                setError(data.message);
                setIsConnecting(false);
                if (connectionTimeout) clearTimeout(connectionTimeout);
                if (!resolved) {
                  resolved = true;
                  resolve(false);
                }
                break;
            }
          } catch (e) {
            console.error('Error parsing WebSocket message:', e);
          }
        };
        
        ws.onerror = () => {
          setError('WebSocket connection error');
          setIsConnecting(false);
          if (connectionTimeout) clearTimeout(connectionTimeout);
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        };
        
        ws.onclose = () => {
          setIsConnected(false);
          setIsConnecting(false);
          if (wsRef.current === ws) {
            wsRef.current = null;
          }
          if (connectionTimeout) clearTimeout(connectionTimeout);
          
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        };
        
        wsRef.current = ws;
        
        // Timeout for connection (15 seconds)
        connectionTimeout = setTimeout(() => {
          if (!resolved) {
            setError('Connection timeout');
            setIsConnecting(false);
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
              ws.close();
            }
            resolved = true;
            resolve(false);
          }
        }, 15000);
        
      } catch (e) {
        console.error('Error creating WebSocket:', e);
        setError('Failed to create WebSocket connection');
        setIsConnecting(false);
        resolve(false);
      }
    });
  }, []);
  
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
      }
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    isConnectedRef.current = false;
    setIsConnected(false);
    setInterimTranscript('');
  }, []);
  
  const sendAudio = useCallback((data: ArrayBuffer | Blob) => {
    // Verificar estado del WebSocket usando ref para verificación síncrona
    const ws = wsRef.current;
    const wsReady = ws && ws.readyState === WebSocket.OPEN;
    const connected = isConnectedRef.current; // Usar ref en lugar de state
    
    if (!wsReady) {
      console.warn('⚠️ Cannot send audio: WebSocket not ready', {
        wsExists: !!ws,
        readyState: ws?.readyState,
        OPEN: WebSocket.OPEN,
        connected,
        expectedState: 'OPEN (1)'
      });
      return;
    }
    
    if (!connected) {
      console.warn('⚠️ Cannot send audio: Deepgram not connected (ref)', {
        connected,
        wsReady
      });
      return;
    }
    
    const sendData = async () => {
      try {
        let buffer: ArrayBuffer;
        
        if (data instanceof Blob) {
          buffer = await data.arrayBuffer();
        } else {
          buffer = data;
        }
        
        ws.send(buffer);
      } catch (error) {
        console.error('Error sending audio:', error);
      }
    };
    
    sendData();
  }, []); // No dependencias - usamos refs para verificación síncrona
  
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);
  
  // Función para verificar si está listo de forma síncrona (usa refs)
  const isReady = useCallback(() => {
    const wsReady = wsRef.current?.readyState === WebSocket.OPEN;
    const connected = isConnectedRef.current;
    return wsReady && connected;
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, []);
  
  return {
    isConnected,
    isConnecting,
    transcript,
    interimTranscript,
    error,
    connect,
    disconnect,
    sendAudio,
    clearTranscript,
    isReady,
  };
};
