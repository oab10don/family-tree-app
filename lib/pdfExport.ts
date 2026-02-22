import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

type PaperSize = 'A4' | 'A3';
type Orientation = 'portrait' | 'landscape';

interface PdfExportOptions {
  /** React Flow のラッパー要素 */
  element: HTMLElement;
  paperSize: PaperSize;
  orientation: Orientation;
  /** ヘッダーに表示するタイトル（例：「山田家 家系図」） */
  title?: string;
  /** 出力日を表示するか */
  showDate?: boolean;
  /** mm単位のマージン */
  margin?: number;
}

const PAPER_SIZES = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
};

export async function exportToPdf(options: PdfExportOptions): Promise<void> {
  const {
    element,
    paperSize,
    orientation,
    title,
    showDate = true,
    margin = 10,
  } = options;

  // 1. 出力前にミニマップ・コントロール・ホバーボタンを一時的に非表示にする
  const hideSelectors = [
    '.react-flow__minimap',
    '.react-flow__controls',
    '.react-flow__attribution',
  ];
  const hiddenElements: { el: HTMLElement; display: string }[] = [];
  for (const selector of hideSelectors) {
    const els = element.querySelectorAll<HTMLElement>(selector);
    els.forEach((el) => {
      hiddenElements.push({ el, display: el.style.display });
      el.style.display = 'none';
    });
  }

  try {
    // 2. React Flow キャンバスをPNG画像に変換
    const dataUrl = await toPng(element, {
      backgroundColor: '#F8FAFC',
      pixelRatio: 2,
    });

    // 3. PDF作成
    const paper = PAPER_SIZES[paperSize];
    const pdfWidth = orientation === 'landscape' ? paper.height : paper.width;
    const pdfHeight = orientation === 'landscape' ? paper.width : paper.height;

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: paperSize.toLowerCase() as 'a4' | 'a3',
    });

    // 4. ヘッダー（タイトル + 日付）
    let yOffset = margin;

    if (title) {
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, pdfWidth / 2, yOffset + 6, { align: 'center' });
      yOffset += 12;
    }

    if (showDate) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(128, 128, 128);
      const today = new Date().toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      pdf.text(`${today}`, pdfWidth - margin, yOffset, { align: 'right' });
      yOffset += 8;
    }

    // 5. 家系図画像を配置（用紙に合わせて自動縮尺）
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const contentWidth = pdfWidth - margin * 2;
    const contentHeight = pdfHeight - yOffset - margin;

    const imgAspect = img.width / img.height;
    const contentAspect = contentWidth / contentHeight;

    let drawWidth: number;
    let drawHeight: number;

    if (imgAspect > contentAspect) {
      drawWidth = contentWidth;
      drawHeight = contentWidth / imgAspect;
    } else {
      drawHeight = contentHeight;
      drawWidth = contentHeight * imgAspect;
    }

    const xPos = margin + (contentWidth - drawWidth) / 2;

    pdf.addImage(dataUrl, 'PNG', xPos, yOffset, drawWidth, drawHeight);

    // 6. ダウンロード
    const filename = title
      ? `${title}_${new Date().toISOString().slice(0, 10)}.pdf`
      : `家系図_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
  } finally {
    // 7. 非表示にした要素を復元
    for (const { el, display } of hiddenElements) {
      el.style.display = display;
    }
  }
}
