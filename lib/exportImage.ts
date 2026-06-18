// ============================================================
// 画像(PNG) / PDF 出力（電子カルテへの貼付・添付用）
//
// キャンバスの「world」要素を、パン/ズームを無視した実寸で書き出す。
// ============================================================

import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

const stamp = () => new Date().toISOString().slice(0, 10);

const capture = async (node: HTMLElement, width: number, height: number): Promise<string> =>
  toPng(node, {
    backgroundColor: '#ffffff',
    width,
    height,
    pixelRatio: 2,
    cacheBust: true,
    // パン/ズーム変形を無視して実寸で描画
    style: { transform: 'none', transformOrigin: 'top left', margin: '0' },
  });

export const exportPng = async (node: HTMLElement, width: number, height: number): Promise<void> => {
  const dataUrl = await capture(node, width, height);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `genogram_${stamp()}.png`;
  a.click();
};

export const exportPdf = async (node: HTMLElement, width: number, height: number): Promise<void> => {
  const dataUrl = await capture(node, width, height);
  const orientation = width >= height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const scale = Math.min((pw - margin * 2) / width, (ph - margin * 2) / height);
  const iw = width * scale;
  const ih = height * scale;
  pdf.addImage(dataUrl, 'PNG', (pw - iw) / 2, (ph - ih) / 2, iw, ih);
  pdf.save(`genogram_${stamp()}.pdf`);
};
