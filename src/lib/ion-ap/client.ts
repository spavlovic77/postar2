import type {
  IonApOrganization,
  IonApIdentifier,
  IonApSendTransaction,
  IonApReceiveTransaction,
  IonApPaginatedResponse,
  IonApParticipantPresence,
} from "./types";
import { getIonApBaseUrl, getIonApApiToken } from "@/lib/settings";

const API_PREFIX = "/api/v2";

async function getHeaders(): Promise<Record<string, string>> {
  const token = await getIonApApiToken();
  if (!token) throw new Error("ION_AP_API_TOKEN is not configured");

  return {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function xmlHeaders(): Promise<Record<string, string>> {
  const token = await getIonApApiToken();
  if (!token) throw new Error("ION_AP_API_TOKEN is not configured");

  return {
    Authorization: `Token ${token}`,
    "Content-Type": "application/xml",
    Accept: "application/json",
  };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  contentType?: "json" | "xml"
): Promise<T> {
  const baseUrl = await getIonApBaseUrl();
  // Strip trailing slashes — ion-AP returns 404 with them
  const cleanPath = path.replace(/\/+$/, "").replace(/\/+\?/, "?");
  const url = `${baseUrl}${API_PREFIX}${cleanPath}`;
  const headers = contentType === "xml" ? await xmlHeaders() : await getHeaders();

  const res = await fetch(url, {
    method,
    headers,
    body: body
      ? contentType === "xml"
        ? (body as string)
        : JSON.stringify(body)
      : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const err = JSON.parse(text);
      detail = err.errors?.map((e: { detail: string }) => e.detail).join("; ") ?? text;
    } catch {
      // keep raw text
    }
    throw new Error(`ion-AP ${method} ${path} failed (${res.status}): ${detail}`);
  }

  const contentTypeHeader = res.headers.get("content-type") ?? "";
  if (contentTypeHeader.includes("application/json")) {
    return res.json() as Promise<T>;
  }

  return res.text() as unknown as T;
}

// ============================================================
// Organizations
// ============================================================

export async function createOrganization(params: {
  name: string;
  country: string;
  publishInSmp: boolean;
  reference?: string;
}): Promise<IonApOrganization> {
  return request<IonApOrganization>("POST", "/organizations/", {
    name: params.name,
    country: params.country,
    publish_in_smp: params.publishInSmp,
    reference: params.reference,
  });
}

export async function getOrganization(orgId: number): Promise<IonApOrganization> {
  return request<IonApOrganization>("GET", `/organizations/${orgId}/`);
}

export async function updateOrganization(
  orgId: number,
  params: {
    name?: string;
    country?: string;
    publishInSmp?: boolean;
  }
): Promise<IonApOrganization> {
  const body: Record<string, unknown> = {};
  if (params.name !== undefined) body.name = params.name;
  if (params.country !== undefined) body.country = params.country;
  if (params.publishInSmp !== undefined) body.publish_in_smp = params.publishInSmp;

  return request<IonApOrganization>("PATCH", `/organizations/${orgId}/`, body);
}

export async function deleteIdentifier(
  orgId: number,
  identifierId: number
): Promise<void> {
  return request<void>("DELETE", `/organizations/${orgId}/identifiers/${identifierId}/`);
}

export async function listOrganizations(params?: {
  filterName?: string;
  filterIdentifier?: string;
}): Promise<IonApPaginatedResponse<IonApOrganization>> {
  const query = new URLSearchParams();
  if (params?.filterName) query.set("filter_name", params.filterName);
  if (params?.filterIdentifier) query.set("filter_identifier", params.filterIdentifier);
  query.set("disable_pagination", "1");
  const qs = query.toString();
  return request<IonApPaginatedResponse<IonApOrganization>>(
    "GET",
    `/organizations/${qs ? `?${qs}` : ""}`
  );
}

// ============================================================
// Identifiers
// ============================================================

export async function createIdentifier(
  orgId: number,
  params: {
    identifier: string;
    verified: boolean;
    publishReceivePeppolbis: boolean;
    scheme?: string;
  }
): Promise<IonApIdentifier> {
  return request<IonApIdentifier>(
    "POST",
    `/organizations/${orgId}/identifiers/`,
    {
      scheme: params.scheme ?? "iso6523-actorid-upis",
      identifier: params.identifier,
      verified: params.verified,
      publish_receive_peppolbis: params.publishReceivePeppolbis,
      publish_receive_nlcius: false,
      publish_receive_invoice_response: false,
    }
  );
}

export async function listIdentifiers(
  orgId: number
): Promise<IonApPaginatedResponse<IonApIdentifier>> {
  return request<IonApPaginatedResponse<IonApIdentifier>>(
    "GET",
    `/organizations/${orgId}/identifiers/?disable_pagination=1`
  );
}

// ============================================================
// Receive Triggers
// ============================================================

export async function createReceiveTrigger(
  orgId: number,
  params: {
    name: string;
    triggerType: "API_CALL" | "SEND_EMAIL";
    enabled: boolean;
  }
): Promise<{ id: number }> {
  return request<{ id: number }>(
    "POST",
    `/organizations/${orgId}/receive-triggers/`,
    {
      name: params.name,
      trigger_type: params.triggerType,
      enabled: params.enabled,
    }
  );
}

export async function createReceiveTriggerOption(
  orgId: number,
  triggerId: number,
  params: { name: string; value: string }
): Promise<{ id: number }> {
  return request<{ id: number }>(
    "POST",
    `/organizations/${orgId}/receive-triggers/${triggerId}/options/`,
    { name: params.name, value: params.value }
  );
}

// ============================================================
// Discovery
// ============================================================

export async function discoverParticipant(
  identifier: string
): Promise<IonApParticipantPresence> {
  return request<IonApParticipantPresence>(
    "GET",
    `/discover/${encodeURIComponent(identifier)}/`
  );
}

// ============================================================
// Send Document
// ============================================================

export async function sendDocument(xml: string): Promise<IonApSendTransaction> {
  return request<IonApSendTransaction>("POST", "/send-document/", xml, "xml");
}

export async function getSendTransaction(
  id: number
): Promise<IonApSendTransaction> {
  return request<IonApSendTransaction>("GET", `/send-transactions/${id}/`);
}

export async function listSendTransactions(params?: {
  filterSender?: string;
  filterReceiver?: string;
  filterState?: string;
  limit?: number;
  offset?: number;
}): Promise<IonApPaginatedResponse<IonApSendTransaction>> {
  const query = new URLSearchParams();
  if (params?.filterSender) query.set("filter_sender", params.filterSender);
  if (params?.filterReceiver) query.set("filter_receiver", String(params.filterReceiver));
  if (params?.filterState) query.set("filter_state", params.filterState);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  const qs = query.toString();
  return request<IonApPaginatedResponse<IonApSendTransaction>>(
    "GET",
    `/send-transactions/${qs ? `?${qs}` : ""}`
  );
}

export async function getSendTransactionDocument(
  id: number
): Promise<string> {
  return request<string>("GET", `/send-transactions/${id}/document/`);
}

export async function getSendTransactionPdf(id: number): Promise<ArrayBuffer> {
  const token = await getIonApApiToken();
  const baseUrl = await getIonApBaseUrl();
  const res = await fetch(`${baseUrl}${API_PREFIX}/send-transactions/${id}/pdf`, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: "application/pdf",
    },
  });
  if (!res.ok) throw new Error(`Failed to get PDF: ${res.status}`);
  return res.arrayBuffer();
}

