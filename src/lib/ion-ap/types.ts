// ion-AP API types based on OpenAPI spec v2.3.0-rc2

export interface IonApOrganization {
  id: number;
  name: string;
  country: string;
  publish_in_smp: boolean;
  reference?: string;
  identifiers: IonApIdentifier[];
}

export interface IonApIdentifier {
  id: number;
  scheme: string;
  identifier: string;
  verified: boolean;
  publish_receive_peppolbis: boolean;
  publish_receive_nlcius: boolean;
  publish_receive_invoice_response: boolean;
}

export interface IonApSendTransaction {
  id: number;
  created_on: string;
  last_updated_on: string;
  transaction_id: string | null;
  sender_identifier: string;
  receiver_identifier: string;
  document_element: string;
  document_type: string;
  process: string;
  document_id: string | null;
  state: "QUEUED" | "SENDING" | "SENT" | "DEFERRED" | "ERROR";
}

export interface IonApReceiveTransaction {
  id: number;
  created_on: string;
  last_updated_on: string;
  transaction_id: string | null;
  sender_identifier: string;
  receiver_identifier: string;
  document_element: string;
  document_type: string;
  process: string;
  document_id: string | null;
  state: "NEW" | "READ";
  client_state: string | null;
}

export interface IonApPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface IonApError {
  type: string;
  errors: {
    code: string;
    detail: string;
    attr?: string;
  }[];
}

export interface IonApParticipantPresence {
  exists: boolean;
  detail: string;
}
