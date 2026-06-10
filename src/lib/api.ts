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

export async function updateTransactionConfig(id: string, person_id: string | null, split_data: any | null) {
  const res = await fetch(`${API_BASE}/transactions/${id}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ person_id, split_data }),
  });
  return res.json();
}

export async function uploadInvoice(file: File, month: string, overwrite: boolean) {
  const formData = new FormData();
  formData.append("pdf", file);
  formData.append("invoiceMonth", month);
  formData.append("overwrite", overwrite.toString());

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
