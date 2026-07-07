import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'undo';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  onUndo?: () => void;
  duration?: number;
}

interface ToastState {
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  hideToast: (id: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  undo: (message: string, onUndo: () => void) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    
    // Auto-hide after duration
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, toast.duration || 3000);
  },
  hideToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  success: (message) => useToastStore.getState().showToast({ type: 'success', message }),
  error: (message) => useToastStore.getState().showToast({ type: 'error', message, duration: 4000 }),
  warning: (message) => useToastStore.getState().showToast({ type: 'warning', message }),
  info: (message) => useToastStore.getState().showToast({ type: 'info', message }),
  undo: (message, onUndo) => useToastStore.getState().showToast({ type: 'undo', message, onUndo, duration: 5000 }),
}));
