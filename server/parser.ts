// @ts-ignore
import pdfParse from "pdf-parse";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";

export async function parseInvoicePDF(filePath: string, invoiceMonth: string) {
  const dataBuffer = fs.readFileSync(filePath);
  
  // Extract text using PDFParse class from mehmet-kozan's pdf-parse package
  const pdfParserClass = (pdfParse as any).PDFParse;
  if (!pdfParserClass) {
    throw new Error(`Não foi possível encontrar a classe PDFParse. Chaves disponíveis: ${Object.keys(pdfParse).join(", ")}`);
  }

  const parserInstance = new pdfParserClass({ data: dataBuffer });
  const textResult = await parserInstance.getText();
  const text = textResult.text;
  await parserInstance.destroy();

  // If we don't have an API key, we throw an error (or fallback to dummy logic if we wanted)
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required to parse the invoice.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `
  You are an expert financial data extractor specialized in Brazilian credit card bills (faturas).
  I am providing you with the raw text extracted from a PDF of a credit card bill.
  Invoice Target Billed Month: ${invoiceMonth}
  
  Task: Extract all the individual purchase line items/transactions that are being charged on this bill.
  
  Ignore: payments made (pagamentos efetuados), previous balances, total summary blocks, taxes (IOF, Encargos), or "Compras parceladas - próximas faturas" (future installments section). WE ONLY WANT THE CURRENT CHARGES that make up the "Lançamentos atuais" or "Lançamentos no cartão" for THIS month.
  `;

  // Use Gemini 3.5 Flash to process the text with a strictly mapped responseSchema to optimize latency and quota
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      {
        text: prompt + "\n\n=== PDF TEXT ===\n" + text,
      },
    ],
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { 
              type: Type.STRING, 
              description: "YYYY-MM-DD format. Best guess for the year based on ${invoiceMonth}. E.g. raw 15/05 with target month 2026-06 yields 2026-05-15." 
            },
            description: { 
              type: Type.STRING, 
              description: "The raw vendor description. If it has installment info like '01/10', remove the installment info from this description string." 
            },
            amount: { 
              type: Type.NUMBER, 
              description: "The parsed numerical value. Convert Portuguese formatting (e.g., '1.928,95' to 1928.95)." 
            },
            current_installment: { 
              type: Type.INTEGER, 
              description: "Extracted current installment number (integer). Defaults to 1 if not a parcelamento." 
            },
            total_installments: { 
              type: Type.INTEGER, 
              description: "Extracted total number of installments (integer). Defaults to 1 if not a parcelamento." 
            }
          },
          required: ["date", "description", "amount"]
        }
      }
    },
  });

  const responseText = response.text || "[]";
  try {
    const transactions = JSON.parse(responseText);
    return transactions;
  } catch (err) {
    console.error("Failed to parse AI response as JSON:", responseText);
    throw new Error("Falha ao analisar a fatura. A IA não retornou um formato válido.");
  }
}
