// Testes do leitor de faturas. Rode com: npm test
//
// O primeiro teste usa linhas sintéticas (sem dados reais) e roda sempre.
// O segundo lê um PDF real se você apontar um em FATURA_PDF, por exemplo:
//   FATURA_PDF=~/Downloads/Fatura_Itau.pdf FATURA_MES=2026-11 FATURA_TOTAL=7979.78 npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { parseItauLines, analyzeInvoicePDF, mergeRoundingAdjustments } from "../server/parser.ts";

const LINES = [
  "Previsão do próximo fechamento: 08/12/2026.",
  "Pagamentos efetuados",
  "DATA VALOR EM R$",
  "13/10 PAGAMENTO FICHA COMPENS - 1.700,00",
  "P Total dos pagamentos - 1.700,00",
  "Lançamentos: compras e saques",
  "FULANA DE TAL (final 1111)",
  "DATA ESTABELECIMENTO VALOR EM R$",
  "03/07 LOJA EXEMPLO04/04 145,00",
  "CIDADE",
  "25/09 VIVARA XFS 02/06 101,70",
  "25/09 VIVARA XFS - 0,20",
  "31/12 DM*hostingercomb 10/10 72,74",
  "Lançamentos no cartão (final 1111) 319,24",
  "Lançamentos: compras e saques",
  "BELTRANO (final 2222)",
  "07/11 PADARIA 1.047,00",
  "Lançamentos no cartão (final 2222) 1.047,00",
  "L Total dos lançamentos atuais 1.366,24",
  "Compras parceladas - próximas faturas",
  "02/02 PARCELA FUTURA 10/12 239,25",
];

test("lê seções, cartões, parcelas e confere os totais", () => {
  const r = parseItauLines(LINES, "2026-11");
  assert.deepEqual(r.warnings, []);
  assert.equal(r.parsedTotal, 1366.24);
  assert.equal(r.printedTotal, 1366.24);
  assert.equal(r.suggestedMonth, "2026-11");

  // pagamentos e parcelas futuras ficam de fora; o estorno de centavos é somado
  assert.equal(r.transactions.length, 4);
  assert.equal(r.mergedAdjustments, 1);
  const vivara = r.transactions.find((t) => t.description === "VIVARA XFS")!;
  assert.equal(vivara.amount, 101.5);
  assert.equal(vivara.current_installment, 2);
  assert.equal(vivara.total_installments, 6);

  // compra de dezembro numa fatura de novembro é do ano anterior
  const hosting = r.transactions.find((t) => t.description === "DM*hostingercomb")!;
  assert.equal(hosting.date, "2025-12-31");

  assert.deepEqual(
    r.cards.map((c) => [c.card_final, c.holder, c.count, c.total]),
    [["1111", "FULANA DE TAL", 3, 319.24], ["2222", "BELTRANO", 1, 1047]]
  );
});

test("sem mês informado usa o mês sugerido pela fatura", () => {
  const r = parseItauLines(LINES);
  assert.equal(r.transactions[0].date, "2026-07-03");
});

test("acusa diferença quando falta um lançamento", () => {
  const r = parseItauLines(LINES.filter((l) => !l.startsWith("07/11")), "2026-11");
  assert.ok(r.warnings.some((w) => w.includes("2222")));
});

test("não junta ajuste de centavos com estabelecimento diferente", () => {
  const { transactions, merged } = mergeRoundingAdjustments([
    { date: "2026-09-25", description: "LOJA A", amount: 10, current_installment: 1, total_installments: 1 },
    { date: "2026-09-25", description: "OUTRA", amount: -0.2, current_installment: 1, total_installments: 1 },
  ]);
  assert.equal(merged, 0);
  assert.equal(transactions.length, 2);
});

const pdf = process.env.FATURA_PDF;
test("PDF real (FATURA_PDF)", { skip: !pdf || !fs.existsSync(pdf) }, async () => {
  const r = await analyzeInvoicePDF(pdf!, process.env.FATURA_MES);
  assert.deepEqual(r.warnings, []);
  if (process.env.FATURA_TOTAL) assert.equal(r.parsedTotal, Number(process.env.FATURA_TOTAL));
});
