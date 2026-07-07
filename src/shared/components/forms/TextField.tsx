import React, { useState } from 'react';
import { View, TextInput, TextInputProps, Pressable, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../Typography';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerClassName?: string;
  inputClassName?: string;
  disabled?: boolean;
}

export const TextField = React.forwardRef<TextInput, TextFieldProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      onRightIconPress,
      containerClassName = '',
      inputClassName = '',
      disabled = false,
      onFocus,
      onBlur,
      multiline = false,
      secureTextEntry = false,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const handleFocus = (e: any) => {
      setIsFocused(true);
      if (onFocus) onFocus(e);
    };

    const handleBlur = (e: any) => {
      setIsFocused(false);
      if (onBlur) onBlur(e);
    };

    const isSecure = secureTextEntry && !isPasswordVisible;

    // Configurazione stili dinamici del bordo e del background
    let borderClass = 'border-gray-200';
    let bgClass = 'bg-gray-50';

    if (disabled) {
      bgClass = 'bg-gray-100 opacity-60';
    } else if (error) {
      borderClass = 'border-red-500';
      bgClass = 'bg-red-50/10';
    } else if (isFocused) {
      borderClass = 'border-gray-900';
      bgClass = 'bg-white';
    }

    return (
      <View className={`mb-4 w-full ${containerClassName}`}>
        {/* Label superiore opzionale */}
        {label && (
          <Typography
            variant="captionSemibold"
            className="text-gray-500 mb-2 uppercase tracking-wider font-bold"
          >
            {label}
          </Typography>
        )}

        {/* Input Wrapper Contenitore */}
        <View
          className={`border rounded-2xl px-4 flex-row shadow-sm transition-all duration-200 ${borderClass} ${bgClass} ${
            multiline ? 'py-3.5 items-start min-h-[120px]' : 'items-center h-[54px]'
          }`}
        >
          {/* Icona sinistra */}
          {leftIcon && !multiline && (
            <Ionicons
              name={leftIcon}
              size={18}
              color={error ? '#EF4444' : isFocused ? '#111827' : '#6B7280'}
              className="mr-3"
            />
          )}

          {/* TextInput Nativo */}
          <TextInput
            ref={ref}
            multiline={multiline}
            secureTextEntry={isSecure}
            editable={!disabled}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholderTextColor="#9CA3AF"
            textAlignVertical={multiline ? 'top' : 'center'}
            className={`flex-1 text-gray-900 ${
              multiline
                ? 'text-base text-top'
                : 'text-lg font-bold h-full py-0'
            } ${inputClassName}`}
            style={
              multiline
                ? { textAlignVertical: 'top', paddingTop: Platform.OS === 'ios' ? 0 : 2 }
                : { textAlignVertical: 'center', height: '100%', paddingVertical: 0 }
            }
            {...props}
          />

          {/* Icona destra (o toggle password) */}
          {secureTextEntry ? (
            <Pressable
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              className="p-1 -mr-1"
            >
              <Ionicons
                name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#6B7280"
              />
            </Pressable>
          ) : rightIcon && !multiline ? (
            <Pressable
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
              className="p-1 -mr-1"
            >
              <Ionicons name={rightIcon} size={18} color="#9CA3AF" />
            </Pressable>
          ) : null}
        </View>

        {/* Messaggio d'errore o Helper text inferiore */}
        {error ? (
          <Typography variant="caption" className="text-red-500 mt-1.5 ml-1 font-medium">
            {error}
          </Typography>
        ) : helperText ? (
          <Typography variant="caption" className="text-gray-400 mt-1.5 ml-1">
            {helperText}
          </Typography>
        ) : null}
      </View>
    );
  }
);

TextField.displayName = 'TextField';
