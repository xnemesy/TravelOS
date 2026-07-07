import React from 'react';
import { Text, TextProps } from 'react-native';

export type TypographyVariant = 
  | 'h1' 
  | 'h2' 
  | 'h3' 
  | 'body' 
  | 'bodySemibold' 
  | 'caption' 
  | 'captionMedium'
  | 'captionSemibold'
  | 'overline';

interface TypographyProps extends TextProps {
  variant?: TypographyVariant;
  color?: 'primary' | 'secondary' | 'accent' | 'inverse' | 'danger';
  align?: 'left' | 'center' | 'right';
}

export const Typography: React.FC<TypographyProps> = ({ 
  variant = 'body', 
  color = 'primary', 
  align = 'left',
  className,
  style,
  children,
  ...props 
}) => {
  let variantClasses = '';
  switch (variant) {
    case 'h1':
      variantClasses = 'text-4xl font-bold tracking-tight leading-tight';
      break;
    case 'h2':
      variantClasses = 'text-3xl font-bold tracking-tight';
      break;
    case 'h3':
      variantClasses = 'text-xl font-semibold tracking-tight';
      break;
    case 'body':
      variantClasses = 'text-base font-normal leading-relaxed';
      break;
    case 'bodySemibold':
      variantClasses = 'text-base font-semibold leading-relaxed';
      break;
    case 'caption':
      variantClasses = 'text-sm font-normal';
      break;
    case 'captionMedium':
      variantClasses = 'text-sm font-medium';
      break;
    case 'captionSemibold':
      variantClasses = 'text-sm font-semibold';
      break;
    case 'overline':
      variantClasses = 'text-xs font-semibold uppercase tracking-widest';
      break;
  }

  let colorClasses = '';
  switch (color) {
    case 'primary':
      colorClasses = 'text-text-primary';
      break;
    case 'secondary':
      colorClasses = 'text-text-secondary';
      break;
    case 'accent':
      colorClasses = 'text-primary';
      break;
    case 'inverse':
      colorClasses = 'text-white';
      break;
    case 'danger':
      colorClasses = 'text-red-500';
      break;
  }
  
  let alignClasses = '';
  switch (align) {
    case 'center': alignClasses = 'text-center'; break;
    case 'right': alignClasses = 'text-right'; break;
  }

  return (
    <Text 
      className={`${variantClasses} ${colorClasses} ${alignClasses} ${className || ''}`}
      style={style}
      {...props}
    >
      {children}
    </Text>
  );
};
