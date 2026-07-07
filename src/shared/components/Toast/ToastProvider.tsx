import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore, ToastMessage } from '../../store/useToastStore';
import { Ionicons } from '@expo/vector-icons';

const ToastItem = ({ toast }: { toast: ToastMessage }) => {
  const { hideToast } = useToastStore();
  
  const getIconName = () => {
    switch (toast.type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'alert-circle';
      case 'warning': return 'warning';
      case 'info': return 'information-circle';
      case 'undo': return 'arrow-undo';
      default: return 'information-circle';
    }
  };

  const getIconColor = () => {
    switch (toast.type) {
      case 'success': return '#4A6741'; // Green
      case 'error': return '#EF4444'; // Red
      case 'warning': return '#F59E0B'; // Amber
      case 'info': return '#3B82F6'; // Blue
      case 'undo': return '#4B5563'; // Gray
      default: return '#4B5563';
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutDown.duration(300)}
      className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-2 flex-row items-center justify-between"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
      }}
    >
      <View className="flex-row items-center flex-1">
        <Ionicons name={getIconName()} size={24} color={getIconColor()} />
        <Text className="text-gray-800 ml-3 font-medium flex-1" numberOfLines={2}>
          {toast.message}
        </Text>
      </View>
      
      {toast.type === 'undo' && toast.onUndo ? (
        <TouchableOpacity 
          onPress={() => {
            toast.onUndo?.();
            hideToast(toast.id);
          }}
          className="ml-4 bg-gray-100 px-4 py-2 rounded-lg"
        >
          <Text className="text-gray-800 font-bold">Annulla</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => hideToast(toast.id)} className="ml-4 p-2">
          <Ionicons name="close" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

export const ToastProvider = () => {
  const { toasts } = useToastStore();
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View 
      className="absolute bottom-0 left-0 right-0 z-50 px-5 pointer-events-box-none"
      style={{ paddingBottom: insets.bottom + 20 }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </View>
  );
};
