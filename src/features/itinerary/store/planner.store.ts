import { create } from 'zustand';
import { MMKVAdapter } from '../../../core/storage/mmkv.adapter';

const localDb = new MMKVAdapter();
const PREF_KEY = 'planner_advanced_mode';

interface PlannerState {
  selectedDay: number;
  activeTab: 'library' | 'planner';
  isAdvancedMode: boolean;
  
  // Actions
  setSelectedDay: (day: number) => void;
  setActiveTab: (tab: 'library' | 'planner') => void;
  setAdvancedMode: (advanced: boolean) => void;
}

export const usePlannerStore = create<PlannerState>((set) => {
  // Leggi preferenza iniziale in modo sincrono se possibile, altrimenti usa false
  localDb.get(PREF_KEY).then(res => {
    if (res && typeof res === 'object' && 'data' in res) {
      set({ isAdvancedMode: (res as any).data === 'true' });
    } else if (typeof res === 'string') {
      set({ isAdvancedMode: res === 'true' });
    }
  });

  return {
    selectedDay: 1,
    activeTab: 'planner',
    isAdvancedMode: false, // fallback iniziale prima del reidratazione

    setSelectedDay: (day: number) => set({ selectedDay: day }),
    setActiveTab: (tab: 'library' | 'planner') => set({ activeTab: tab }),
    setAdvancedMode: (advanced: boolean) => {
      localDb.set(PREF_KEY, advanced ? 'true' : 'false');
      set({ isAdvancedMode: advanced });
    },
  };
});

