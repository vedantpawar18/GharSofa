import Order from "../models/orderModel.js";
import PDFDocument from "pdfkit";
import ExcelJS from 'exceljs';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import {generateReport} from "../utils/generateReport.js";

const generateSalesReport = async (req, res) => {
  try {
    const {filter, fromDate, toDate} = req.query;

    let startDate, endDate;

    if (fromDate && toDate) {
      startDate = new Date(fromDate);
      endDate = new Date(toDate);
    } else {
      const today = new Date();
      switch (filter) {
        case "Daily":
          startDate = new startOfDay(today);
          endDate = new endOfDay(today);
          break;
        case "Weekly":
          startDate = new startOfWeek(today);
          endDate = new endOfWeek(today);
          break;
        case "Monthly":
          startDate = new startOfMonth(today);
          endDate = new endOfMonth(today);
          break;
        default:
          return res.status(400).json({message: "Invalid filter type"});
      }
    }

    const report = await generateReport(startDate, endDate);

    return res.status(200).json({message: "Success", report});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to get the sales report "});
  }
};

const downloadSalesReport = async (req, res) => {
  console.log("this is frm the req.body of downloadSalesReport PDF", req.body);
  try {
    const {filter, fromDate, toDate, format} = req.query;

    let startDate, endDate;

    if (fromDate && toDate) {
      startDate = new Date(fromDate);
      endDate = new Date(toDate);
    } else {
      const today = new Date();
      switch (filter) {
        case "Daily":
          startDate = new startOfDay(today);
          endDate = new endOfDay(today);
          break;
        case "Weekly":
          startDate = new startOfWeek(today);
          endDate = new endOfWeek(today);
          break;
        case "Monthly":
          startDate = new startOfMonth(today);
          endDate = new endOfMonth(today);
          break;
        default:
          return res.status(400).json({message: "Invalid filter type"});
      }
    }
    const report = await generateReport(startDate, endDate);

    if (format === "pdf") {

      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=sales_report.pdf"
      );

      doc.pipe(res);


      doc.fontSize(18).text("Sales Report", { align: "center" });
      doc.moveDown();

      doc.fontSize(12).text(`Total Revenue: ₹${report.summary.totalRevenue.toFixed(2)}`);
      doc.text(`Total Quantity: ${report.summary.totalQuantity}`);
      doc.text(`Total Orders: ${report.summary.totalOrders}`);
      doc.text(`Average Order Value: ₹${report.summary.averageOrderValue.toFixed(2)}`);
      doc.moveDown();

      const table = {
        headers: ["Product Name", "Product Brand", "Quantity", "Revenue"],
        rows: report.topProducts.map(product => [
          product.productName,
          product.productBrand,
          product.totalQuantity.toString(),
          `₹ ${product.totalRevenue.toFixed(2)}`
        ])
      };

      const columnWidths = [250, 100, 70, 100];

      doc.fontSize(10).font('Helvetica-Bold');
      let y = doc.y + 20;
      table.headers.forEach((header, i) => {
        doc.text(header, 50 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), y, {
          width: columnWidths[i],
          align: 'left'
        });
      });

      doc.font('Helvetica');
      table.rows.forEach((row, i) => {
        y += 20;
        row.forEach((cell, j) => {
          doc.text(cell, 50 + columnWidths.slice(0, j).reduce((a, b) => a + b, 0), y, {
            width: columnWidths[j],
            align: j === 3 ? 'right' : 'left' 
          });
        });
      });

      doc.moveDown();
      doc.fontSize(10).text(`Report Period: ${fromDate} to ${toDate}`, { align: 'center' });

      doc.end();



    } else if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Report");

      worksheet.columns = [
        {header: "Summary", key: "summary", width: 30},
        {header: "Total Revenue", key: "totalRevenue", width: 20},
        {header: "Total Quantity", key: "totalQuantity", width: 20},
        {header: "Total Orders", key: "totalOrders", width: 20},
      ];

      worksheet.addRow({
        summary: "Summary",
        totalRevenue: report.summary.totalRevenue.toFixed(2),
        totalQuantity: report.summary.totalQuantity,
        totalOrders: report.summary.totalOrders,
      });

      worksheet.addRow({summary: ""});

      worksheet.columns = [
        {header: "Date", key: "date", width: 20},
        {header: "Revenue", key: "revenue", width: 20},
        {header: "Quantity", key: "quantity", width: 20},
        {header: "Order Count", key: "orderCount", width: 20},
      ];

      report.dailyData.forEach((day) => {
        worksheet.addRow({
          date: day.date,
          revenue: day.revenue.toFixed(2),
          quantity: day.quantity,
          orderCount: day.orderCount,
        });
      });

      worksheet.addRow({date: ""});

      worksheet.columns = [
        {header: "Product Name", key: "productName", width: 20},
        {header: "Brand", key: "productBrand", width: 20},
        {header: "Total Revenue", key: "totalRevenue", width: 20},
        {header: "Total Quantity", key: "totalQuantity", width: 20},
      ];

      report.topProducts.forEach((product) => {
        worksheet.addRow({
          productName: product.productName,
          productBrand: product.productBrand,
          totalRevenue: product.totalRevenue.toFixed(2),
          totalQuantity: product.totalQuantity,
        });
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=sales_report.xlsx"
      );

      await workbook.xlsx.write(res);
      res.end();
    } else {
      return res.status(400).json({message: "Invalid format type"});
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to generate PDF report"});
  }
};

export {generateSalesReport, downloadSalesReport};
