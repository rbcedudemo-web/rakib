import { ResultsOverview } from "@/components/reports/ResultsTables";

export const metadata = { title: "Results" };

export default function AdminResultsPage() {
  return <main><ResultsOverview basePath="/admin/results" reviewPath="/admin/marking" /></main>;
}
