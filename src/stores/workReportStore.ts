import { create } from 'zustand';
import type { Project, WorkReport, WorkReportProjectEntry } from '../types';
import * as repo from '../services/database/repository';
import { queueSync } from '../services/sync/syncManager';

interface WorkReportState {
  projects: Project[];
  archivedProjects: Project[];
  selectedReportId: string | null;
  selectedDayId: string | null;
  dayReport: WorkReport | null;
  report: WorkReport | null;
  loading: boolean;
  saving: boolean;
  reportsVersion: number;
  loadProjects: () => Promise<void>;
  loadReportForDay: (dayId: string) => Promise<void>;
  openOrCreateReport: (dayId: string) => Promise<WorkReport>;
  updateReport: (updates: Partial<Pick<WorkReport, 'projectEntries' | 'issue' | 'solution' | 'nextWork'>>) => Promise<void>;
  deleteReport: (id?: string) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'description'>>) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;
  clearSelectedReport: () => void;
}

export const useWorkReportStore = create<WorkReportState>((set, get) => ({
  projects: [],
  archivedProjects: [],
  selectedReportId: null,
  selectedDayId: null,
  dayReport: null,
  report: null,
  loading: false,
  saving: false,
  reportsVersion: 0,

  loadProjects: async () => {
    const [projects, allProjects] = await Promise.all([repo.getProjects(), repo.getProjects(true)]);
    set({ projects, archivedProjects: allProjects.filter((project) => !!project.deletedAt) });
  },

  loadReportForDay: async (dayId) => {
    set({ loading: true, selectedDayId: dayId, dayReport: null });
    const report = await repo.getWorkReportByDay(dayId);
    set({ loading: false, dayReport: report || null });
  },

  openOrCreateReport: async (dayId) => {
    const existing = await repo.getWorkReportByDay(dayId);
    const report = await repo.createOrGetWorkReport(dayId);
    set((state) => ({ selectedDayId: dayId, selectedReportId: report.id, dayReport: report, report, reportsVersion: state.reportsVersion + (existing ? 0 : 1) }));
    if (!existing) await queueSync('create', 'work_report', report.id, report);
    return report;
  },

  updateReport: async (updates) => {
    const current = get().report;
    if (!current) return;
    set({ saving: true });
    const updated = await repo.updateWorkReport(current.id, updates);
    if (updated) {
      set({ report: updated, selectedReportId: updated.id });
      await queueSync('update', 'work_report', updated.id, updated);
    }
    set({ saving: false });
  },

  deleteReport: async (id) => {
    const reportId = id || get().selectedReportId;
    if (!reportId) return;
    await repo.deleteWorkReport(reportId);
    await queueSync('delete', 'work_report', reportId);
    set((state) => ({ selectedReportId: null, report: null, dayReport: null, reportsVersion: state.reportsVersion + 1 }));
  },

  createProject: async (name, description = '') => {
    const project = await repo.createProject(name, description);
    await queueSync('create', 'project', project.id, project);
    await get().loadProjects();
    return project;
  },

  updateProject: async (id, updates) => {
    const project = await repo.updateProject(id, updates);
    await queueSync('update', 'project', id, project);
    await get().loadProjects();
    const report = get().report;
    if (report) set({ report: await repo.getWorkReportByDay(report.dayId) || report });
  },

  archiveProject: async (id) => {
    const project = await repo.archiveProject(id);
    if (!project) return;
    await queueSync('delete', 'project', id, project);
    await get().loadProjects();
  },

  restoreProject: async (id) => {
    const project = await repo.restoreProject(id);
    if (!project) return;
    await queueSync('update', 'project', id, project);
    await get().loadProjects();
  },

  clearSelectedReport: () => set({ selectedReportId: null, report: null }),
}));

export type { WorkReportProjectEntry };
