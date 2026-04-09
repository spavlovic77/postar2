import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalContent } from "@/components/legal-content";

export const metadata: Metadata = {
  title: "DPA — peppolbox.sk",
  description: "Zmluva o spracúvaní osobných údajov peppolbox.sk",
};

export default function DpaPage() {
  const filePath = path.join(process.cwd(), "src/content/legal/dpa.md");
  const content = fs.readFileSync(filePath, "utf-8");
  return <LegalContent content={content} />;
}
