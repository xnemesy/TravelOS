import React from 'react';
import { View } from 'react-native';
import { Skeleton } from './Skeleton';

export const SkeletonHero = () => {
  return (
    <View className="pt-20 pb-8 px-5 bg-green-900 rounded-b-[40px]">
      <View className="flex-row justify-between items-center mb-6">
        <Skeleton className="w-10 h-10 rounded-full bg-white/20" />
        <Skeleton className="w-10 h-10 rounded-full bg-white/20" />
      </View>
      <Skeleton className="w-16 h-16 rounded-2xl mb-4 bg-white/20" />
      <Skeleton className="w-3/4 h-10 rounded-xl mb-3 bg-white/20" />
      <Skeleton className="w-1/2 h-6 rounded-lg bg-white/20" />
    </View>
  );
};
