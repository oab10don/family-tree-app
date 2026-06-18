// ============================================================
// 自動保存 / 読み込み（localStorage） & JSON 入出力（ロスレス）
//
// FHIR は親子/夫婦関係を保持できないため、ロスレスな保存形式として
// JSON（GenogramData そのまま）も提供する。
// ============================================================

import { GenogramData, DATA_VERSION, defaultSettings } from '@/types/genogram';

const KEY = 'genogramAutoSave_v2';

export const saveLocal = (data: GenogramData): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 容量超過等は無視 */
  }
};

export const loadLocal = (): GenogramData | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const clearLocal = (): void => {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
};

/** 不足フィールドを補完して GenogramData として正規化 */
export const normalize = (raw: unknown): GenogramData => {
  const d = (raw ?? {}) as Partial<GenogramData>;
  return {
    version: d.version ?? DATA_VERSION,
    persons: Array.isArray(d.persons) ? d.persons : [],
    unions: Array.isArray(d.unions) ? d.unions : [],
    relations: Array.isArray(d.relations) ? d.relations : [],
    settings: { ...defaultSettings, ...(d.settings ?? {}) },
  };
};

export const exportJson = (data: GenogramData): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `genogram_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
