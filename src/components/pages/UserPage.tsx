async function buildPDF(): Promise<import('jspdf').jsPDF | null> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const pageEl = document.querySelector<HTMLElement>('.page.on');
  if (!pageEl) return null;

  const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [215.9, 330.2] });
  const pdfW    = pdf.internal.pageSize.getWidth();
  const pdfH    = pdf.internal.pageSize.getHeight();
  const margin  = 6;
  const usableW = pdfW - margin * 2;

  const savedStyle = pageEl.getAttribute('style') || '';
  pageEl.style.overflow  = 'visible';
  pageEl.style.maxHeight = 'none';
  pageEl.style.height    = 'auto';

  const canvas = await html2canvas(pageEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: -window.scrollY,
    width:        pageEl.scrollWidth,
    height:       pageEl.scrollHeight,
    windowWidth:  pageEl.scrollWidth,
    windowHeight: pageEl.scrollHeight,
    ignoreElements: (node) => {
      const n = node as HTMLElement;
      return n.classList?.contains('no-print') || n.tagName === 'BUTTON';
    },
  });

  pageEl.setAttribute('style', savedStyle);

  const ratio = canvas.width / usableW;
  let yPos = 0;
  let first = true;

  while (yPos < canvas.height) {
    const sliceH = Math.min((pdfH - margin * 2) * ratio, canvas.height - yPos);
    const slice  = document.createElement('canvas');
    slice.width  = canvas.width;
    slice.height = Math.ceil(sliceH);
    slice.getContext('2d')!.drawImage(canvas, 0, yPos, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    if (!first) pdf.addPage();
    first = false;

    pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, usableW, sliceH / ratio);
    yPos += sliceH;
  }

  return pdf;
}

async function handleDownload() {
  const pdf = await buildPDF();
  if (!pdf) return;
  pdf.save(`LeaveCard_${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function handlePrint() {
  const pageEl = document.querySelector<HTMLElement>('.page.on');
  if (!pageEl) return;
  const clone = pageEl.cloneNode(true) as HTMLElement;

  // Remove all no-print elements from the clone
  clone.querySelectorAll<HTMLElement>('.no-print').forEach(el => el.remove());
  clone.querySelectorAll<HTMLElement>('button').forEach(el => el.remove());

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Leave Card</title>
        <link rel="stylesheet" href="${window.location.origin}/globals.css" />
        <style>
          body { margin: 0; padding: 12px; font-family: sans-serif; background: #fff; }
          @media print { body { margin: 0; padding: 0; } }
        </style>
      </head>
      <body>${clone.innerHTML}</body>
    </html>
  `);
  win.document.close();
  win.addEventListener('load', () => { win.focus(); win.print(); });
}
