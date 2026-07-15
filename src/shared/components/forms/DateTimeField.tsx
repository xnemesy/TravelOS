import React, { useState } from 'react';
import { View, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Typography } from '../Typography';

export interface DateTimeFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  error?: string;
}

const formatDateTime = (date: Date) =>
  date.toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Campo data+ora riusabile. Android non supporta `mode="datetime"` in un
 * unico dialog nativo — flusso a due passi (data, poi ora) che ricompone un
 * solo `Date`. iOS supporta `mode="datetime"` nativamente, reso inline come
 * già fa `BasicInfoStep` per le date semplici.
 */
export const DateTimeField: React.FC<DateTimeFieldProps> = ({ label, value, onChange, minimumDate, error }) => {
  const [androidStep, setAndroidStep] = useState<'date' | 'time' | null>(null);
  const [pendingDate, setPendingDate] = useState<Date>(value);

  const openAndroidFlow = () => {
    setPendingDate(value);
    setAndroidStep('date');
  };

  const handleAndroidDatePicked = (_: any, date?: Date) => {
    if (!date) {
      setAndroidStep(null);
      return;
    }
    const merged = new Date(pendingDate);
    merged.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setPendingDate(merged);
    setAndroidStep('time');
  };

  const handleAndroidTimePicked = (_: any, date?: Date) => {
    setAndroidStep(null);
    if (!date) return;
    const merged = new Date(pendingDate);
    merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
    onChange(merged);
  };

  return (
    <View className="mb-4 w-full">
      <Typography variant="captionSemibold" className="text-gray-500 mb-2 uppercase tracking-wider font-bold">
        {label}
      </Typography>

      {Platform.OS === 'android' ? (
        <>
          <Pressable
            onPress={openAndroidFlow}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${formatDateTime(value)}`}
            accessibilityHint="Apre il selettore di data e ora"
            className={`border rounded-2xl px-4 h-[54px] justify-center ${
              error ? 'border-red-500 bg-red-50/10' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <Typography variant="bodySemibold" className="text-gray-900">{formatDateTime(value)}</Typography>
          </Pressable>
          {androidStep === 'date' && (
            <DateTimePicker
              value={pendingDate}
              mode="date"
              display="default"
              minimumDate={minimumDate}
              onChange={handleAndroidDatePicked}
            />
          )}
          {androidStep === 'time' && (
            <DateTimePicker value={pendingDate} mode="time" display="default" onChange={handleAndroidTimePicked} />
          )}
        </>
      ) : (
        <View
          className={`border rounded-2xl px-2 items-start ${
            error ? 'border-red-500 bg-red-50/10' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <DateTimePicker
            value={value}
            mode="datetime"
            display="default"
            minimumDate={minimumDate}
            onChange={(_, date) => date && onChange(date)}
          />
        </View>
      )}

      {error ? (
        <Typography variant="caption" className="text-red-500 mt-1.5 ml-1 font-medium">{error}</Typography>
      ) : null}
    </View>
  );
};
