// ============================================================
// MyNotes — Schedule Store (Zustand)
// State management for Smart Schedule & Time Blocking
// ============================================================

import { create } from 'zustand';
import type { ScheduleBlock } from '../types';
import { todayDate } from '../utils';
import {
  getAllScheduleBlocks,
  getScheduleBlocksByRange,
  saveScheduleBlock,
  deleteScheduleBlock,
  toggleScheduleBlockCompleted,
} from '../services/database/scheduleRepository';

export type ScheduleViewMode = 'day' | 'week' | 'month';

interface ScheduleState {
  // State
  blocks: ScheduleBlock[];
  selectedDate: string;           // "YYYY-MM-DD"
  viewMode: ScheduleViewMode;
  isLoading: boolean;
  activeTab: 'notes' | 'schedule'; // Global top-level active tab navigation
  dailyBriefingOpen: boolean;
  addModalOpen: boolean;
  editingBlock: ScheduleBlock | null;
  selectedTimeSlot: { date: string; startTime?: string } | null;

  // Actions
  setActiveTab: (tab: 'notes' | 'schedule') => void;
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: ScheduleViewMode) => void;
  setDailyBriefingOpen: (open: boolean) => void;
  setAddModalOpen: (open: boolean, editingBlock?: ScheduleBlock | null, timeSlot?: { date: string; startTime?: string } | null) => void;

  // Async CRUD
  loadBlocksForRange: (startDate: string, endDate: string) => Promise<void>;
  loadAllBlocks: () => Promise<void>;
  addOrUpdateBlock: (blockData: Omit<ScheduleBlock, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<ScheduleBlock>;
  removeBlock: (id: string) => Promise<void>;
  toggleBlock: (id: string) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  blocks: [],
  selectedDate: todayDate(),
  viewMode: 'week',
  isLoading: false,
  activeTab: 'notes',
  dailyBriefingOpen: false,
  addModalOpen: false,
  editingBlock: null,
  selectedTimeSlot: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setDailyBriefingOpen: (open) => set({ dailyBriefingOpen: open }),
  setAddModalOpen: (open, editingBlock = null, timeSlot = null) =>
    set({
      addModalOpen: open,
      editingBlock,
      selectedTimeSlot: timeSlot,
    }),

  loadBlocksForRange: async (startDate, endDate) => {
    set({ isLoading: true });
    try {
      const blocks = await getScheduleBlocksByRange(startDate, endDate);
      set({ blocks, isLoading: false });
    } catch (err) {
      console.error('[ScheduleStore] Load range failed:', err);
      set({ isLoading: false });
    }
  },

  loadAllBlocks: async () => {
    set({ isLoading: true });
    try {
      const blocks = await getAllScheduleBlocks();
      set({ blocks, isLoading: false });
    } catch (err) {
      console.error('[ScheduleStore] Load all blocks failed:', err);
      set({ isLoading: false });
    }
  },

  addOrUpdateBlock: async (blockData) => {
    const saved = await saveScheduleBlock(blockData);
    set((state) => {
      const exists = state.blocks.some((b) => b.id === saved.id);
      const newBlocks = exists
        ? state.blocks.map((b) => (b.id === saved.id ? saved : b))
        : [...state.blocks, saved];
      return { blocks: newBlocks };
    });
    return saved;
  },

  removeBlock: async (id) => {
    await deleteScheduleBlock(id);
    set((state) => ({
      blocks: state.blocks.filter((b) => b.id !== id),
    }));
  },

  toggleBlock: async (id) => {
    const updated = await toggleScheduleBlockCompleted(id);
    if (updated) {
      set((state) => ({
        blocks: state.blocks.map((b) => (b.id === id ? updated : b)),
      }));
    }
  },
}));
