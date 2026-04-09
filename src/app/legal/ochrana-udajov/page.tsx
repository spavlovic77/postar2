import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalContent } from "@/components/legal-content";

export const metadata: Metadata = {
  title: "Ochrana osobných údajov — peppolbox.sk",
  description: "Zásady ochrany osobných údajov služby peppolbox.sk",
};

export default function OchranaPage() {
  const filePath = path.join(process.cwd(), "src/content/legal/ochrana-udajov.md");
  const content = fs.readFileSync(filePath, "utf-8");
  return <LegalContent content={content} />;
}
