import { create } from 'zustand';
import type { Project, WorkReport, WorkReportProjectEntry } from '../types';
import * as repo from '../services/database/repository';
import { queueSync } from '../services/sync/syncManager';
import { useNotesStore } from './notesStore';

interface WorkReportState {
  projects: Project[];
  archivedProjects: Project[];
  reports: WorkReport[];
  selectedReportId: string | null;
  selectedDayId: string | null;
  dayReport: WorkReport | null;
  report: WorkReport | null;
  loading: boolean;
  saving: boolean;
  reportsVersion: number;
  loadProjects: () => Promise<void>;
  loadReports: () => Promise<void>;
  loadReportForDay: (dayId: string) => Promise<void>;
  openOrCreateReport: (dayId: string) => Promise<WorkReport>;
  openReportById: (id: string) => Promise<WorkReport | undefined>;
  updateReport: (updates: Partial<Pick<WorkReport, 'projectEntries' | 'issue' | 'solution' | 'nextWork'>>) => Promise<void>;
  copyPreviousReport: () => Promise<boolean>;
  createNextReportFromCurrent: () => Promise<boolean>;
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
  reports: [],
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

  loadReports: async () => {
    const reports = await repo.getAllWorkReports();
    set({ reports });
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
    if (!existing) set((state) => ({ reports: [...state.reports, report] }));
    if (!existing) await queueSync('create', 'work_report', report.id, report);
    return report;
  },

  openReportById: async (id) => {
    const report = await repo.getWorkReportById(id);
    if (!report) return undefined;
    await useNotesStore.getState().selectDay(report.dayId);
    useNotesStore.getState().clearPageSelection();
    set({ selectedDayId: report.dayId, selectedReportId: report.id, dayReport: report, report });
    return report;
  },

  updateReport: async (updates) => {
    const current = get().report;
    if (!current) return;
    set({ saving: true });
    const updated = await repo.updateWorkReport(current.id, updates);
    if (updated) {
      set((state) => ({ report: updated, selectedReportId: updated.id, reports: state.reports.map((item) => item.id === updated.id ? updated : item) }));
      await queueSync('update', 'work_report', updated.id, updated);
    }
    set({ saving: false });
  },

  copyPreviousReport: async () => {
    const current = get().report;
    if (!current) return false;
    const days = useNotesStore.getState().days;
    const currentDay = days.find((day) => day.id === current.dayId);
    const currentDate = currentDay?.date || current.dayId.replace(/^day_/, '');
    const reports = await repo.getAllWorkReports();
    const candidates = reports.filter((report) => report.id !== current.id && report.dayId !== current.dayId);
    const previous = candidates
      .map((report) => ({ report, date: days.find((day) => day.id === report.dayId)?.date || report.dayId.replace(/^day_/, '') }))
      .filter((item) => item.date < currentDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.report;
    if (!previous) return false;
    await get().updateReport({
      projectEntries: previous.projectEntries.map((entry) => ({ ...entry })),
      issue: previous.issue,
      solution: previous.solution,
      nextWork: previous.nextWork,
    });
    return true;
  },

  createNextReportFromCurrent: async () => {
    const current = get().report;
    if (!current) return false;
    const days = useNotesStore.getState().days;
    const currentDate = days.find((day) => day.id === current.dayId)?.date || current.dayId.replace(/^day_/, '');
    const nextDateObject = new Date(`${currentDate}T12:00:00`);
    nextDateObject.setDate(nextDateObject.getDate() + 1);
    const nextDate = nextDateObject.toISOString().slice(0, 10);
    const nextDay = await repo.ensureDay(nextDate);
    const existing = await repo.getWorkReportByDay(nextDay.id);
    let nextReport = await repo.createOrGetWorkReport(nextDay.id);
    let didTransfer = false;
    if (!nextReport.nextWork && current.nextWork.trim()) {
      const updated = await repo.updateWorkReport(nextReport.id, { nextWork: current.nextWork });
      if (updated) { nextReport = updated; didTransfer = true; }
    }
    await useNotesStore.getState().loadDays();
    set({ selectedDayId: nextDay.id, selectedReportId: nextReport.id, dayReport: await repo.getWorkReportByDay(nextDay.id) || nextReport, report: await repo.getWorkReportByDay(nextDay.id) || nextReport });
    if (!existing) {
      await queueSync('create', 'work_report', nextReport.id, nextReport);
    } else if (didTransfer) {
      await queueSync('update', 'work_report', nextReport.id, nextReport);
    }
    return true;
  },

  deleteReport: async (id) => {
    const reportId = id || get().selectedReportId;
    if (!reportId) return;
    await repo.deleteWorkReport(reportId);
    await queueSync('delete', 'work_report', reportId);
    set((state) => ({ selectedReportId: null, report: null, dayReport: null, reports: state.reports.filter((item) => item.id !== reportId), reportsVersion: state.reportsVersion + 1 }));
  },

  createProject: async (name, description = '') => {
    const project = await repo.createProject(name, description);
    await queueSync('create', 'project', project.id, project);
    await repo.rebuildSearchIndex();
    await get().loadProjects();
    return project;
  },

  updateProject: async (id, updates) => {
    const project = await repo.updateProject(id, updates);
    await queueSync('update', 'project', id, project);
    await repo.rebuildSearchIndex();
    await get().loadProjects();
    const report = get().report;
    if (report) set({ report: await repo.getWorkReportByDay(report.dayId) || report });
  },

  archiveProject: async (id) => {
    const project = await repo.archiveProject(id);
    if (!project) return;
    await queueSync('delete', 'project', id, project);
    await repo.rebuildSearchIndex();
    await get().loadProjects();
  },

  restoreProject: async (id) => {
    const project = await repo.restoreProject(id);
    if (!project) return;
    await queueSync('update', 'project', id, project);
    await repo.rebuildSearchIndex();
    await get().loadProjects();
  },

  clearSelectedReport: () => set({ selectedReportId: null, report: null }),
}));

export type { WorkReportProjectEntry };