// ============================================================
// Receive Transactions
// ============================================================

export async function getReceiveTransaction(
  id: number
): Promise<IonApReceiveTransaction> {
  return request<IonApReceiveTransaction>("GET", `/receive-transactions/${id}/`);
}

export async function listReceiveTransactions(params?: {
  filterSender?: string;
  filterReceiver?: string;
  filterState?: string;
  filterDocumentType?: string;
  limit?: number;
  offset?: number;
}): Promise<IonApPaginatedResponse<IonApReceiveTransaction>> {
  const query = new URLSearchParams();
  if (params?.filterSender) query.set("filter_sender", params.filterSender);
  if (params?.filterReceiver) query.set("filter_receiver", String(params.filterReceiver));
  if (params?.filterState) query.set("filter_state", params.filterState);
  if (params?.filterDocumentType) query.set("filter_document_type", params.filterDocumentType);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  const qs = query.toString();
  return request<IonApPaginatedResponse<IonApReceiveTransaction>>(
    "GET",
    `/receive-transactions/${qs ? `?${qs}` : ""}`
  );
}

export async function getReceiveTransactionDocument(
  id: number
): Promise<string> {
  return request<string>("GET", `/receive-transactions/${id}/document/`);
}

export async function getReceiveTransactionPdf(id: number): Promise<ArrayBuffer> {
  const token = await getIonApApiToken();
  const baseUrl = await getIonApBaseUrl();
  const res = await fetch(`${baseUrl}${API_PREFIX}/receive-transactions/${id}/pdf`, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: "application/pdf",
    },
  });
  if (!res.ok) throw new Error(`Failed to get PDF: ${res.status}`);
  return res.arrayBuffer();
}

export async function markReceiveTransactionRead(
  id: number
): Promise<IonApReceiveTransaction> {
  return request<IonApReceiveTransaction>("POST", `/receive-transactions/${id}/mark-read/`);
}

export async function markReceiveTransactionUnread(
  id: number
): Promise<IonApReceiveTransaction> {
  return request<IonApReceiveTransaction>("POST", `/receive-transactions/${id}/mark-unread/`);
}
