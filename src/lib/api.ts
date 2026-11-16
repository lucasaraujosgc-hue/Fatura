// Using standard React context instead of heavy data fetching libraries for simplicity

const env = (import.meta as any).env;
export const API_BASE = env.VITE_APP_URL ? `${env.VITE_APP_URL}/api` : "/api";

export async function fetchPeople() {
  const res = await fetch(`${API_BASE}/people`);
  return res.json();
}

export async function createPerson(name: string, color: string) {
  const res = await fetch(`${API_BASE}/people`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color }),
  });
  return res.json();
}

export async function deletePerson(id: string) {
  await fetch(`${API_BASE}/people/${id}`, { method: "DELETE" });
}

export async function fetchMonths() {
  const res = await fetch(`${API_BASE}/months`);
  return res.json();
}

export async function fetchTransactions(month: string) {
  const res = await fetch(`${API_BASE}/transactions/${month}`);
  return res.json();
}

export async function createTransaction(data: any) {
  const res = await fetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteTransaction(id: string) {
  await fetch(`${API_BASE}/transactions/${id}`, { method: "DELETE" });
}

export async function updateTransactionConfig(
  id: string,
  person_id_or_data: any,
  split_data?: any | null,
  category_id?: string | null,
  notes?: string | null,
  is_fixed?: boolean
) {
  let payload: any = {};
  if (typeof person_id_or_data === "object" && person_id_or_data !== null && !Array.isArray(person_id_or_data)) {
    payload = person_id_or_data;
  } else {
    payload = { person_id: person_id_or_data, split_data, category_id, notes, is_fixed };
  }

  const res = await fetch(`${API_BASE}/transactions/${id}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function batchAssignTransactions(
  ids: string[], 
  person_id: string | null, 
  category_id?: string | null,
  target_month?: string | null
) {
  const res = await fetch(`${API_BASE}/transactions/batch-assign`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, person_id, category_id, target_month }),
  });
  return res.json();
}

export async function batchMoveTransactions(ids: string[], target_month: string) {
  const res = await fetch(`${API_BASE}/transactions/batch-move`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, target_month }),
  });
  return res.json();
}

export async function batchDeleteTransactions(ids: string[]) {
  const res = await fetch(`${API_BASE}/transactions/batch-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  return res.json();
}

export async function shiftTransactionsByDate(options: {
  from_month: string;
  to_month: string;
  start_date?: string;
  end_date?: string;
  from_day?: number;
  to_day?: number;
  ids?: string[];
}) {
  const res = await fetch(`${API_BASE}/transactions/shift-by-date`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  return res.json();
}

export async function fetchDuplicateCandidates(month: string) {
  const res = await fetch(`${API_BASE}/transactions/duplicates/${month}`);
  return res.json();
}

export async function fetchCategories() {
  const res = await fetch(`${API_BASE}/categories`);
  return res.json();
}

export async function createCategory(name: string, color: string, icon: string) {
  const res = await fetch(`${API_BASE}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color, icon }),
  });
  return res.json();
}

export async function updateCategory(id: string, name: string, color: string, icon: string) {
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color, icon }),
  });
  return res.json();
}

export async function deleteCategory(id: string) {
  await fetch(`${API_BASE}/categories/${id}`, { method: "DELETE" });
}

export interface InvoicePreviewCard {
  card_final: string;
  holder?: string;
  count: number;
  total: number;
  person_id: string | null;
}

export interface InvoicePreview {
  ok: boolean;
  warnings: string[];
  count: number;
  parsedTotal: number;
  printedTotal?: number;
  suggestedMonth?: string;
  nextClosingDate?: string;
  mergedAdjustments: number;
  monthHasImported: boolean;
  cards: InvoicePreviewCard[];
}

export async function previewInvoice(file: File, month?: string): Promise<InvoicePreview> {
  const formData = new FormData();
  formData.append("pdf", file);
  if (month) formData.append("invoiceMonth", month);

  const res = await fetch(`${API_BASE}/upload/preview`, { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Falha ao ler a fatura");
  return data;
}

export async function uploadInvoice(
  file: File,
  month: string,
  overwrite: boolean,
  resolutions?: Record<string, string>,
  cardPeople?: { card_final: string; person_id: string | null; holder?: string }[]
) {
  const formData = new FormData();
  formData.append("pdf", file);
  formData.append("invoiceMonth", month);
  formData.append("overwrite", overwrite.toString());
  if (resolutions) {
    formData.append("resolutions", JSON.stringify(resolutions));
  }
  if (cardPeople) {
    formData.append("cardPeople", JSON.stringify(cardPeople));
  }

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });
  
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to upload invoice");
  }
  return res.json();
}
