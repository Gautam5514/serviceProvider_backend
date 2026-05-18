const PDFDocument = require("pdfkit");

// Helper to format currency
const formatPrice = (value = 0) => {
  return `INR ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Helper to format date
const formatDate = (value) => {
  return new Date(value || Date.now()).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

async function generateInvoicePdf({ booking, customerName, providerName, providerGSTin = "URP123456789", providerPhone = "" }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // --- 1. HEADER ---
    doc.fillColor("#000000").fontSize(20).font("Helvetica-Bold").text("ServiceMarket", 40, 40);
    doc.fontSize(10).font("Helvetica").fillColor("#555555").text("Professional Home Services", 40, 65);

    doc.fontSize(16).font("Helvetica-Bold").fillColor("#000000").text("TAX INVOICE", 400, 40, { align: "right" });
    
    // --- 2. INVOICE METADATA ---
    doc.rect(40, 90, 515, 0.5).fill("#e4e4e7"); // Divider line
    
    let metaTop = 105;
    doc.fontSize(9).fillColor("#71717a").font("Helvetica-Bold").text("INVOICE NO:", 40, metaTop);
    doc.fillColor("#000000").font("Helvetica").text(booking.bookingNumber || "BK-99212", 110, metaTop);

    doc.fillColor("#71717a").font("Helvetica-Bold").text("DATE:", 40, metaTop + 15);
    doc.fillColor("#000000").font("Helvetica").text(formatDate(booking.completedAt), 110, metaTop + 15);

    doc.fillColor("#71717a").font("Helvetica-Bold").text("PLACE OF SUPPLY:", 250, metaTop);
    doc.fillColor("#000000").font("Helvetica").text(booking.address?.city?.toUpperCase() || "NEW DELHI", 360, metaTop);

    // --- 3. ADDRESS SECTION (Grid Layout) ---
    let addressTop = 150;
    
    // Sold By (Provider)
    doc.fontSize(10).font("Helvetica-Bold").text("Sold By / Service Partner:", 40, addressTop);
    doc.fontSize(9).font("Helvetica").text(providerName, 40, addressTop + 15);
    doc.text(providerPhone, 40, addressTop + 28);
    doc.fillColor("#71717a").text(`GSTIN: ${providerGSTin}`, 40, addressTop + 41);

    // Service Location (Customer)
    doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold").text("Service Location / Billed To:", 300, addressTop);
    doc.fontSize(9).font("Helvetica").text(customerName, 300, addressTop + 15);
    doc.fillColor("#52525b").text(`${booking.address?.text}, ${booking.address?.city} - ${booking.address?.pincode}`, 300, addressTop + 28, { width: 250 });

    // --- 4. TABLE HEADER ---
    let tableTop = 240;
    doc.rect(40, tableTop, 515, 25).fill("#f8f8f8");
    doc.fillColor("#555555").fontSize(8).font("Helvetica-Bold");
    doc.text("DESCRIPTION", 50, tableTop + 8);
    doc.text("SAC CODE", 250, tableTop + 8);
    doc.text("NET AMOUNT", 350, tableTop + 8, { width: 80, align: "right" });
    doc.text("TAX", 430, tableTop + 8, { width: 40, align: "right" });
    doc.text("TOTAL", 480, tableTop + 8, { width: 65, align: "right" });

    // --- 5. TABLE ROWS ---
    let rowTop = tableTop + 35;
    const basePrice = booking.pricing?.basePrice || 0;
    const tax = booking.pricing?.tax || 0;
    const total = booking.pricing?.totalAmount || 0;

    // Service Row
    doc.fillColor("#000000").fontSize(9).font("Helvetica");
    doc.text(booking.serviceName || "Home Cleaning Service", 50, rowTop);
    doc.fillColor("#71717a").text("9987 (Cleaning Services)", 250, rowTop);
    doc.fillColor("#000000").text(formatPrice(basePrice), 350, rowTop, { width: 80, align: "right" });
    doc.text(formatPrice(tax), 430, rowTop, { width: 40, align: "right" });
    doc.text(formatPrice(total), 480, rowTop, { width: 65, align: "right" });

    // --- 6. TAX BREAKDOWN BOX ---
    let summaryTop = 350;
    doc.rect(300, summaryTop, 255, 120).stroke("#e4e4e7");

    const drawSummaryRow = (label, value, y, isBold = false) => {
      doc.fontSize(9).font(isBold ? "Helvetica-Bold" : "Helvetica").fillColor(isBold ? "#000000" : "#52525b");
      doc.text(label, 310, y);
      doc.text(value, 465, y, { width: 80, align: "right" });
    };

    drawSummaryRow("Subtotal", formatPrice(basePrice), summaryTop + 15);
    drawSummaryRow("Platform Fee", formatPrice(booking.pricing?.platformFee || 0), summaryTop + 30);
    drawSummaryRow("CGST (9%)", formatPrice(tax / 2), summaryTop + 45);
    drawSummaryRow("SGST (9%)", formatPrice(tax / 2), summaryTop + 60);
    
    if(booking.pricing?.discount > 0) {
        drawSummaryRow("Discount", `- ${formatPrice(booking.pricing.discount)}`, summaryTop + 75);
    }

    doc.rect(300, summaryTop + 90, 255, 30).fill("#000000");
    doc.fillColor("#ffffff").font("Helvetica-Bold").text("GRAND TOTAL", 310, summaryTop + 100);
    doc.text(formatPrice(total), 465, summaryTop + 100, { width: 80, align: "right" });

    // --- 7. FOOTER SECTION ---
    // Amount in words
    doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold").text("Amount in Words:", 40, summaryTop + 130);
    doc.font("Helvetica").text("Rupees Three Thousand Four Hundred and Ninety Only", 40, summaryTop + 142); // Logic for words can be added via 'number-to-words' library

    // Payment Details
    doc.rect(40, 520, 240, 60).fill("#f1f5f9");
    doc.fillColor("#475569").fontSize(8).font("Helvetica-Bold").text("PAYMENT INFORMATION", 50, 530);
    doc.fillColor("#000000").font("Helvetica").text(`Method: ${booking.paymentMethod === 'cash' ? 'Cash' : 'Online'}`, 50, 545);
    doc.text(`Status: ${booking.paymentStatus?.toUpperCase() || 'PAID'}`, 50, 558);

    // Declaration
    doc.fontSize(8).fillColor("#71717a").text(
      "Declaration: This is a computer-generated invoice and does not require a physical signature. The services listed are rendered by the service partner mentioned above. ServiceMarket acts as a facilitator between the customer and the service partner.",
      40,
      720,
      { align: "left", width: 515 }
    );

    doc.fontSize(10).fillColor("#000000").font("Helvetica-Bold").text("Thank you for using ServiceMarket!", 40, 770, { align: "center", width: 515 });

    doc.end();
  });
}

module.exports = { generateInvoicePdf };