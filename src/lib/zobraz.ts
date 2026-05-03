// Thin client for zobrazfakturu's POST /api/v1/render. Self-hosted PDF
// rendering for Peppol UBL XML — replaces ION AP's PDF endpoints for
// received documents.
//
// Auth is API key + secret (created in zobraz's UI). One zobraz user
// represents postar2 as a whole, so the daily quota on that user caps
// total daily renders. The PDF cache on documents.pdf_blob_url means
// you only render each document once.

const RENDER_PATH = "/api/v1/render";

export type ZobrazLocale = "sk" | "en";

export type ZobrazValidation = {
  status: "ok" | "failed" | "unavailable";
  errors: number;
  warnings: number;
  documentType: string | null;
};

export type ZobrazRenderResult = {
  pdf: Buffer;
  validation: ZobrazValidation;
};

export class ZobrazError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(message);
    this.name = "ZobrazError";
  }
}

export async function renderInvoicePdf(
  xml: string,
  opts: { locale?: ZobrazLocale } = {}
): Promise<ZobrazRenderResult> {
  // Trim defensively — Vercel env UI can occasionally pick up trailing
  // whitespace from copy-paste. zobraz checks key equality strictly.
  const baseUrl = process.env.ZOBRAZ_BASE_URL?.trim();
  const apiKey = process.env.ZOBRAZ_API_KEY?.trim();
  const apiSecret = process.env.ZOBRAZ_API_SECRET?.trim();

  if (!baseUrl || !apiKey || !apiSecret) {
    throw new ZobrazError(
      "ZOBRAZ_BASE_URL, ZOBRAZ_API_KEY, ZOBRAZ_API_SECRET must all be set",
      0,
      ""
    );
  }

  const locale = opts.locale ?? "sk";
  const url = `${baseUrl.replace(/\/$/, "")}${RENDER_PATH}`;

  // Diagnostic: log shape of what we're sending without leaking secrets.
  // Shows prefix+suffix+length so you can verify the env values weren't
  // truncated, swapped, or mangled in Vercel's UI.
  const reveal = (s: string) =>
    s.length <= 8 ? `<len=${s.length}>` : `${s.slice(0, 4)}…${s.slice(-4)} (len=${s.length})`;
  console.log(
    "[zobraz] render request:",
    JSON.stringify({
      url,
      apiKey: reveal(apiKey),
      apiKeyHasPrefix: apiKey.startsWith("zef_"),
      apiSecret: reveal(apiSecret),
      apiSecretHasPrefix: apiSecret.startsWith("zefs_"),
      locale,
      xmlBytes: Buffer.byteLength(xml, "utf8"),
    })
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
      "X-API-Key": apiKey,
      "X-API-Secret": apiSecret,
      "X-Language": locale,
    },
    body: xml,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(
      "[zobraz] render failed:",
      JSON.stringify({ status: res.status, body: body.slice(0, 300) })
    );
    throw new ZobrazError(
      `zobraz render failed: ${res.status} ${res.statusText}`,
      res.status,
      body.slice(0, 1000)
    );
  }

  const pdf = Buffer.from(await res.arrayBuffer());
  const validation: ZobrazValidation = {
    status:
      (res.headers.get("X-Peppol-Validator-Status") as ZobrazValidation["status"]) ??
      "unavailable",
    errors: Number(res.headers.get("X-Peppol-Errors") ?? 0),
    warnings: Number(res.headers.get("X-Peppol-Warnings") ?? 0),
    documentType: res.headers.get("X-Peppol-Document-Type"),
  };

  return { pdf, validation };
}
