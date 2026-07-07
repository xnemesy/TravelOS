import React from 'react';
import { View } from 'react-native';
import { Skeleton } from './Skeleton';

export const SkeletonTimeline = () => {
  return (
    <View className="px-5 py-6 flex-1">
      <Skeleton className="w-40 h-8 rounded-lg mb-6" />
      
      {/* Timeline item 1 */}
      <View className="flex-row mb-6">
        <View className="w-16 items-center mr-4">
          <Skeleton className="w-12 h-6 rounded-md mb-2" />
        </View>
        <View className="flex-1">
          <Skeleton className="w-full h-24 rounded-2xl" />
        </View>
      </View>

      {/* Timeline item 2 */}
      <View className="flex-row mb-6">
        <View className="w-16 items-center mr-4">
          <Skeleton className="w-12 h-6 rounded-md mb-2" />
        </View>
        <View className="flex-1">
          <Skeleton className="w-full h-32 rounded-2xl" />
        </View>
      </View>
      
      {/* Timeline item 3 */}
      <View className="flex-row">
        <View className="w-16 items-center mr-4">
          <Skeleton className="w-12 h-6 rounded-md mb-2" />
        </View>
        <View className="flex-1">
          <Skeleton className="w-full h-20 rounded-2xl" />
        </View>
      </View>
    </View>
  );
};
