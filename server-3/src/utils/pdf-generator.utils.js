import PDFDocument from 'pdfkit';

/**
 * Professional PDF Generator for Transaction Statements
 * Generates beautifully formatted PDF statements with branding
 */

/**
 * Format currency value with proper Indian formatting
 */
const formatCurrency = (amount, currency = 'INR') => {
    // Convert to fixed decimal
    const fixedAmount = Number(amount).toFixed(2);
    
    // Split into integer and decimal parts
    const parts = fixedAmount.split('.');
    let integerPart = parts[0];
    const decimalPart = parts[1];
    
    // Add commas for Indian numbering (last 3 digits, then groups of 2)
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    
    if (otherNumbers !== '') {
        integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
    } else {
        integerPart = lastThree;
    }
    
    // Return formatted currency
    const symbol = currency === 'INR' ? 'Rs.' : currency;
    return `${symbol} ${integerPart}.${decimalPart}`;
};

/**
 * Format date for PDF display
 */
const formatPdfDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

/**
 * Draw a horizontal line
 */
const drawLine = (doc, y, options = {}) => {
    const { strokeColor = '#E5E7EB', lineWidth = 1, margin = 50 } = options;
    doc.strokeColor(strokeColor)
        .lineWidth(lineWidth)
        .moveTo(margin, y)
        .lineTo(doc.page.width - margin, y)
        .stroke();
};

/**
 * Draw table header
 */
const drawTableHeader = (doc, y, headers, columnWidths, columnAligns) => {
    let x = 50;
    
    // Header background
    doc.rect(50, y - 5, doc.page.width - 100, 25)
        .fillAndStroke('#F3F4F6', '#D1D5DB');
    
    // Draw vertical lines between columns
    let lineX = 50;
    for (let i = 0; i < columnWidths.length; i++) {
        lineX += columnWidths[i];
        if (i < columnWidths.length - 1) {
            doc.strokeColor('#D1D5DB')
                .lineWidth(0.5)
                .moveTo(lineX, y - 5)
                .lineTo(lineX, y + 20)
                .stroke();
        }
    }
    
    // Header text
    doc.fillColor('#374151')
        .fontSize(9)
        .font('Helvetica-Bold');
    
    headers.forEach((header, i) => {
        doc.text(header, x + 5, y + 5, {
            width: columnWidths[i] - 10,
            align: columnAligns[i] || 'left',
        });
        x += columnWidths[i];
    });
    
    return y + 30;
};

/**
 * Draw table row
 */
const drawTableRow = (doc, y, values, columnWidths, columnAligns, options = {}) => {
    const { fontSize = 8, textColor = '#1F2937', alternateRow = false } = options;
    let x = 50;
    
    // Alternate row background
    if (alternateRow) {
        doc.rect(50, y - 3, doc.page.width - 100, 18)
            .fill('#F9FAFB');
    }
    
    // Draw vertical lines between columns
    let lineX = 50;
    for (let i = 0; i < columnWidths.length; i++) {
        lineX += columnWidths[i];
        if (i < columnWidths.length - 1) {
            doc.strokeColor('#E5E7EB')
                .lineWidth(0.5)
                .moveTo(lineX, y - 3)
                .lineTo(lineX, y + 15)
                .stroke();
        }
    }
    
    doc.fillColor(textColor)
        .fontSize(fontSize)
        .font('Helvetica');
    
    values.forEach((value, i) => {
        doc.text(value, x + 5, y, {
            width: columnWidths[i] - 10,
            align: columnAligns[i] || 'left',
        });
        x += columnWidths[i];
    });
    
    return y + 18;
};

/**
 * Generate professional transaction statement PDF
 * 
 * @param {Object} options - PDF generation options
 * @param {Object} options.shop - Shop information
 * @param {Array} options.transactions - Array of transaction objects
 * @param {Object} options.dateRange - Start and end dates
 * @param {Object} options.summary - Summary statistics
 * @returns {PDFDocument} - PDF document stream
 */
