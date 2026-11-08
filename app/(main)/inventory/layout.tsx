import InventoryDialog from "@/components/InventoryDialog";
import './inventory-typography.css';

export default function InventoryLayout({children}:{children:React.ReactNode}){
  return <div className="inventory-report-typography">{children}<InventoryDialog/></div>;
}
