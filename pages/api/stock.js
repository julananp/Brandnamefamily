// pages/api/stock.js
import { readSheet, appendRow, updateRow, deleteRow } from "../../lib/sheets";

const STOCK = "📦 Stock";

function toNum(v) {
  const n = parseFloat(String(v || 0).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function genId(prefix, lastRow) {
  return `${prefix}-${String(lastRow).padStart(4, "0")}`;
}

export default async function handler(req, res) {
  try {
    // ── GET — ดึง Stock ทั้งหมด ──────────────
    if (req.method === "GET") {
      const stock = await readSheet(STOCK);
      return res.status(200).json(stock);
    }

    // ── POST — เพิ่มสินค้าใหม่ ───────────────
    if (req.method === "POST") {
      const d = req.body;
      const stock = await readSheet(STOCK);
      const stockId = genId("STK", stock.length + 2);
      const txType = d.txType || "รับซื้อ";
      const initStatus = txType === "รับซื้อ" ? "In Stock"
                       : txType === "ฝากขาย"  ? "ฝากขาย" : "จำนำ";

      const salePrice = toNum(d.salePrice);
      const comPct    = toNum(d.comPct);
      const comAmt    = txType === "ฝากขาย" ? Math.round(salePrice * comPct / 100) : "";
      const ownerRet  = txType === "ฝากขาย" ? salePrice - (comAmt || 0) : "";
      const pawnAmt   = toNum(d.pawnAmt);
      const intPct    = toNum(d.intPct);

      let daysCount = "", totalRedeem = "";
      if (txType === "จำนำ" && d.dueDate && d.buyDate) {
        const days = Math.round((new Date(d.dueDate) - new Date(d.buyDate)) / 86400000);
        daysCount   = days;
        totalRedeem = Math.round(pawnAmt + pawnAmt * intPct / 100 * (days / 30));
      }

      const row = [
        stockId, txType, initStatus,
        d.buyDate || new Date().toLocaleDateString("th-TH"),
        d.type || "", d.brand || "", d.model || "",
        d.size || "", d.color || "", d.hardware || "",
        txType === "รับซื้อ" ? d.buyPrice || "" : "",
        d.ownerCustId || "", d.sellerName || "",
        "", "", "", "", "",
        txType === "ฝากขาย" ? salePrice : "",
        txType === "ฝากขาย" ? comPct : "",
        txType === "ฝากขาย" ? comAmt : "",
        txType === "ฝากขาย" ? ownerRet : "",
        txType === "ฝากขาย" ? d.dueDate || "" : "",
        txType === "จำนำ" ? pawnAmt : "",
        txType === "จำนำ" ? intPct : "",
        txType === "จำนำ" ? d.dueDate || "" : "",
        txType === "จำนำ" ? daysCount : "",
        "", txType === "จำนำ" ? totalRedeem : "",
        d.notes || ""
      ];

      await appendRow(STOCK, row);
      return res.status(200).json({ success: true, stockId });
    }

    // ── PUT — อัปเดต / ขายออก / ไถ่จำนำ / หลุดจำนำ ──
    if (req.method === "PUT") {
      const { action, rowNum, data } = req.body;

      if (action === "sell") {
        await updateRow(STOCK, rowNum, 3,  "Sold Out");
        await updateRow(STOCK, rowNum, 14, data.sellDate);
        await updateRow(STOCK, rowNum, 15, data.sellPrice);
        await updateRow(STOCK, rowNum, 16, data.buyerCustId || "");
        await updateRow(STOCK, rowNum, 17, data.buyerName || "");
        const buyPrice = toNum(data.buyPrice);
        await updateRow(STOCK, rowNum, 18, toNum(data.sellPrice) - buyPrice);
        return res.status(200).json({ success: true });
      }

      if (action === "redeem") {
        await updateRow(STOCK, rowNum, 3,  "ไถ่คืนแล้ว");
        await updateRow(STOCK, rowNum, 27, data.interest);
        await updateRow(STOCK, rowNum, 28, data.total);
        return res.status(200).json({ success: true });
      }

      if (action === "forfeit") {
        await updateRow(STOCK, rowNum, 3, "หลุดจำนำ");
        return res.status(200).json({ success: true });
      }

      if (action === "return") {
        await updateRow(STOCK, rowNum, 3, "คืนเจ้าของ");
        return res.status(200).json({ success: true });
      }

      if (action === "update") {
        const stock = await readSheet(STOCK);
        const headers = Object.keys(stock[0]).filter(k => k !== "_row");
        for (const [field, value] of Object.entries(data)) {
          if (field === "_note") continue;
          const colIdx = headers.indexOf(field) + 1;
          if (colIdx > 0) await updateRow(STOCK, rowNum, colIdx, value);
        }
        return res.status(200).json({ success: true });
      }
    }

    // ── DELETE — ลบสินค้า ────────────────────
    if (req.method === "DELETE") {
      const { rowNum } = req.body;
      await deleteRow(STOCK, rowNum);
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
}
