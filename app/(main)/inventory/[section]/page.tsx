import InventoryWorkspace from "@/components/InventoryWorkspace";
import CategoryWorkspace from "@/components/CategoryWorkspace";
import UnitWorkspace from "@/components/UnitWorkspace";
import ModesWorkspace from "@/components/ModesWorkspace";
import SupplierWorkspace from "@/components/SupplierWorkspace";
import InventoryTransactions from "@/components/InventoryTransactions";

export const dynamic = "force-dynamic";
const transactionSections = new Set(["po", "grn", "srn", "damage", "transfer-requisition", "transfer-note", "transfer-return", "issue-requisition", "issue-note", "stock-reconciliation"]);
export default async function InventoryPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return section === "categories" ? <CategoryWorkspace /> : section === "units" ? <UnitWorkspace /> : section === "modes" ? <ModesWorkspace /> : section === "suppliers" ? <SupplierWorkspace /> : transactionSections.has(section) ? <InventoryTransactions section={section} /> : <InventoryWorkspace />;
}
