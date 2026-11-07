import InventoryWorkspace from "@/components/InventoryWorkspace";
import RawItemsWorkspace from "@/components/RawItemsWorkspace";
import CategoryWorkspace from "@/components/CategoryWorkspace";
import UnitWorkspace from "@/components/UnitWorkspace";
import {notFound} from "next/navigation";
import SupplierWorkspace from "@/components/SupplierWorkspace";
import PurchasingWorkspace from "@/components/PurchasingWorkspace";
import StockDocumentsWorkspace from "@/components/StockDocumentsWorkspace";
import ReconWorkspace from "@/components/ReconWorkspace";
import MovementWorkspace from "@/components/MovementWorkspace";
import SrnWorkspace from "@/components/SrnWorkspace";
import LocationWorkspace from "@/components/LocationWorkspace";
import InventoryTransactions from "@/components/InventoryTransactions";

export const dynamic = "force-dynamic";
const transactionSections = new Set(["po", "grn", "srn", "damage", "transfer-requisition", "transfer-note", "transfer-return", "issue-requisition", "issue-note", "stock-reconciliation"]);
export default async function InventoryPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "modes") notFound();
  if (section === "items") return <RawItemsWorkspace/>;
  const movementKeys = {"transfer-requisition":"trq", "transfer-note":"tn", "transfer-return":"tr", "issue-requisition":"irq", "issue-note":"inn"} as const;
  const movement = movementKeys[section as keyof typeof movementKeys];
  if (movement) return <MovementWorkspace key={section} kind={movement} />;
  return section === "locations" ? <LocationWorkspace /> : section === "srn" ? <SrnWorkspace /> : section === "stock-reconciliation" ? <ReconWorkspace /> : section === "damage" ? <StockDocumentsWorkspace key={section} kind="damage" /> : section === "po" || section === "grn" ? <PurchasingWorkspace key={section} section={section} /> : section === "categories" ? <CategoryWorkspace /> : section === "units" ? <UnitWorkspace /> : section === "suppliers" ? <SupplierWorkspace /> : transactionSections.has(section) ? <InventoryTransactions section={section} /> : <InventoryWorkspace />;
}
