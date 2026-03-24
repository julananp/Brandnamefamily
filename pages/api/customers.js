// pages/api/customers.js
import { readSheet, appendRow, deleteRow, updateRow } from "../../lib/sheets";

const CUSTS = "👤 Customers";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const custs = await readSheet(CUSTS);
      // ถ้า ?summary=true ให้รวมยอดซื้อขายด้วย
      if (req.query.summary === "true") {
        const stock = await readSheet("📦 Stock");
        const result = custs.map(c => {
          const cid = c["Customer ID"];
          const sellItems = stock.filter(s => s["Customer ID เจ้าของ"] === cid);
          const buyItems  = stock.filter(s => s["Customer ID ผู้ซื้อ"]  === cid);
          return {
            ...c,
            _sellCount:        sellItems.length,
            _buyCount:         buyItems.length,
            _totalSellToShop:  sellItems.reduce((s, x) => s + parseFloat(x["ราคารับซื้อ (฿)"] || 0), 0),
            _totalBuyFromShop: buyItems.reduce((s, x)  => s + parseFloat(x["ราคาขายออก (฿)"] || 0), 0),
          };
        });
        return res.status(200).json(result);
      }
      return res.status(200).json(custs);
    }

    if (req.method === "POST") {
      const d = req.body;
      const custs = await readSheet(CUSTS);
      const phone = (d.phone || "").trim();

      // เช็คเบอร์ซ้ำ
      if (phone) {
        const existing = custs.find(c => (c["เบอร์โทร"] || "").trim() === phone);
        if (existing) return res.status(200).json({ success: true, custId: existing["Customer ID"], existed: true });
      }

      const custId = `CUS-${String(custs.length + 2).padStart(4, "0")}`;
      const today  = new Date().toLocaleDateString("th-TH");
      const row = [
        custId, d.type || "ซื้อ", d.name || "", phone,
        d.dob || "", d.idCard || "", d.address || "",
        d.igLine || "", d.email || "", d.notes || "",
        today, d.type === "ขาย" ? (d.buyDate || today) : ""
      ];
      await appendRow(CUSTS, row);
      return res.status(200).json({ success: true, custId, existed: false });
    }

    if (req.method === "DELETE") {
      await deleteRow(CUSTS, req.body.rowNum);
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
