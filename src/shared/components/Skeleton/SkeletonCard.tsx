import React from 'react';
import { View } from 'react-native';
import { Skeleton } from './Skeleton';

export const SkeletonCard = () => {
  return (
    <View className="bg-white rounded-3xl mb-6 border border-gray-100 shadow-sm overflow-hidden p-4">
      <Skeleton className="w-full h-48 rounded-2xl mb-4" />
      <View className="flex-row items-center mb-3">
        <Skeleton className="w-16 h-6 rounded-full mr-2" />
        <Skeleton className="w-12 h-6 rounded-full" />
      </View>
      <Skeleton className="w-3/4 h-8 rounded-lg mb-2" />
      <Skeleton className="w-1/2 h-4 rounded-lg mb-4" />
      <View className="flex-row justify-between items-center mt-2 pt-4 border-t border-gray-50">
        <Skeleton className="w-20 h-6 rounded-md" />
        <Skeleton className="w-24 h-10 rounded-xl" />
      </View>
    </View>
  );
};
