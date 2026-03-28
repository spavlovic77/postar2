/**
 * Send a Peppol billing invoice to the customer after a successful payment.
 * Uses the test sender token to send via ion-AP.
 *
 * Isolated feature: delete this file + references to remove entirely.
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getIonApBaseUrl } from "@/lib/settings";
import { audit } from "@/lib/audit";

const SELLER_NAME = "peppolbox.sk";
const SELLER_PEPPOL_ID = "9950:6878787887";
const SELLER_COUNTRY = "SK";
const SELLER_VAT_ID = "SK6878787887";
const VAT_RATE = 23;

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function generateBillingInvoice(params: {
  invoiceId: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  receiverPeppolId: string;
  receiverName: string;
  receiverVatId: string;
}): string {
  const currency = "EUR";
  const netAmount = params.amount;
  const taxAmount = Math.round(netAmount * VAT_RATE) / 100;
  const grossAmount = Math.round((netAmount + taxAmount) * 100) / 100;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${params.invoiceId}</cbc:ID>
  <cbc:IssueDate>${params.issueDate}</cbc:IssueDate>
  <cbc:DueDate>${params.dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${params.invoiceId}</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="9950">${SELLER_PEPPOL_ID.split(":")[1]}</cbc:EndpointID>
      <cac:PartyIdentification><cbc:ID>${SELLER_PEPPOL_ID}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${escapeXml(SELLER_NAME)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cac:Country><cbc:IdentificationCode>${SELLER_COUNTRY}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${SELLER_VAT_ID}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(SELLER_NAME)}</cbc:RegistrationName>
        <cbc:CompanyID>${SELLER_PEPPOL_ID.split(":")[1]}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0245">${params.receiverPeppolId.split(":")[1]}</cbc:EndpointID>
      <cac:PartyIdentification><cbc:ID>${params.receiverPeppolId}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${escapeXml(params.receiverName)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(params.receiverVatId)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(params.receiverName)}</cbc:RegistrationName>
        <cbc:CompanyID>${params.receiverPeppolId.split(":")[1]}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${taxAmount.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${netAmount.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${taxAmount.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${VAT_RATE}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${netAmount.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${netAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${grossAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currency}">${grossAmount.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${netAmount.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>peppolbox.sk - e-invoice service credit</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${VAT_RATE}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${netAmount.toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
</Invoice>`;
}

/**
 * Send a billing invoice via Peppol to the genesis admin's company
 * after a successful wallet top-up payment.
 */
export async function sendBillingInvoice(
  walletId: string,
  amount: number,
  transactionId: string
): Promise<void> {
  const token = process.env.ION_AP_TEST_SENDER_TOKEN;
  if (!token) {
    console.log("[BILLING-INVOICE] ION_AP_TEST_SENDER_TOKEN not set, skipping billing invoice");
    return;
  }

  const supabase = getSupabaseAdmin();

  // Find the wallet owner's company
  const { data: wallet } = await supabase
    .from("wallets")
    .select("owner_id")
    .eq("id", walletId)
    .single();

  if (!wallet) return;

  // Find genesis membership to get company
  const { data: membership } = await supabase
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", wallet.owner_id)
    .eq("is_genesis", true)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership) return;

  const { data: company } = await supabase
    .from("companies")
    .select("dic, legal_name, ion_ap_status")
    .eq("id", membership.company_id)
    .single();

  if (!company || company.ion_ap_status !== "active") return;

  const today = new Date();
  const issueDate = today.toISOString().split("T")[0];
  const dueDate = new Date(today.getTime() + 14 * 86400000).toISOString().split("T")[0];
  const invoiceId = `PB-${today.getFullYear()}-${transactionId.slice(-8)}`;

  const xml = generateBillingInvoice({
    invoiceId,
    issueDate,
    dueDate,
    amount,
    receiverPeppolId: `0245:${company.dic}`,
    receiverName: company.legal_name ?? `Company ${company.dic}`,
    receiverVatId: `SK${company.dic}`,
  });

  try {
    const baseUrl = (await getIonApBaseUrl()).replace(/\/+$/, "").replace(/\/api\/v2\/?$/, "");
    const url = `${baseUrl}/api/v2/send-document`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/xml; charset=utf-8",
        Accept: "application/json",
      },
      body: xml,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[BILLING-INVOICE] Failed to send (${res.status}):`, text);
      return;
    }

    const result = await res.json();
    console.log(`[BILLING-INVOICE] Sent ${invoiceId} to 0245:${company.dic}, ion-AP ID: ${result.id}`);

    audit({
      eventId: "BILLING_INVOICE_SENT",
      eventName: "Billing invoice sent via Peppol",
      companyId: membership.company_id,
      companyDic: company.dic,
      details: {
        invoiceId,
        amount,
        transactionId,
        ionApSendId: result.id,
      },
    });
  } catch (err) {
    console.error("[BILLING-INVOICE] Error:", err instanceof Error ? err.message : err);
  }
}
