/** Central Vietnamese UI catalog.
 *
 * User-authored note content is intentionally not translated. Components use
 * this catalog for navigation, status and common actions so wording remains
 * consistent across desktop and mobile surfaces.
 */
export const vi = {
  appName: 'WebNote',
  search: 'Tìm kiếm',
  searchPlaceholder: 'Tìm trong ghi chú, sổ và báo cáo…',
  today: 'Hôm nay',
  notes: 'Ghi chú',
  schedule: 'Lịch biểu',
  more: 'Thêm',
  close: 'Đóng',
  cancel: 'Hủy',
  save: 'Lưu',
  create: 'Tạo',
  delete: 'Xóa',
  restore: 'Khôi phục',
  sync: 'Đồng bộ',
  syncing: 'Đang đồng bộ…',
  offline: 'Ngoại tuyến',
  reconnectDrive: 'Kết nối lại Drive',
  noResults: 'Không tìm thấy kết quả',
  loading: 'Đang tải…',
  untitled: 'Chưa có tiêu đề',
  notebook: 'Sổ ghi chú',
  page: 'Trang',
  report: 'Báo cáo',
  project: 'Dự án',
  task: 'Công việc',
  attachment: 'Tệp đính kèm',
  trash: 'Thùng rác',
  settings: 'Cài đặt',
} as const;

export type ViKey = keyof typeof vi;

export function uiText(key: ViKey): string {
  return vi[key];
}
