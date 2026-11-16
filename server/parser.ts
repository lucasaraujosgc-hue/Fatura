// Leitura de faturas de cartão (layout Itaú em 2 colunas).
//
// Por que não usar só o texto do pdf-parse?
// O pdf-parse devolve o texto na ordem em que ele foi gravado no PDF, não na
// ordem visual. Na fatura do Itaú isso significa: todas as linhas de compra
// primeiro e, bem depois, os títulos ("Pagamentos efetuados", "Compras
// parceladas - próximas faturas", "NOME (final 1234)"...). A IA recebe uma lista
// de compras sem saber a qual seção cada uma pertence e acaba importando
// pagamentos e parcelas FUTURAS como se fossem desta fatura.
//
// Aqui reconstruímos o layout usando as coordenadas de cada texto (coluna
// esquerda -> coluna direita, de cima para baixo) e lemos as seções com um
// parser determinístico (sem IA). O resultado é conferido com os subtotais
// impressos na própria fatura; se não bater, a importação é recusada.

import fs from "fs";

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  current_installment: number;
  total_installments: number;
  card_final?: string;
  holder?: string;
}

// ---------------------------------------------------------------------------
// 1. Extração com coordenadas
// ---------------------------------------------------------------------------

async function loadPdfjs(): Promise<any> {
  // pdfjs-dist já vem como dependência do pdf-parse.
  try {
    return await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
  } catch {
    return await import("pdfjs-dist" as any);
  }
}

/** Devolve o texto em ordem de leitura: página a página, coluna esquerda e depois direita. */
export async function extractLayoutLines(buffer: Buffer): Promise<string[]> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;

  const pages: Item[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push(
      (content.items as any[])
        .filter((it) => typeof it.str === "string" && it.str !== "")
        .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 }))
    );
    page.cleanup();
  }
  await doc.destroy();

  const split = findColumnSplit(pages.flat());
  const out: string[] = [];
  for (const items of pages) {
    if (split === null) {
      out.push(...groupLines(items));
    } else {
      out.push(...groupLines(items.filter((i) => i.x < split)));
      out.push(...groupLines(items.filter((i) => i.x >= split)));
    }
  }
  return out;
}

interface Item { str: string; x: number; y: number; w: number }

/**
 * Descobre onde começa a coluna da direita olhando onde as datas (dd/mm) começam.
 * Não dá para usar "metade da página": os valores da coluna esquerda passam do meio.
 */
function findColumnSplit(items: Item[]): number | null {
  const xs = items
    .filter((i) => /^\d{2}\/\d{2}/.test(i.str.trim()))
    .map((i) => Math.round(i.x));
  if (xs.length < 2) return null;
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) || 0) + 1);
  // as duas posições onde mais datas começam = início de cada coluna
  // (parcelas como "02/10" também casam com o padrão, mas aparecem em X variados)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (top.length < 2 || top[1][1] < 3) return null;
  return Math.max(top[0][0], top[1][0]) - 5;
}

