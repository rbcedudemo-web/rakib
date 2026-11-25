import { ReviewQueue } from "@/components/marking/ReviewQueue";

export const metadata = { title: "Review scripts" };

export default async function AdminMarkingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <main><ReviewQueue basePath="/admin/marking" tab={tab === "marked" ? "marked" : "pending"} /></main>;
}
