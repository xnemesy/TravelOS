import React from 'react';
import { View } from 'react-native';
import { SkeletonCard } from './SkeletonCard';

interface SkeletonListProps {
  count?: number;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({ count = 3 }) => {
  return (
    <View className="flex-1 px-5 pt-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
};
