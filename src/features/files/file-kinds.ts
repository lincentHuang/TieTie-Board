import type { IconName } from '@/components/ui';
import { isPdf, type Attachment } from '@/lib/types';

/** 每種檔案的圖示與顏色（跟各家 App 的代表色接近，一眼認得出是什麼） */
export function fileKind(file: Pick<Attachment, 'name' | 'mime'>): { icon: IconName; color: string; label: string } {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (isPdf(file)) return { icon: 'document-text', color: '#E5484D', label: 'PDF' };
  if (['doc', 'docx'].includes(ext) || file.mime.includes('word')) return { icon: 'document-text', color: '#2B6CD8', label: 'Word' };
  if (['xls', 'xlsx', 'csv'].includes(ext) || file.mime.includes('sheet') || file.mime.includes('excel')) {
    return { icon: 'grid', color: '#1F9D55', label: 'Excel' };
  }
  if (['ppt', 'pptx'].includes(ext) || file.mime.includes('presentation') || file.mime.includes('powerpoint')) {
    return { icon: 'easel', color: '#E0702A', label: 'PPT' };
  }
  return { icon: 'document', color: '#8C84A8', label: ext.toUpperCase() || '檔案' };
}
