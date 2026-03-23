import type { DocumentMetadata } from "./types";

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

    // Line items (first 5 names)
    const lineItems: string[] = [];
    const lineBlocks = extractAllBlocks(xml, "InvoiceLine|CreditNoteLine");
    for (const line of lineBlocks.slice(0, 5)) {
      const itemBlock = extractBlock(line, "Item");
      if (itemBlock) {
        const name = extractTag(itemBlock, "Name") ?? extractTag(itemBlock, "Description");
        if (name) lineItems.push(name.trim());
      }
    }
    if (lineItems.length > 0) {
      metadata.lineItems = lineItems;
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
  return match?.[1]?.trim() || undefined;
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