function groupLines(items: Item[]): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; parts: Item[] }[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= 2.5) last.parts.push(it);
    else lines.push({ y: it.y, parts: [it] });
  }
  return lines
    .map((l) => {
      const parts = l.parts.sort((a, b) => a.x - b.x);
      let text = "";
      let end = -Infinity;
      for (const p of parts) {
        // o PDF quebra palavras com acento em pedaços; só põe espaço se houver distância real
        if (text && p.x - end > 1.5) text += " ";
        text += p.str;
        end = p.x + p.w;
      }
      return text.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// 2. Parser determinístico das seções
// ---------------------------------------------------------------------------

const MONEY = String.raw`-?\s?\d{1,3}(?:\.\d{3})*,\d{2}`;
const TX_RE = new RegExp(String.raw`^(\d{2})/(\d{2})\s+(.+?)\s+(${MONEY})$`);
const HOLDER_RE = /^(.+?)\s*\(final (\d{4})\)$/i;
const SUBTOTAL_RE = new RegExp(String.raw`Lançamentos no cartão \(final (\d{4})\)\s+(${MONEY})$`, "i");
const TOTAL_RE = new RegExp(String.raw`Total dos lançamentos atuais\s+(${MONEY})$`, "i");

export function toNumber(v: string): number {
  return Number(v.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
}

function inferDate(dd: string, mm: string, invoiceMonth: string): string {
  const [y, m] = invoiceMonth.split("-").map(Number);
  // Compras com mês posterior ao da fatura só podem ser do ano anterior (parcelas antigas).
  const year = Number(mm) > m ? y - 1 : y;
  return `${year}-${mm}-${dd}`;
}

function splitInstallment(desc: string) {
  const m = desc.match(/^(.*?)\s*(\d{2})\/(\d{2})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= Number(m[3])) {
    return { description: m[1].trim(), current: Number(m[2]), total: Number(m[3]) };
  }
  return { description: desc.trim(), current: 1, total: 1 };
}

export interface ParseReport {
  transactions: ParsedTransaction[];
  warnings: string[];
  printedTotal?: number;
  parsedTotal: number;
}

export function parseItauLines(lines: string[], invoiceMonth: string): ParseReport {
  type Section = "none" | "payments" | "current" | "future" | "other";
  let section: Section = "none";
  let holder: string | undefined;
  let card: string | undefined;
  let cardSum = 0;

  const transactions: ParsedTransaction[] = [];
  const warnings: string[] = [];
  let printedTotal: number | undefined;

  for (const raw of lines) {
    const line = raw.replace(/^[A-Z]\s+(?=Total)/, ""); // remove ícones "P"/"L"
    const lower = line.toLowerCase();

    // --- títulos de seção ---
    if (lower.startsWith("pagamentos efetuados")) { section = "payments"; continue; }
    if (lower.startsWith("compras parceladas")) { section = "future"; continue; }
    if (/^lançamentos:\s*compras e saques/i.test(line) ||
        /^lançamentos internacionais/i.test(line)) {
      // a mesma seção continua na coluna/página seguinte
      section = "current";
      continue;
    }
    if (/^(produtos e serviços|encargos|limites de crédito|resumo da fatura)/i.test(line)) {
      section = "other";
      continue;
    }

    const total = line.match(TOTAL_RE);
    if (total) { printedTotal = toNumber(total[1]); continue; }

    if (section !== "current") continue;

    const sub = line.match(SUBTOTAL_RE);
    if (sub) {
      const printed = toNumber(sub[2]);
      if (card !== sub[1]) warnings.push(`Subtotal do cartão ${sub[1]} sem cabeçalho correspondente.`);
      if (Math.abs(printed - cardSum) > 0.009) {
        warnings.push(`Cartão final ${sub[1]}: lido R$ ${cardSum.toFixed(2)}, fatura diz R$ ${printed.toFixed(2)}.`);
      }
      card = undefined;
      cardSum = 0;
      continue;
    }

    const h = line.match(HOLDER_RE);
    if (h && !/^lançamentos/i.test(line)) {
      holder = h[1].trim();
      card = h[2];
      cardSum = 0;
      continue;
    }

    const tx = line.match(TX_RE);
    if (tx) {
      const [, dd, mm, descRaw, value] = tx;
      const inst = splitInstallment(descRaw);
      const amount = toNumber(value);
      cardSum = Math.round((cardSum + amount) * 100) / 100;
      transactions.push({
        date: inferDate(dd, mm, invoiceMonth),
        description: inst.description,
        amount,
        current_installment: inst.current,
        total_installments: inst.total,
        card_final: card,
        holder,
      });
    }
    // linhas sem data (cidade, "DATA ESTABELECIMENTO...") são ignoradas
  }

  const parsedTotal = Math.round(transactions.reduce((s, t) => s + t.amount, 0) * 100) / 100;
  if (printedTotal !== undefined && Math.abs(printedTotal - parsedTotal) > 0.009) {
    warnings.push(`Total lido R$ ${parsedTotal.toFixed(2)} diferente do total da fatura R$ ${printedTotal.toFixed(2)}.`);
  }
  if (transactions.length === 0) warnings.push("Nenhum lançamento encontrado pelo parser.");
  return { transactions, warnings, printedTotal, parsedTotal };
}

// ---------------------------------------------------------------------------
// 3. Função usada pelo servidor (mesma assinatura de antes)
// ---------------------------------------------------------------------------

export async function parseInvoicePDF(filePath: string, invoiceMonth: string): Promise<ParsedTransaction[]> {
  const buffer = fs.readFileSync(filePath);
  const lines = await extractLayoutLines(buffer);
  const report = parseItauLines(lines, invoiceMonth);

  if (report.warnings.length === 0) {
    console.log(`[parser] ${report.transactions.length} lançamentos, total R$ ${report.parsedTotal.toFixed(2)} (conferido com a fatura).`);
    return report.transactions;
  }

  console.warn("[parser] Conferência falhou:", report.warnings);
  throw new Error(
    "Não foi possível ler a fatura com segurança: " + report.warnings.join(" ") +
    " Verifique se o PDF está completo (todas as páginas) e é uma fatura do Itaú."
  );
}
