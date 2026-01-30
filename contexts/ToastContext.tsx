import { Toast, type ToastMessage } from '@/components/Toast';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';

interface ToastContextValue {
  show: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;
function nextId() {
  return String(++toastId);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);

  const show = useCallback((text: string) => {
    setMessage({ id: nextId(), text });
  }, []);

  const onDismiss = useCallback((id: string) => {
    setMessage((m) => (m?.id === id ? null : m));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.toastWrap} pointerEvents="box-none">
          <Toast message={message} onDismiss={onDismiss} />
        </View>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { show: () => {} };
  return ctx;
}

const styles = StyleSheet.create({
  toastWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});
