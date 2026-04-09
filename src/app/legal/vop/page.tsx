import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalContent } from "@/components/legal-content";

export const metadata: Metadata = {
  title: "VOP — peppolbox.sk",
  description: "Všeobecné obchodné podmienky služby peppolbox.sk",
};

export default function VopPage() {
  const filePath = path.join(process.cwd(), "src/content/legal/vop.md");
  const content = fs.readFileSync(filePath, "utf-8");
  return <LegalContent content={content} />;
}
