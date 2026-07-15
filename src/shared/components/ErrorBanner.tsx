import React from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Typography } from './Typography';

interface ErrorBannerProps {
  message: string;
  className?: string;
}

/**
 * Banner d'errore rosso — estratto perché duplicato identico nel wizard e
 * negli screen add/edit di Transport e Accommodation (5 punti). Animato in
 * ingresso/uscita (coerente con `EmptyState`, che già usa lo stesso
 * pattern Reanimated) invece di comparire/sparire di scatto.
 */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, className = 'mx-5 mt-4' }) => (
  <Animated.View
    entering={FadeIn.duration(200)}
    exiting={FadeOut.duration(150)}
    className={`bg-red-50 border border-red-200 p-3 rounded-2xl ${className}`}
    accessibilityRole="alert"
    accessibilityLiveRegion="polite"
  >
    <Typography variant="captionMedium" className="text-red-600">{message}</Typography>
  </Animated.View>
);
