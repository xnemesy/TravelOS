import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../shared/components/Typography';
import { PlannerValidationWarning } from '../../../domain/trip/engine/planner.types';

interface Props {
  warnings: PlannerValidationWarning[];
}

export const SmartValidationBanner: React.FC<Props> = ({ warnings }) => {
  if (!warnings || warnings.length === 0) return null;

  return (
    <View className="mb-6 gap-3">
      {warnings.map((warning) => {
        let bgColor = 'bg-amber-50';
        let borderColor = 'border-amber-200';
        let iconColor = '#F59E0B';
        let iconName: any = 'warning';

        if (warning.type === 'closing_time') {
          bgColor = 'bg-red-50';
          borderColor = 'border-red-200';
          iconColor = '#EF4444';
          iconName = 'time';
        } else if (warning.type === 'long_distance') {
          iconName = 'compass';
        }

        return (
          <View
            key={warning.id}
            className={`${bgColor} border ${borderColor} rounded-2xl p-4 flex-row items-start shadow-sm`}
          >
            <View className="w-8 h-8 rounded-full bg-white/80 items-center justify-center mr-3 mt-0.5">
              <Ionicons name={iconName} size={18} color={iconColor} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between mb-1">
                <Typography variant="bodySemibold" className="text-gray-900">
                  {warning.title}
                </Typography>
                <Typography variant="caption" className="text-gray-400">Smart Validation</Typography>
              </View>
              <Typography variant="caption" className="text-gray-700 leading-snug mb-1.5">
                {warning.message}
              </Typography>
              {warning.suggestion && (
                <View className="bg-white/60 p-2 rounded-xl mt-1 border border-white">
                  <Typography variant="captionSemibold" className="text-gray-800">
                    💡 Suggerimento: {warning.suggestion}
                  </Typography>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};
