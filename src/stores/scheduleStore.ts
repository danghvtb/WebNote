import { create } from 'zustand';
import type { ScheduleBlock, CustomUserTask, WorkCategory, ScheduleSearchFilter } from '../types';
import { todayDate } from '../utils';
import {
  getAllScheduleBlocks,
  getScheduleBlocksByRange,
  saveScheduleBlock,
  deleteScheduleBlock,
  toggleScheduleBlockCompleted,
  filterScheduleBlocks,
} from '../services/database/scheduleRepository';
import {
  getAllCategories,
  saveWorkCategory,
  deleteWorkCategory,
  getAllCustomTasks,
  saveCustomTask,
  deleteCustomTask,
  toggleCustomTaskStatus,
} from '../services/database/taskRepository';

export type ScheduleViewMode = 'day' | 'week' | 'month';

export const DEFAULT_SEARCH_FILTER: ScheduleSearchFilter = {
  keyword: '',
  categoryId: 'all',
  taskSource: 'all',
  datePreset: 'all',
  status: 'all',
  priority: 'all',
};

interface ScheduleState {
  // State
  blocks: ScheduleBlock[];
  customTasks: CustomUserTask[];
  categories: WorkCategory[];
  selectedDate: string;           // "YYYY-MM-DD"
  viewMode: ScheduleViewMode;
  isLoading: boolean;
  activeTab: 'notes' | 'schedule'; // Global top-level active tab navigation
  dailyBriefingOpen: boolean;
  addModalOpen: boolean;
  taskManagerModalOpen: boolean;
  filterBarOpen: boolean;
  searchFilter: ScheduleSearchFilter;
  aiExplanation?: string;
  editingBlock: ScheduleBlock | null;
  selectedTimeSlot: { date: string; startTime?: string } | null;

  // Actions
  setActiveTab: (tab: 'notes' | 'schedule') => void;
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: ScheduleViewMode) => void;
  setDailyBriefingOpen: (open: boolean) => void;
  setTaskManagerModalOpen: (open: boolean) => void;
  setFilterBarOpen: (open: boolean) => void;
  setSearchFilter: (filterUpdate: Partial<ScheduleSearchFilter>, aiExp?: string) => void;
  resetSearchFilter: () => void;
  getFilteredBlocks: () => ScheduleBlock[];
  setAddModalOpen: (open: boolean, editingBlock?: ScheduleBlock | null, timeSlot?: { date: string; startTime?: string } | null) => void;

  // Async CRUD
  loadBlocksForRange: (startDate: string, endDate: string) => Promise<void>;
  loadAllBlocks: () => Promise<void>;
  loadTasksAndCategories: () => Promise<void>;
  addOrUpdateBlock: (blockData: Omit<ScheduleBlock, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<ScheduleBlock>;
  removeBlock: (id: string) => Promise<void>;
  toggleBlock: (id: string) => Promise<void>;

  // Custom Tasks & Categories CRUD
  addOrUpdateTask: (taskData: Omit<CustomUserTask, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<CustomUserTask>;
  removeTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string) => Promise<void>;
  addOrUpdateCategory: (catData: Omit<WorkCategory, 'id' | 'createdAt'> & { id?: string }) => Promise<WorkCategory>;
  removeCategory: (id: string) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  blocks: [],
  customTasks: [],
  categories: [],
  selectedDate: todayDate(),
  viewMode: 'week',
  isLoading: false,
  activeTab: 'notes',
  dailyBriefingOpen: false,
  addModalOpen: false,
  taskManagerModalOpen: false,
  filterBarOpen: false,
  searchFilter: DEFAULT_SEARCH_FILTER,
  aiExplanation: undefined,
  editingBlock: null,
  selectedTimeSlot: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setDailyBriefingOpen: (open) => set({ dailyBriefingOpen: open }),
  setTaskManagerModalOpen: (open) => set({ taskManagerModalOpen: open }),
  setFilterBarOpen: (open) => set({ filterBarOpen: open }),
  setSearchFilter: (filterUpdate, aiExp) =>
    set((state) => ({
      searchFilter: { ...state.searchFilter, ...filterUpdate },
      ...(aiExp !== undefined ? { aiExplanation: aiExp } : {}),
    })),
  resetSearchFilter: () =>
    set({
      searchFilter: DEFAULT_SEARCH_FILTER,
      aiExplanation: undefined,
    }),
  getFilteredBlocks: () => {
    return filterScheduleBlocks(get().blocks, get().searchFilter);
  },
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

  loadTasksAndCategories: async () => {
    try {
      const [tasks, cats] = await Promise.all([getAllCustomTasks(), getAllCategories()]);
      set({ customTasks: tasks, categories: cats });
    } catch (err) {
      console.error('[ScheduleStore] Load tasks & categories failed:', err);
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

  addOrUpdateTask: async (taskData) => {
    const saved = await saveCustomTask(taskData);
    set((state) => {
      const exists = state.customTasks.some((t) => t.id === saved.id);
      const newTasks = exists
        ? state.customTasks.map((t) => (t.id === saved.id ? saved : t))
        : [saved, ...state.customTasks];
      return { customTasks: newTasks };
    });
    return saved;
  },

  removeTask: async (id) => {
    await deleteCustomTask(id);
    set((state) => ({
      customTasks: state.customTasks.filter((t) => t.id !== id),
    }));
  },

  toggleTaskStatus: async (id) => {
    const updated = await toggleCustomTaskStatus(id);
    if (updated) {
      set((state) => ({
        customTasks: state.customTasks.map((t) => (t.id === id ? updated : t)),
      }));
    }
  },

  addOrUpdateCategory: async (catData) => {
    const saved = await saveWorkCategory(catData);
    set((state) => {
      const exists = state.categories.some((c) => c.id === saved.id);
      const newCats = exists
        ? state.categories.map((c) => (c.id === saved.id ? saved : c))
        : [...state.categories, saved];
      return { categories: newCats };
    });
    return saved;
  },

  removeCategory: async (id) => {
    await deleteWorkCategory(id);
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    }));
  },
}));
