// @ts-ignore
import pdfParse from "pdf-parse";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

export async function parseInvoicePDF(filePath: string, invoiceMonth: string) {
  const dataBuffer = fs.readFileSync(filePath);
  
  // Basic PDF text extraction
  const data = await pdfParse(dataBuffer);
  const text = data.text;

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

  Return the result as a valid JSON array of objects. 
  Each object MUST have the following structure:
  {
    "date": "YYYY-MM-DD", // Provide a best guess for the year based on the ${invoiceMonth}. E.g. if the line says 15/05 and the invoice month is 2026-06, the date is 2026-05-15.
    "description": "string", // Keep the raw description. If it has installment info like '01/10', REMOVE the installment info from the description.
    "amount": number, // The numerical value in Brazilian currency formatting parsed to float. E.g. "1.928,95" -> 1928.95
    "current_installment": number, // If it's a parcelamento (e.g. 1/10), extract the 1. If it's not a parcelamento, use 1.
    "total_installments": number  // If it's 1/10, extract the 10. If not, use 1.
  }

  Do NOT return anything else but the JSON array. Make sure the JSON is valid.
  `;

  // Use Gemini 2.5 Flash to process the text
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        text: prompt + "\n\n=== PDF TEXT ===\n" + text,
      },
    ],
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
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
