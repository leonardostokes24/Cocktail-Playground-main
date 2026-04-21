import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export type ExportMode = 'viewport' | 'allNodes';
export type PaperSize = 'a4' | 'letter';
export type Orientation = 'portrait' | 'landscape';

export interface ExportPdfOptions {
  flowElement: HTMLElement;
  mode: ExportMode;
  paperSize: PaperSize;
  orientation: Orientation;
  fileName?: string;
  pixelRatio?: number;
}

const PDF_SIZES_MM: Record<PaperSize, [number, number]> = {
  a4: [210, 297],
  letter: [216, 279],
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function exportFlowToPdf({
  flowElement,
  paperSize,
  orientation,
  fileName = 'cocktail-canvas.pdf',
  pixelRatio = 2,
}: ExportPdfOptions): Promise<void> {
  await sleep(100);

  const imageData = await toPng(flowElement, {
    cacheBust: true,
    pixelRatio,
    backgroundColor: '#0f172a',
    filter: (node) => {
      const element = node as HTMLElement;
      return !element.classList?.contains('no-export');
    },
  });

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: paperSize,
  });

  const [widthMm, heightMm] = PDF_SIZES_MM[paperSize];
  const pageWidth = orientation === 'landscape' ? heightMm : widthMm;
  const pageHeight = orientation === 'landscape' ? widthMm : heightMm;

  const properties = pdf.getImageProperties(imageData);
  const imgRatio = properties.width / properties.height;
  const pageRatio = pageWidth / pageHeight;

  let renderWidth = pageWidth;
  let renderHeight = pageHeight;
  if (imgRatio > pageRatio) {
    renderHeight = pageWidth / imgRatio;
  } else {
    renderWidth = pageHeight * imgRatio;
  }

  const x = (pageWidth - renderWidth) / 2;
  const y = (pageHeight - renderHeight) / 2;

  pdf.addImage(imageData, 'PNG', x, y, renderWidth, renderHeight, undefined, 'FAST');
  pdf.save(fileName);
}
