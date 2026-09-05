"use server";

import { prisma } from "@/lib/prisma";

export interface ReportFilter {
  startDate: string;
  endDate: string;
  outletId?: number;
}

export async function getTransactionSummaryAction(filters: ReportFilter) {
  try {
    const { startDate, endDate, outletId } = filters;

    const salesData = await prisma.sale.groupBy({
      by: ["createdDate"],
      where: {
        createdDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        ...(outletId && { outletId }),
      },
      _count: { id: true },
      _sum: {
        localPax: true,
        foreignPax: true,
        foodSales: true,
        beverageSales: true,
        sigarSales: true,
        otherSales: true,
        totalSales: true,
        taxAmount: true,
      },
      orderBy: { createdDate: "asc" },
    });

    
    const rows = salesData.map((row: any) => {
      const bills = row._count.id || 1;
      const localPax = row._sum.localPax || 0;
      const foreignPax = row._sum.foreignPax || 0;
      const totalPax = localPax + foreignPax;
      const totalSales = row._sum.totalSales || 0;

      return {
        txnDate: new Date(row.createdDate).toISOString().split("T")[0],
        bills,
        localPax,
        foreignPax,
        totalPax,
        spendingPerBill: totalSales / bills,
        spendingPerPax: totalPax > 0 ? totalSales / totalPax : 0,
        avgPaxPerBill: totalPax / bills,
        avgTimePerBill: "0:00:00",
        foodSales: row._sum.foodSales || 0,
        beverageSales: row._sum.beverageSales || 0,
        sigarSales: row._sum.sigarSales || 0,
        otherSales: row._sum.otherSales || 0,
        salesSupp: 0,
        salesWOT: 0,
        taxVolume: row._sum.taxAmount || 0,
        salesVolume: totalSales,
      };
    });

    return { success: true, data: rows };
  } catch (error) {
    console.error("Report Action Error:", error);
    return { success: false, error: "Database Data Fetching Failed." };
  }
}