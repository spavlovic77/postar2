import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/dal";
import { TestTracker } from "./test-tracker";

export default async function TestTrackerPage() {
  const data = await getUserWithRole();
  if (!data) redirect("/");
  if (data.role !== "super_admin") redirect("/dashboard");

  return <TestTracker />;
}
