/**
 * Test invoice generator — sends 3 real Peppol BIS 3.0 invoices via ion-AP
 * to the given company's Peppol inbox.
 *
 * Isolated feature: delete this file + references to remove entirely.
 */

import { getIonApBaseUrl } from "@/lib/settings";

const SENDER_PEPPOL_ID = "9950:6878787887";
const SENDER_NAME = "Maliar Palo s.r.o.";
const SENDER_COUNTRY = "SK";

interface InvoiceLine {
  name: string;
  quantity: number;
  unitPrice: number;
  vatPercent: number;
}

interface TestInvoice {
  id: string;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLine[];
}

function getTestInvoices(): TestInvoice[] {
  const today = new Date();
  const issue = today.toISOString().split("T")[0];
  const due = new Date(today.getTime() + 30 * 86400000).toISOString().split("T")[0];
  const ts = Date.now().toString().slice(-6);

  return [
    {
      id: `TEST-${ts}-001`,
      issueDate: issue,
      dueDate: due,
      lines: [
        { name: "Kancelársky papier A4 (5 balení)", quantity: 5, unitPrice: 4.20, vatPercent: 23 },
        { name: "Perá guľôčkové (balenie 50ks)", quantity: 2, unitPrice: 3.50, vatPercent: 23 },
        { name: "Toner do tlačiarne HP 26A", quantity: 1, unitPrice: 18.90, vatPercent: 23 },
      ],
    },
    {
      id: `TEST-${ts}-002`,
      issueDate: issue,
      dueDate: due,
      lines: [
        { name: "Klávesnica Logitech K380", quantity: 1, unitPrice: 39.90, vatPercent: 23 },
        { name: "Myš Logitech M350", quantity: 1, unitPrice: 24.90, vatPercent: 23 },
        { name: "Kábel HDMI 2m", quantity: 2, unitPrice: 8.50, vatPercent: 10 },
      ],
    },
    {
      id: `TEST-${ts}-003`,
      issueDate: issue,
      dueDate: due,
      lines: [
        { name: "Projektový manažment (40h)", quantity: 40, unitPrice: 25.00, vatPercent: 23 },
        { name: "Analytické služby (20h)", quantity: 20, unitPrice: 12.50, vatPercent: 10 },
      ],
    },
  ];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildVatBreakdown(lines: InvoiceLine[]): { rate: number; taxable: number; tax: number }[] {
  const map = new Map<number, number>();
  for (const l of lines) {
    const lineNet = round2(l.quantity * l.unitPrice);
    map.set(l.vatPercent, (map.get(l.vatPercent) ?? 0) + lineNet);
  }
  return Array.from(map.entries()).map(([rate, taxable]) => ({
    rate,
    taxable: round2(taxable),
    tax: round2(taxable * rate / 100),
  }));
}

function generateUblInvoice(invoice: TestInvoice, receiverPeppolId: string, receiverName: string): string {
  const currency = "EUR";
  const vatBreakdown = buildVatBreakdown(invoice.lines);
  const netTotal = round2(vatBreakdown.reduce((s, v) => s + v.taxable, 0));
  const taxTotal = round2(vatBreakdown.reduce((s, v) => s + v.tax, 0));
  const grossTotal = round2(netTotal + taxTotal);

  const linesXml = invoice.lines.map((line, i) => {
    const lineNet = round2(line.quantity * line.unitPrice);
    return `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="C62">${line.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${currency}">${lineNet.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(line.name)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${line.vatPercent}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currency}">${line.unitPrice.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
  }).join("");

  const vatSubtotalsXml = vatBreakdown.map((v) => `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${currency}">${v.taxable.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${currency}">${v.tax.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${v.rate}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${invoice.id}</cbc:ID>
  <cbc:IssueDate>${invoice.issueDate}</cbc:IssueDate>
  <cbc:DueDate>${invoice.dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${invoice.id}</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="9950">${SENDER_PEPPOL_ID.split(":")[1]}</cbc:EndpointID>
      <cac:PartyIdentification><cbc:ID>${SENDER_PEPPOL_ID}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${escapeXml(SENDER_NAME)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cac:Country><cbc:IdentificationCode>${SENDER_COUNTRY}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>SK${SENDER_PEPPOL_ID.split(":")[1]}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(SENDER_NAME)}</cbc:RegistrationName>
        <cbc:CompanyID>${SENDER_PEPPOL_ID.split(":")[1]}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0245">${receiverPeppolId.split(":")[1]}</cbc:EndpointID>
      <cac:PartyIdentification><cbc:ID>${receiverPeppolId}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${escapeXml(receiverName)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>SK${receiverPeppolId.split(":")[1]}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(receiverName)}</cbc:RegistrationName>
        <cbc:CompanyID>${receiverPeppolId.split(":")[1]}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${taxTotal.toFixed(2)}</cbc:TaxAmount>${vatSubtotalsXml}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${netTotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${netTotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${grossTotal.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currency}">${grossTotal.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${linesXml}
</Invoice>`;
}

async function sendWithTestToken(xml: string): Promise<{ id: number; state: string }> {
  const token = process.env.ION_AP_TEST_SENDER_TOKEN;
  if (!token) throw new Error("ION_AP_TEST_SENDER_TOKEN is not configured");

  const rawBaseUrl = await getIonApBaseUrl();
  // Strip trailing slashes and /api/v2 suffix if already present
  const baseUrl = rawBaseUrl.replace(/\/+$/, "").replace(/\/api\/v2\/?$/, "");
  const url = `${baseUrl}/api/v2/send-document`;

  console.log(`[TEST-INVOICES] Sending to: ${url}`);

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
    throw new Error(`ion-AP send-document failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function sendTestInvoicesToCompany(
  companyDic: string,
  companyName: string
): Promise<{ sent: number; errors: string[] }> {
  const receiverPeppolId = `0245:${companyDic}`;
  const invoices = getTestInvoices();
  let sent = 0;
  const errors: string[] = [];

  for (const invoice of invoices) {
    const xml = generateUblInvoice(invoice, receiverPeppolId, companyName);
    try {
      await sendWithTestToken(xml);
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${invoice.id}: ${msg}`);
    }
  }

  return { sent, errors };
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
