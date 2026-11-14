export interface MasterCatalogEntry {
  id: string;
  name: string;
  category: "Demand Letters" | "Receipts";
  description: string;
  sourcePdf: string;
}

export const MASTER_CATALOG: MasterCatalogEntry[] = [
  {
    id: "master-demand-1",
    name: "Demand Letter 1 - Pioneer Housing (Senroofs)",
    category: "Demand Letters",
    description: "Exact PDF layout for Pioneer Housing Senroofs payment intimation with merge-field overlays.",
    sourcePdf: "Demand_1.pdf",
  },
  {
    id: "master-demand-2",
    name: "Demand Letter 2 - Dimple Realtors (WestWood)",
    category: "Demand Letters",
    description: "Exact PDF layout for Dimple Realtors WestWood demand letter with TDS breakup fields.",
    sourcePdf: "Demand_2.pdf",
  },
  {
    id: "master-demand-3",
    name: "Demand Letter 3 - Gurukrupa Realcon Developers",
    category: "Demand Letters",
    description: "Exact PDF layout for Gurukrupa Realcon Developers demand letter.",
    sourcePdf: "Demand_3.pdf",
  },
  {
    id: "master-demand-4",
    name: "Demand Letter 4 - Sankalp Builders (Tax Invoice)",
    category: "Demand Letters",
    description: "Exact PDF layout for Sankalp Builders tax invoice and demand letter.",
    sourcePdf: "Demand_4.pdf",
  },
  {
    id: "master-demand-5",
    name: "Demand Letter 5 - AK Hitech Associates (Sapphire)",
    category: "Demand Letters",
    description: "Exact PDF layout for AK Hitech Associates Sapphire payment intimation.",
    sourcePdf: "Demand_5.pdf",
  },
  {
    id: "master-demand-6",
    name: "Demand Letter 6 - Royal Buildcon (Avencia)",
    category: "Demand Letters",
    description: "Exact PDF layout for Royal Buildcon Avencia demand letter.",
    sourcePdf: "Demand_6.pdf",
  },
  {
    id: "master-demand-7",
    name: "Demand Letter 7 - LMP Group (Rita Palace)",
    category: "Demand Letters",
    description: "Exact PDF layout for LMP Group Rita Palace demand note.",
    sourcePdf: "Demand_7.pdf",
  },
  {
    id: "master-receipt-1",
    name: "Receipt 1 - Pioneer Housing (Senroofs)",
    category: "Receipts",
    description: "Exact PDF layout for Pioneer Housing Senroofs payment receipt.",
    sourcePdf: "Receipt_1.pdf",
  },
  {
    id: "master-receipt-2",
    name: "Receipt 2 - Standard Payment Receipt",
    category: "Receipts",
    description: "Exact PDF layout for the standard payment receipt format.",
    sourcePdf: "Receipt_2.pdf",
  },
  {
    id: "master-receipt-3",
    name: "Receipt 3 - Comprehensive Receipt (PAN & GST)",
    category: "Receipts",
    description: "Exact PDF layout for the comprehensive PAN and GST receipt.",
    sourcePdf: "Receipt_3.pdf",
  },
  {
    id: "master-receipt-4",
    name: "Receipt 4 - Sankalp Builders",
    category: "Receipts",
    description: "Exact PDF layout for Sankalp Builders statutory payment receipt.",
    sourcePdf: "Receipt_4.pdf",
  },
  {
    id: "master-receipt-5",
    name: "Receipt 5 - Margin Table Receipt",
    category: "Receipts",
    description: "Exact PDF layout for the compact margin-table receipt format.",
    sourcePdf: "Receipt_5.pdf",
  },
  {
    id: "master-receipt-6",
    name: "Receipt 6 - Royal Buildcon",
    category: "Receipts",
    description: "Exact PDF layout for Royal Buildcon company receipt.",
    sourcePdf: "Receipt_6.pdf",
  },
  {
    id: "master-receipt-7",
    name: "Receipt 7 - LMP Group (Rita Palace)",
    category: "Receipts",
    description: "Exact PDF layout for LMP Group Rita Palace receipt.",
    sourcePdf: "Receipt_7.pdf",
  },
];