export const generateTransactionStatementPDF = (options) => {
    const { shop, transactions, dateRange, summary } = options;
    
    // Create PDF document
    const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
            Title: 'Transaction Statement',
            Author: 'EverCut',
            Subject: `Transaction Statement for ${shop.shopName}`,
            Keywords: 'transactions, statement, earnings',
        },
    });
    
    let yPosition = 50;
    
    // ═══════════════════════════════════════════════════════════════
    // HEADER SECTION
    // ═══════════════════════════════════════════════════════════════
    
    // Company Logo/Name
    doc.fontSize(24)
        .fillColor('#1F2937')
        .font('Helvetica-Bold')
        .text('EverCut', 50, yPosition);
    
    yPosition += 30;
    
    // Document Title
    doc.fontSize(16)
        .fillColor('#6B7280')
        .font('Helvetica-Bold')
        .text('Transaction Statement', 50, yPosition);
    
    yPosition += 35;
    
    // ═══════════════════════════════════════════════════════════════
    // SHOP INFORMATION SECTION
    // ═══════════════════════════════════════════════════════════════
    
    // Shop details box
    doc.roundedRect(50, yPosition, 250, 70, 5)
        .fillAndStroke('#F9FAFB', '#E5E7EB');
    
    doc.fontSize(9)
        .fillColor('#6B7280')
        .font('Helvetica')
        .text('Shop Name', 60, yPosition + 10);
    
    doc.fontSize(11)
        .fillColor('#1F2937')
        .font('Helvetica-Bold')
        .text(shop.shopName || 'N/A', 60, yPosition + 25, { width: 230 });
    
    doc.fontSize(9)
        .fillColor('#6B7280')
        .font('Helvetica')
        .text('Owner', 60, yPosition + 45);
    
    doc.fontSize(10)
        .fillColor('#1F2937')
        .font('Helvetica')
        .text(shop.ownerName || 'N/A', 60, yPosition + 58);
    
    // Date range box
    const dateBoxX = doc.page.width - 300;
    doc.roundedRect(dateBoxX, yPosition, 250, 70, 5)
        .fillAndStroke('#EEF2FF', '#C7D2FE');
    
    doc.fontSize(9)
        .fillColor('#4338CA')
        .font('Helvetica')
        .text('Statement Period', dateBoxX + 10, yPosition + 10);
    
    doc.fontSize(11)
        .fillColor('#312E81')
        .font('Helvetica-Bold')
        .text(
            `${formatPdfDate(dateRange.startDate)} - ${formatPdfDate(dateRange.endDate)}`,
            dateBoxX + 10,
            yPosition + 25,
            { width: 230 }
        );
    
    doc.fontSize(9)
        .fillColor('#4338CA')
        .font('Helvetica')
        .text('Generated On', dateBoxX + 10, yPosition + 45);
    
    doc.fontSize(10)
        .fillColor('#312E81')
        .font('Helvetica')
        .text(formatPdfDate(new Date()), dateBoxX + 10, yPosition + 58);
    
    yPosition += 90;
    
    // ═══════════════════════════════════════════════════════════════
    // SUMMARY SECTION
    // ═══════════════════════════════════════════════════════════════
    
    doc.fontSize(13)
        .fillColor('#1F2937')
        .font('Helvetica-Bold')
        .text('Summary', 50, yPosition);
    
    yPosition += 25;
    
    // Summary cards
    const cardWidth = (doc.page.width - 120) / 3;
    const summaryData = [
        { label: 'Total Transactions', value: summary.totalTransactions.toString(), color: '#3B82F6' },
        { label: 'Total Amount', value: formatCurrency(summary.totalAmount, 'INR'), color: '#10B981' },
        { label: 'Average Transaction', value: formatCurrency(summary.averageAmount, 'INR'), color: '#8B5CF6' },
    ];
    
    summaryData.forEach((item, index) => {
        const cardX = 50 + (cardWidth + 10) * index;
        
        // Card background
        doc.roundedRect(cardX, yPosition, cardWidth, 55, 5)
            .fillAndStroke('#FFFFFF', '#E5E7EB');
        
        // Label
        doc.fontSize(8)
            .fillColor('#6B7280')
            .font('Helvetica')
            .text(item.label, cardX + 10, yPosition + 10, { width: cardWidth - 20 });
        
        // Value
        doc.fontSize(14)
            .fillColor(item.color)
            .font('Helvetica-Bold')
            .text(item.value, cardX + 10, yPosition + 28, { width: cardWidth - 20 });
    });
    
    yPosition += 75;
    
    // ═══════════════════════════════════════════════════════════════
    // TRANSACTIONS TABLE
    // ═══════════════════════════════════════════════════════════════
    
    doc.fontSize(13)
        .fillColor('#1F2937')
        .font('Helvetica-Bold')
        .text('Transaction Details', 50, yPosition);
    
    yPosition += 25;
    
    // Table configuration - optimized column widths for full Transaction ID display
    // Total width: 515pt (A4 width 595pt - 50pt left - 50pt right margins)
    const columnWidths = [60, 130, 85, 70, 65, 105];
    const columnAligns = ['left', 'left', 'left', 'left', 'left', 'left'];
    const headers = ['Date', 'Transaction ID', 'Customer', 'Amount', 'Status', 'Mode'];
    
    // Draw table header
    yPosition = drawTableHeader(doc, yPosition, headers, columnWidths, columnAligns);
    
    // Draw table rows
    transactions.forEach((transaction, index) => {
        // Check if we need a new page
        if (yPosition > doc.page.height - 100) {
            doc.addPage();
            yPosition = 50;
            yPosition = drawTableHeader(doc, yPosition, headers, columnWidths, columnAligns);
        }
        
        // Don't truncate transaction IDs anymore - show full ID
        const txnId = transaction.transactionId;
        
        // Truncate long customer names if needed
        let customerName = transaction.customerName;
        if (customerName.length > 13) {
            customerName = customerName.substring(0, 11) + '..';
        }
        
        // Truncate long payment modes if needed
        let paymentMode = transaction.paymentMode || 'N/A';
        if (paymentMode.length > 16) {
            paymentMode = paymentMode.substring(0, 14) + '..';
        }
        
        const values = [
            formatPdfDate(transaction.date),
            txnId,
            customerName,
            formatCurrency(transaction.amount, transaction.currency),
            transaction.status,
            paymentMode,
        ];
        
        yPosition = drawTableRow(doc, yPosition, values, columnWidths, columnAligns, {
            alternateRow: index % 2 === 0,
        });
    });
    
    yPosition += 10;
    drawLine(doc, yPosition, { strokeColor: '#D1D5DB', lineWidth: 2 });
    yPosition += 15;
    
    // ═══════════════════════════════════════════════════════════════
    // FOOTER SECTION - Total Earnings Box
    // ═══════════════════════════════════════════════════════════════
    
    // Check if we have enough space for the total box (need 70pt)
    if (yPosition > doc.page.height - 120) {
        doc.addPage();
        yPosition = 50;
    }
    
    // Total amount box
    doc.roundedRect(doc.page.width - 250, yPosition, 200, 50, 5)
        .fillAndStroke('#ECFDF5', '#10B981');
    
    doc.fontSize(9)
        .fillColor('#065F46')
        .font('Helvetica')
        .text('Total Earnings', doc.page.width - 240, yPosition + 10);
    
    doc.fontSize(16)
        .fillColor('#047857')
        .font('Helvetica-Bold')
        .text(
            formatCurrency(summary.totalAmount, 'INR'),
            doc.page.width - 240,
            yPosition + 25
        );
    
    // Finalize the PDF
    doc.end();
    
    return doc;
};

/**
 * Generate summary statistics for transactions
 */
export const calculateTransactionSummary = (transactions) => {
    const totalTransactions = transactions.length;
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const averageAmount = totalTransactions > 0 ? totalAmount / totalTransactions : 0;
    
    return {
        totalTransactions,
        totalAmount,
        averageAmount,
    };
};
