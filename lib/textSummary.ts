// ============================================================
// 家族歴テキスト要約（電子カルテの記事欄へコピペ用）
// ============================================================

import { Person } from '@/types/genogram';

const yearOf = (d?: string): string => {
  if (!d) return '';
  const y = new Date(d).getFullYear();
  return isNaN(y) ? '' : String(y);
};

const sexJa = (s: Person['sex']): string =>
  s === 'male' ? '男' : s === 'female' ? '女' : '不明';

const lifeText = (p: Person): string => {
  const by = yearOf(p.birthDate);
  const dy = yearOf(p.deathDate);
  if (p.lifeStatus === 'deceased' || p.deathDate) {
    return `${by || '?'}–${dy || '?'}没`;
  }
  return by ? `${by}生` : '';
};

const lineFor = (p: Person): string => {
  const rel = p.relationship ? `[${p.relationship}] ` : '';
  const life = lifeText(p);
  const head = `${rel}${p.name || '（未入力）'}（${sexJa(p.sex)}${life ? `・${life}` : ''}）`;
  const parts: string[] = [];
  if (p.medicalHistory) parts.push(`既往: ${p.medicalHistory}`);
  if (p.livingGroup) parts.push(`同居${p.livingGroup}`);
  if (p.notes) parts.push(p.notes);
  return `・${head}${parts.length ? ` ${parts.join(' / ')}` : ''}`;
};

/** 家族歴の要約テキストを生成（本人を先頭に） */
export const buildFamilyHistoryText = (persons: Person[]): string => {
  if (persons.length === 0) return '【家族歴】データなし';
  const proband = persons.find((p) => p.isProband);
  const rest = persons.filter((p) => p.id !== proband?.id);
  const lines: string[] = [];
  lines.push(`【家族歴】${proband ? `本人: ${proband.name || '（未入力）'}` : ''}`.trim());
  if (proband) lines.push(lineFor(proband));
  for (const p of rest) lines.push(lineFor(p));
  lines.push('');
  lines.push(`（作成: 縁図 Enzu / ${new Date().toISOString().slice(0, 10)}）`);
  return lines.join('\n');
};

/** クリップボードへコピー（失敗時 false） */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/** .txt としてダウンロード */
export const downloadText = (text: string): void => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `家族歴_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};
