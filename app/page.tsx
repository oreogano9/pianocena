import { CenaPlanner } from "@/components/cena-planner";
import { currentSupportedMonth } from "@/lib/months";

export const dynamic = "force-dynamic";

export default function Home() {
  return <CenaPlanner initialMonth={currentSupportedMonth()} />;
}
