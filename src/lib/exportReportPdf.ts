import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Convierte el contenido de un elemento del DOM (el reporte ya renderizado,
 * con sus gráficos) en un PDF de varias páginas si hace falta, y dispara
 * la descarga en el navegador.
 */
export async function exportReportPdf(element: HTMLElement, fileName: string): Promise<void> {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
}

/**
 * PDF de hojas fijas: cada elemento es UNA hoja A4 (se escala para entrar
 * entera, sin cortar texto entre hojas). Para documentos para imprimir y
 * firmar, como la autorización de tutores.
 */
export async function exportPagesPdf(pages: HTMLElement[], fileName: string): Promise<void> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    // Entra a lo ancho; si es más alta que la hoja, se achica para que entre entera.
    let w = pw;
    let h = (canvas.height * w) / canvas.width;
    if (h > ph) {
      h = ph;
      w = (canvas.width * h) / canvas.height;
    }
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pw - w) / 2, 0, w, h);
  }
  pdf.save(fileName);
}
