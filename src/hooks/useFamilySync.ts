import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlertLevel, FamilyAlertEvent, FamilySyncRole } from '../types/safeai';

interface SavedFamilyConfig {
  code: string;
  role: FamilySyncRole;
  name: string;
}

export function useFamilySync(userPhone: string, defaultDisplayName: string) {
  const storageKey = `safeai_family_sync_v2_${userPhone || 'guest'}`;

  const [savedConfig, setSavedConfig] = useState<SavedFamilyConfig | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as SavedFamilyConfig) : null;
    } catch {
      return null;
    }
  });

  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [roomCode, setRoomCode] = useState<string>(savedConfig?.code ?? '');
  const [role, setRole] = useState<FamilySyncRole>(savedConfig?.role ?? 'parent');
  const [memberName, setMemberName] = useState<string>(
    savedConfig?.name || defaultDisplayName || 'Thành viên SafeAI'
  );
  const [parentCount, setParentCount] = useState<number>(0);
  const [childCount, setChildCount] = useState<number>(0);
  const [alerts, setAlerts] = useState<FamilyAlertEvent[]>([]);
  const [latestIncomingAlert, setLatestIncomingAlert] = useState<FamilyAlertEvent | null>(null);
  const [syncError, setSyncError] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const intentConfigRef = useRef<SavedFamilyConfig | null>(savedConfig);
  const pendingActionRef = useRef<{
    type: 'family:create' | 'family:join';
    code?: string;
    role: FamilySyncRole;
    name: string;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as SavedFamilyConfig) : null;
      setSavedConfig(parsed);
      intentConfigRef.current = parsed;
      setRoomCode(parsed?.code ?? '');
      setRole(parsed?.role ?? 'parent');
      setMemberName(parsed?.name || defaultDisplayName || 'Thành viên SafeAI');
    } catch {
      // ignore
    }
  }, [storageKey, defaultDisplayName]);

  const cleanupTimers = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const connectSocket = useCallback(
    (initialAction?: {
      type: 'family:create' | 'family:join';
      code?: string;
      role: FamilySyncRole;
      name: string;
    }) => {
      cleanupTimers();
      if (initialAction) {
        pendingActionRef.current = initialAction;
      }

      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        if (wsRef.current.readyState === WebSocket.OPEN && pendingActionRef.current) {
          wsRef.current.send(JSON.stringify(pendingActionRef.current));
          pendingActionRef.current = null;
        }
        return;
      }

      setStatus('connecting');
      setSyncError('');
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/family-ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        const action = pendingActionRef.current ?? (
          intentConfigRef.current
            ? {
                type: 'family:join' as const,
                code: intentConfigRef.current.code,
                role: intentConfigRef.current.role,
                name: intentConfigRef.current.name,
              }
            : null
        );
        pendingActionRef.current = null;
        if (action) {
          ws.send(JSON.stringify(action));
        }

        heartbeatTimerRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'family:ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as Record<string, unknown>;
          const type = String(msg.type || '');

          if (type === 'family:joined' || type === 'family:state') {
            const nextCode = String(msg.code || '');
            setStatus('connected');
            setRoomCode(nextCode);
            setParentCount(Number(msg.parentCount ?? 0));
            setChildCount(Number(msg.childCount ?? 0));
            if (Array.isArray(msg.alerts)) {
              setAlerts(msg.alerts as FamilyAlertEvent[]);
            }
            if (type === 'family:joined') {
              const nextRole: FamilySyncRole = msg.role === 'child' ? 'child' : 'parent';
              const nextName = String(msg.name || defaultDisplayName || 'Thành viên SafeAI');
              const cfg: SavedFamilyConfig = { code: nextCode, role: nextRole, name: nextName };
              intentConfigRef.current = cfg;
              setSavedConfig(cfg);
              setRole(nextRole);
              setMemberName(nextName);
              try {
                localStorage.setItem(storageKey, JSON.stringify(cfg));
              } catch {
                // ignore
              }
            }
          } else if (type === 'family:alert_received') {
            const alertObj = msg.alert as FamilyAlertEvent | undefined;
            if (Array.isArray(msg.alerts)) {
              setAlerts(msg.alerts as FamilyAlertEvent[]);
            } else if (alertObj) {
              setAlerts((prev) =>
                prev.some((a) => a.id === alertObj.id) ? prev : [alertObj, ...prev].slice(0, 20)
              );
            }
            if (alertObj) {
              setLatestIncomingAlert(alertObj);
            }
          } else if (type === 'family:error') {
            setSyncError(String(msg.error || 'Không kết nối được phòng gia đình.'));
          } else if (type === 'family:left') {
            setStatus('disconnected');
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        setSyncError('Kết nối đồng bộ gia đình tạm gián đoạn.');
      };

      ws.onclose = () => {
        cleanupTimers();
        wsRef.current = null;
        setStatus('disconnected');
        if (intentConfigRef.current) {
          reconnectTimerRef.current = window.setTimeout(() => {
            if (intentConfigRef.current) {
              connectSocket();
            }
          }, 2500);
        }
      };
    },
    [cleanupTimers, defaultDisplayName, storageKey]
  );

  // Auto-connect on mount if saved room config exists
  useEffect(() => {
    if (savedConfig?.code) {
      connectSocket({
        type: 'family:join',
        code: savedConfig.code,
        role: savedConfig.role,
        name: savedConfig.name,
      });
    }
    return () => {
      cleanupTimers();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [storageKey]);

  const createRoom = useCallback(
    (selectedRole: FamilySyncRole, name: string) => {
      const cleanName = name.trim() || (selectedRole === 'parent' ? 'Bố/Mẹ' : 'Con/Cháu');
      connectSocket({
        type: 'family:create',
        role: selectedRole,
        name: cleanName,
      });
    },
    [connectSocket]
  );

  const joinRoom = useCallback(
    (codeInput: string, selectedRole: FamilySyncRole, name: string) => {
      const cleanCode = codeInput.replace(/\D/g, '').slice(0, 6);
      if (cleanCode.length !== 6) {
        setSyncError('Mã gia đình cần đúng 6 chữ số.');
        return;
      }
      const cleanName = name.trim() || (selectedRole === 'parent' ? 'Bố/Mẹ' : 'Con/Cháu');
      connectSocket({
        type: 'family:join',
        code: cleanCode,
        role: selectedRole,
        name: cleanName,
      });
    },
    [connectSocket]
  );

  const leaveRoom = useCallback(() => {
    intentConfigRef.current = null;
    pendingActionRef.current = null;
    setSavedConfig(null);
    setRoomCode('');
    setAlerts([]);
    setLatestIncomingAlert(null);
    setParentCount(0);
    setChildCount(0);
    cleanupTimers();
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'family:leave' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, [cleanupTimers, storageKey]);

  const sendFamilyAlert = useCallback(
    (payload: {
      id?: string;
      alertLevel: AlertLevel;
      scamType: string;
      summary: string;
      entitiesSummary?: string;
    }): boolean => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !roomCode) {
        return false;
      }
      wsRef.current.send(
        JSON.stringify({
          type: 'family:alert',
          ...payload,
        })
      );
      return true;
    },
    [roomCode]
  );

  const acknowledgeAlert = useCallback((alertId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'family:ack', alertId }));
    }
    setLatestIncomingAlert((prev) => (prev?.id === alertId ? null : prev));
  }, []);

  const dismissIncomingBanner = useCallback(() => {
    setLatestIncomingAlert(null);
  }, []);

  return {
    status,
    roomCode,
    role,
    memberName,
    parentCount,
    childCount,
    alerts,
    latestIncomingAlert,
    syncError,
    createRoom,
    joinRoom,
    leaveRoom,
    sendFamilyAlert,
    acknowledgeAlert,
    dismissIncomingBanner,
  };
}
