// pages/api/dashboard.js
import { readSheet } from "../../lib/sheets";

function toNum(v) {
  const n = parseFloat(String(v || 0).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

export default async function handler(req, res) {
  try {
    const [stock, customers] = await Promise.all([
      readSheet("📦 Stock"),
      readSheet("👤 Customers"),
    ]);

    const today = new Date(); today.setHours(0,0,0,0);
    const buyStock = stock.filter(s => !s["ประเภทธุรกรรม"] || s["ประเภทธุรกรรม"] === "รับซื้อ");
    const consign  = stock.filter(s => s["ประเภทธุรกรรม"] === "ฝากขาย");
    const pawns    = stock.filter(s => s["ประเภทธุรกรรม"] === "จำนำ");

    const inStock    = buyStock.filter(s => s["สถานะ"] === "In Stock");
    const soldOut    = buyStock.filter(s => s["สถานะ"] === "Sold Out");
    const pawnActive = pawns.filter(s => s["สถานะ"] === "จำนำ");

    const totalBought  = buyStock.reduce((s, x) => s + toNum(x["ราคารับซื้อ (฿)"]), 0);
    const totalSold    = soldOut.reduce((s, x)  => s + toNum(x["ราคาขายออก (฿)"]), 0);
    const inStockValue = inStock.reduce((s, x)  => s + toNum(x["ราคารับซื้อ (฿)"]), 0);
    const totalProfit  = soldOut.reduce((s, x)  => s + toNum(x["กำไร (฿)"]), 0);
    const totalPawnAmt = pawnActive.reduce((s, x) => s + toNum(x["วงเงินจำนำ (฿)"]), 0);

    // ดอกเบี้ยสะสม real-time
    let totalInterest = 0;
    pawnActive.forEach(s => {
      try {
        const pawnAmt = toNum(s["วงเงินจำนำ (฿)"]);
        const intPct  = toNum(s["% ดอกเบี้ย/เดือน"]);
        const start   = new Date(s["วันที่รับเข้า"] || s["วันที่รับซื้อ"]);
        const days    = Math.round((today - start) / 86400000);
        totalInterest += Math.round(pawnAmt * intPct / 100 * (days / 30));
      } catch(e) {}
    });

    // ใกล้ครบกำหนด ≤ 7 วัน
    const nearDueItems = pawnActive.filter(s => {
      try {
        const due  = new Date(s["วันครบกำหนด"]);
        const diff = Math.round((due - today) / 86400000);
        return diff >= 0 && diff <= 7;
      } catch(e) { return false; }
    });
    const overdueItems = pawnActive.filter(s => {
      try { return new Date(s["วันครบกำหนด"]) < today; }
      catch(e) { return false; }
    });

    const brandCount = {}, typeCount = {};
    stock.forEach(s => {
      const b = s["แบรนด์"] || "ไม่ระบุ";
      const t = s["ประเภท"] || "ไม่ระบุ";
      brandCount[b] = (brandCount[b] || 0) + 1;
      typeCount[t]  = (typeCount[t]  || 0) + 1;
    });

    res.status(200).json({
      totalItems: buyStock.length, inStockCount: inStock.length,
      soldCount: soldOut.length, totalCustomers: customers.length,
      totalBought, totalSold, inStockValue, totalProfit,
      consignCount: consign.filter(s => s["สถานะ"] === "ฝากขาย").length,
      pawnCount: pawnActive.length, totalPawnAmt, totalInterest,
      nearDueCount: nearDueItems.length, nearDueItems,
      overdueCount: overdueItems.length,
      forfeitedCount: pawns.filter(s => s["สถานะ"] === "หลุดจำนำ").length,
      inStockItems: inStock, brandCount, typeCount,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
