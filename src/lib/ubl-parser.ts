import type { DocumentMetadata, DocumentLineDetail } from "./types";

/**
 * Parse UBL Invoice/CreditNote XML and extract metadata.
 * Uses regex-based extraction (no XML parser dependency).
 * Handles namespaced and non-namespaced UBL documents.
 */
export function parseUblMetadata(xml: string): DocumentMetadata {
  const metadata: DocumentMetadata = {};

  try {
    // Supplier (AccountingSupplierParty)
    const supplierBlock = extractBlock(xml, "AccountingSupplierParty");
    if (supplierBlock) {
      metadata.supplierName =
        extractTag(supplierBlock, "RegistrationName") ??
        extractTag(supplierBlock, "Name");
      metadata.supplierTaxId =
        extractTag(supplierBlock, "CompanyID") ??
        extractTag(supplierBlock, "EndpointID");
    }

    // Buyer (AccountingCustomerParty)
    const buyerBlock = extractBlock(xml, "AccountingCustomerParty");
    if (buyerBlock) {
      metadata.buyerName =
        extractTag(buyerBlock, "RegistrationName") ??
        extractTag(buyerBlock, "Name");
      metadata.buyerTaxId =
        extractTag(buyerBlock, "CompanyID") ??
        extractTag(buyerBlock, "EndpointID");
    }

    // Totals (LegalMonetaryTotal)
    const totalsBlock = extractBlock(xml, "LegalMonetaryTotal");
    if (totalsBlock) {
      metadata.totalAmount =
        extractTag(totalsBlock, "PayableAmount") ??
        extractTag(totalsBlock, "TaxInclusiveAmount");
    }

    // Currency
    metadata.currency =
      extractTag(xml, "DocumentCurrencyCode") ??
      extractAttribute(xml, "PayableAmount", "currencyID") ??
      extractAttribute(xml, "TaxInclusiveAmount", "currencyID");

    // Tax total
    const taxBlock = extractBlock(xml, "TaxTotal");
    if (taxBlock) {
      metadata.taxAmount = extractTag(taxBlock, "TaxAmount");
    }

    // Dates
    metadata.issueDate = extractTag(xml, "IssueDate");
    metadata.dueDate =
      extractTag(xml, "DueDate") ??
      extractTag(xml, "PaymentDueDate");

    // PaymentMeans → IBAN, BIC, payment symbols
    const paymentBlock = extractBlock(xml, "PaymentMeans");
    if (paymentBlock) {
      const accountBlock = extractBlock(paymentBlock, "PayeeFinancialAccount");
      if (accountBlock) {
        const accountId = extractTag(accountBlock, "ID");
        if (accountId && /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/i.test(accountId.replace(/\s+/g, ""))) {
          metadata.paymentIban = accountId.replace(/\s+/g, "").toUpperCase();
        }
        const branchBlock = extractBlock(accountBlock, "FinancialInstitutionBranch");
        if (branchBlock) {
          metadata.paymentBic = extractTag(branchBlock, "ID");
        }
      }

      // PaymentID often carries the variable symbol in Slovak e-invoices.
      // Some senders put structured codes like "/VS123/SS456/KS0308"
      // others just the bare digits.
      const paymentId = extractTag(paymentBlock, "PaymentID");
      if (paymentId) {
        const symbols = parsePaymentSymbols(paymentId);
        if (symbols.vs) metadata.variableSymbol = symbols.vs;
        if (symbols.ss) metadata.specificSymbol = symbols.ss;
        if (symbols.ks) metadata.constantSymbol = symbols.ks;
      }
    }

    // Line items (first 5 names + amounts)
    const lineItems: string[] = [];
    const lineDetails: DocumentLineDetail[] = [];
    const lineBlocks = extractAllBlocks(xml, "InvoiceLine|CreditNoteLine");
    for (const line of lineBlocks.slice(0, 5)) {
      const itemBlock = extractBlock(line, "Item");
      if (itemBlock) {
        const name = extractTag(itemBlock, "Name") ?? extractTag(itemBlock, "Description");
        if (name) {
          lineItems.push(name.trim());
          const amount = extractTag(line, "LineExtensionAmount");
          lineDetails.push({ name: name.trim(), amount: amount ?? undefined });
        }
      }
    }
    if (lineItems.length > 0) {
      metadata.lineItems = lineItems;
      metadata.lineDetails = lineDetails;
    }
  } catch (err) {
    console.error("UBL parse error:", err);
  }

  return metadata;
}

/**
 * Extract the text content of a tag (handles namespaces).
 * Matches both <cbc:Name>value</cbc:Name> and <Name>value</Name>
 */
function extractTag(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(
    `<(?:[a-z]+:)?${tagName}[^>]*>([^<]+)</(?:[a-z]+:)?${tagName}>`,
    "i"
  );
  const match = xml.match(regex);
  return match?.[1]?.trim() ? decodeXmlEntities(match[1].trim()) : undefined;
}

/**
 * Decode XML character entities (named + numeric).
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extract an attribute value from a tag.
 */
function extractAttribute(
  xml: string,
  tagName: string,
  attrName: string
): string | undefined {
  const regex = new RegExp(
    `<(?:[a-z]+:)?${tagName}[^>]*${attrName}="([^"]+)"[^>]*>`,
    "i"
  );
  const match = xml.match(regex);
  return match?.[1]?.trim() || undefined;
}

/**
 * Extract the first block (opening to closing tag) for a tag name.
 */
function extractBlock(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(
    `<(?:[a-z]+:)?${tagName}[^>]*>[\\s\\S]*?</(?:[a-z]+:)?${tagName}>`,
    "i"
  );
  const match = xml.match(regex);
  return match?.[0] || undefined;
}

/**
 * Extract all blocks for a tag name pattern (supports | for alternation).
 */
function extractAllBlocks(xml: string, tagPattern: string): string[] {
  const regex = new RegExp(
    `<(?:[a-z]+:)?(?:${tagPattern})[^>]*>[\\s\\S]*?</(?:[a-z]+:)?(?:${tagPattern})>`,
    "gi"
  );
  return Array.from(xml.matchAll(regex)).map((m) => m[0]);
}

/**
 * Parse a Slovak PaymentID into VS/SS/KS components.
 * Handles three forms:
 *   "/VS2546874464/SS2019568456/KS1118" — structured
 *   "VS:2546874464"                      — labeled
 *   "2546874464"                         — bare digits → treated as VS
 */
export function parsePaymentSymbols(input: string): {
  vs?: string;
  ss?: string;
  ks?: string;
} {
  const trimmed = input.trim();
  if (!trimmed) return {};

  const result: { vs?: string; ss?: string; ks?: string } = {};

  // Structured form
  const vsMatch = trimmed.match(/\/?VS[:\s]?(\d{1,10})/i);
  const ssMatch = trimmed.match(/\/?SS[:\s]?(\d{1,10})/i);
  const ksMatch = trimmed.match(/\/?KS[:\s]?(\d{1,4})/i);

  if (vsMatch) result.vs = vsMatch[1];
  if (ssMatch) result.ss = ssMatch[1];
  if (ksMatch) result.ks = ksMatch[1];

  // If no labels matched, treat bare digits as VS
  if (!result.vs && !result.ss && !result.ks && /^\d{1,10}$/.test(trimmed)) {
    result.vs = trimmed;
  }

  return result;
}
