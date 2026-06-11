const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  // Set JSON headers by default if body is present and not FormData
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "Erro desconhecido";
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(errorDetail);
  }

  // Return text blob/file directly if response is a PDF/Spreadsheet
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/pdf") || contentType.includes("application/vnd") || contentType.includes("text/csv")) {
    return response.blob();
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export const api = {
  get: (endpoint: string, options: RequestInit = {}) => apiRequest(endpoint, { ...options, method: "GET" }),
  post: (endpoint: string, body: any, options: RequestInit = {}) => 
    apiRequest(endpoint, { 
      ...options, 
      method: "POST", 
      body: body instanceof FormData ? body : JSON.stringify(body) 
    }),
  put: (endpoint: string, body: any, options: RequestInit = {}) => 
    apiRequest(endpoint, { 
      ...options, 
      method: "PUT", 
      body: JSON.stringify(body) 
    }),
  delete: (endpoint: string, options: RequestInit = {}) => apiRequest(endpoint, { ...options, method: "DELETE" }),
};
