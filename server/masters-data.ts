import type { DocumentDefinition, VariableDefinition } from "../shared/types";

export interface MasterSpec {
  id: string;
  name: string;
  category: "Demand Letters" | "Receipts";
  description: string;
  definition: DocumentDefinition;
  variables: VariableDefinition[];
}

export const MASTERS: MasterSpec[] = [
  // =========================================================================
  // DEMAND 1: Pioneer Housing - Senroofs
  // =========================================================================
  {
    id: "master-demand-1",
    name: "Demand Letter 1 - Pioneer Housing (Senroofs)",
    category: "Demand Letters",
    description: "Payment intimation for installment due on flat cost and GST with detailed banking accounts for Pioneer Housing Senroofs Phase III.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        companyTitle: { fontSize: 16, bold: true, color: "#0f172a" },
        subHeader: { fontSize: 9, color: "#475569" },
        subject: { fontSize: 10, bold: true, color: "#0f172a", margin: [0, 8, 0, 8] },
        tableHeader: { bold: true, fontSize: 9, fillColor: "#f1f5f9", alignment: "center" },
        tableCell: { fontSize: 9 },
        tableCellBold: { fontSize: 9, bold: true },
        bankHeader: { fontSize: 9, bold: true, color: "#0f172a" },
        bankText: { fontSize: 8.5, color: "#334155" },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" },
      },
      content: [
        {
          columns: [
            {
              stack: [
                { text: "PIONEER HOUSING", style: "companyTitle" },
                { text: "Senroofs Project, Nahur / Mulund West, Mumbai", style: "subHeader" },
              ],
            },
            {
              text: "Date: {{current_date}}",
              alignment: "right",
              bold: true,
              margin: [0, 4, 0, 0],
            },
          ],
          margin: [0, 0, 0, 16],
        },
        {
          stack: [
            { text: "To,", bold: true },
            { text: "{{customer_name}}", bold: true },
            { text: "{{customer_address}}", color: "#334155" },
            { text: "Email :- {{customer_email}}", color: "#334155" },
            { text: "Mob :- {{customer_phone}}", color: "#334155" },
            { text: "Slab Completion :- {{slab_completion_date}}", bold: true, margin: [0, 4, 0, 0] },
          ],
          margin: [0, 0, 0, 12],
        },
        {
          text: "Subject :- Intimation for payment of {{installment_name}} against your Booking of Flat No. {{unit_name}} on {{unit_floor}} floor, of Tower “{{wing}}” in Senroofs Project, {{project_address}}",
          style: "subject",
        },
        {
          text: "Dear Madam/ Sir, ,",
          margin: [0, 0, 0, 6],
        },
        {
          text: "Pursuant to Allotment / Agreement in respect of above referred flat, we have to inform you that a payment of ₹{{final_amount}} ({{final_amount_in_words}}) is due and payable separately as below.",
          margin: [0, 0, 0, 10],
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 120, 100],
            body: [
              [
                { text: "INSTALLMENT DUE", style: "tableHeader", alignment: "left" },
                { text: "ON FLAT COST", style: "tableHeader", alignment: "right" },
                { text: "GST", style: "tableHeader", alignment: "right" },
              ],
              [
                { text: "Previous Demand Value", style: "tableCell" },
                { text: "₹{{previous_slabs_amount}}", style: "tableCell", alignment: "right" },
                { text: "₹{{previous_slabs_gst_amount}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "{{installment_name}}", style: "tableCell" },
                { text: "₹{{latest_slab_amount}}", style: "tableCell", alignment: "right" },
                { text: "₹{{latest_slab_gst_amount}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "Total Amount Due {{total_percentage}}%", style: "tableCellBold" },
                { text: "₹{{pending_amount_as_per_work}}", style: "tableCellBold", alignment: "right" },
                { text: "₹{{pending_tax_as_per_work}}", style: "tableCellBold", alignment: "right" },
              ],
              [
                { text: "Less Amount Received ……………………….", style: "tableCell" },
                { text: "₹{{amount_paid}}", style: "tableCell", alignment: "right" },
                { text: "₹{{tax_paid}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "AMOUNT DUE ……………………………….", style: "tableCellBold", fillColor: "#f8fafc" },
                { text: "₹{{total_due_amount}}", style: "tableCellBold", alignment: "right", fillColor: "#f8fafc" },
                { text: "₹{{total_tax_amount}}", style: "tableCellBold", alignment: "right", fillColor: "#f8fafc" },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 4, 0, 12],
        },
        {
          text: "You are requested to kindly make the above payment as soon as possible from the receipt of this letter otherwise interest will be charged on delay payment. Please find the banking details below.",
          margin: [0, 0, 0, 10],
          fontSize: 9.5,
        },
        {
          stack: [
            {
              text: "FLAT COST BANKING DETAILS",
              style: "bankHeader",
            },
            {
              text: "“PIONEER HOUSING SENROOFS PHASE III COLLECTION A/ C. , Kotak Mahindra Bank Ltd., Mulund West Branch, Account No. 4946470941 and IFSC CODE KKBK0000642. MIRC Code : 400485006",
              style: "bankText",
              margin: [0, 2, 0, 6],
            },
            {
              text: "GST BANKING DETAILS",
              style: "bankHeader",
            },
            {
              text: "“PIONEER HOUSING” Bank of India A/ C. No. 009020110000971, Small Scale Ind Andheri - East Br., and IFSC CODE BKID0000090. MIRC Code : 400013050.",
              style: "bankText",
              margin: [0, 2, 0, 12],
            },
          ],
        },
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "Yours Faithfully,", margin: [0, 0, 0, 4] },
                { text: "For PIONEER HOUSING", bold: true, margin: [0, 0, 0, 36] },
                { text: "AUTHORISED SIGNATORY", style: "signatory" },
              ],
              alignment: "right",
              width: 200,
            },
          ],
        },
      ],
    },
    variables: [
      { id: "current_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Vipin Tomar", required: true, group: "Customer Details", order: 1, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "Flat No 402, Building A, Sunrise Heights, Mumbai 400078", required: true, group: "Customer Details", order: 2, bindings: [] },
      { id: "customer_email", label: "Email", type: "email", defaultValue: "vipintomar@gmail.com", required: false, group: "Contact Details", order: 3, bindings: [] },
      { id: "customer_phone", label: "Mobile", type: "phone", defaultValue: "+91 98765 43210", required: false, group: "Contact Details", order: 4, bindings: [] },
      { id: "slab_completion_date", label: "Slab Completion Date", type: "date", defaultValue: "2026-10-25", required: true, group: "Document Details", order: 5, bindings: [] },
      { id: "installment_name", label: "Installment Name", type: "text", defaultValue: "14th Slab", required: true, group: "Document Details", order: 6, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "1402", required: true, group: "Property Details", order: 7, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "14th", required: true, group: "Property Details", order: 8, bindings: [] },
      { id: "wing", label: "Tower / Wing", type: "text", defaultValue: "A", required: true, group: "Property Details", order: 9, bindings: [] },
      { id: "project_address", label: "Project Address", type: "textarea", defaultValue: "L.B.S. Marg, Mulund West, Mumbai - 400080", required: true, group: "Project Details", order: 10, bindings: [] },
      { id: "final_amount", label: "Total Final Amount", type: "currency", defaultValue: 420000, required: true, group: "Financial Details", order: 11, bindings: [] },
      { id: "final_amount_in_words", label: "Final Amount in Words", type: "text", defaultValue: "Rupees Four Lakh Twenty Thousand Only", required: false, group: "Financial Details", order: 12, bindings: [] },
      { id: "previous_slabs_amount", label: "Previous Slabs Amount", type: "currency", defaultValue: 3500000, required: false, group: "Financial Details", order: 13, bindings: [] },
      { id: "previous_slabs_gst_amount", label: "Previous Slabs GST Amount", type: "currency", defaultValue: 175000, required: false, group: "Financial Details", order: 14, bindings: [] },
      { id: "latest_slab_amount", label: "Current Slab Amount", type: "currency", defaultValue: 400000, required: true, group: "Financial Details", order: 15, bindings: [] },
      { id: "latest_slab_gst_amount", label: "Current Slab GST Amount", type: "currency", defaultValue: 20000, required: true, group: "Financial Details", order: 16, bindings: [] },
      { id: "total_percentage", label: "Total Work Percentage", type: "percent", defaultValue: 85, required: false, group: "Financial Details", order: 17, bindings: [] },
      { id: "pending_amount_as_per_work", label: "Pending Flat Cost As Per Work", type: "currency", defaultValue: 3900000, required: false, group: "Financial Details", order: 18, bindings: [] },
      { id: "pending_tax_as_per_work", label: "Pending Tax As Per Work", type: "currency", defaultValue: 195000, required: false, group: "Financial Details", order: 19, bindings: [] },
      { id: "amount_paid", label: "Amount Paid Till Date", type: "currency", defaultValue: 3500000, required: false, group: "Financial Details", order: 20, bindings: [] },
      { id: "tax_paid", label: "Tax Paid Till Date", type: "currency", defaultValue: 175000, required: false, group: "Financial Details", order: 21, bindings: [] },
      { id: "total_due_amount", label: "Total Flat Cost Due", type: "currency", defaultValue: 400000, required: true, group: "Financial Details", order: 22, bindings: [] },
      { id: "total_tax_amount", label: "Total Tax Due", type: "currency", defaultValue: 20000, required: true, group: "Financial Details", order: 23, bindings: [] },
    ],
  },

  // =========================================================================
  // DEMAND 2: Dimple Realtors - WestWood
  // =========================================================================
  {
    id: "master-demand-2",
    name: "Demand Letter 2 - Dimple Realtors (WestWood)",
    category: "Demand Letters",
    description: "Agreement for sale payment demand letter with TDS 1% deduction breakup, architect certificate reference, and dual SBI bank accounts.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        headerTitle: { fontSize: 15, bold: true, alignment: "center", color: "#0f172a", margin: [0, 8, 0, 8] },
        tableHeader: { bold: true, fontSize: 9.5, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9.5 },
        boldCell: { fontSize: 9.5, bold: true },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" },
      },
      content: [
        {
          columns: [
            { text: "" },
            { text: "Date: {{slab_completion_date}}", alignment: "right", bold: true },
          ],
          margin: [0, 0, 0, 12],
        },
        {
          stack: [
            { text: "To,", bold: true },
            { text: "{{customer_name}}", bold: true },
            { text: "{{customer_address}}", color: "#334155" },
          ],
          margin: [0, 0, 0, 10],
        },
        {
          text: "Ref: Agreement for sale of Flat No. {{unit_name}} on the {{unit_floor}} Floor, Wing {{wing}} in the building known as {{project_name}}, situated on all that piece and parcel of lands bearing {{project_address}}",
          margin: [0, 0, 0, 8],
        },
        {
          text: "Sub: Demand Letter for Payment",
          style: "headerTitle",
        },
        {
          text: "Dear Sir/ Madam,",
          margin: [0, 0, 0, 6],
        },
        {
          text: "This is to inform you that {{installment_name}} Work is commenced on site for Sale Building known as {{project_name}} and certificate for Architect is enclosed herewith for your reference. As per the clause 4 of the Agreement for sale, the payment due till commencement of the above work is ₹{{pending_amount_as_per_work}}/- out of which we have received ₹{{amount_paid}}/-. So the balance amount of ₹{{total_due_amount}}/- and GST of ₹{{total_tax_amount}}/- is due.",
          margin: [0, 0, 0, 10],
        },
        {
          text: "Breakup of payment",
          bold: true,
          margin: [0, 0, 0, 4],
        },
        {
          table: {
            widths: [200, 140],
            body: [
              [
                { text: "Payment Due", style: "tableCell" },
                { text: "₹{{total_due_amount_with_tds}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "Less: TDS @ 1%", style: "tableCell" },
                { text: "₹{{pending_tds_as_per_work}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "Balance", style: "boldCell", fillColor: "#f8fafc" },
                { text: "₹{{balance_as_per_work}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 8],
        },
        {
          text: "Kindly pay online TDS of ₹{{pending_tds_as_per_work}}",
          bold: true,
          color: "#0369a1",
          margin: [0, 0, 0, 8],
        },
        {
          text: "We hereby call upon you to pay the amount of ₹{{balance_as_per_work}} and GST ₹{{total_tax_amount}}/- which is payable immediately on receipt of this letter. We further inform that under the said Agreement for sale, you shall be liable to pay interest on all amounts due and payable under the said Agreement for sale, if the same remains unpaid for 7 days or more after becoming due.",
          margin: [0, 0, 0, 12],
        },
        {
          columns: [
            {
              stack: [
                { text: "1. Kindly issue all 100 % of Flat Cost by RTGS/ NEFT in favour of “Dimple Realtors Pvt Ltd – WestWood – Collection Account”, A/ c no. 40794790823 State Bank of India, Backbay Reclamation (Mumbai) Branch, IFSC – SBIN0001593.", fontSize: 8.5, color: "#334155", margin: [0, 0, 0, 4] },
                { text: "2. Kindly issue all GST Amount by RTGS/ NEFT in favour of “Dimple Realtors Pvt Ltd Tax A/ c.” State Bank of India, Borivali (West) Branch, A/ c no – 40107382026, IFSC – SBIN0006441.", fontSize: 8.5, color: "#334155" },
              ],
              width: "*",
            },
            {
              stack: [
                { text: "Thanking You,", margin: [0, 0, 0, 2] },
                { text: "For Dimple Realtors Pvt. Ltd.,", bold: true, margin: [0, 0, 0, 36] },
                { text: "Authorised Signatory", style: "signatory" },
              ],
              width: 170,
              alignment: "right",
            },
          ],
        },
      ],
    },
    variables: [
      { id: "slab_completion_date", label: "Date / Slab Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Rajesh Sharma", required: true, group: "Customer Details", order: 1, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "B-204, Greenfield Heights, Malad West, Mumbai 400064", required: true, group: "Customer Details", order: 2, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "804", required: true, group: "Property Details", order: 3, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "8th", required: true, group: "Property Details", order: 4, bindings: [] },
      { id: "wing", label: "Wing", type: "text", defaultValue: "B", required: true, group: "Property Details", order: 5, bindings: [] },
      { id: "project_name", label: "Project Name", type: "text", defaultValue: "WestWood", required: true, group: "Project Details", order: 6, bindings: [] },
      { id: "project_address", label: "Project Address", type: "textarea", defaultValue: "CTS No. 452, Off Link Road, Goregaon West, Mumbai", required: true, group: "Project Details", order: 7, bindings: [] },
      { id: "installment_name", label: "Installment Name / Stage", type: "text", defaultValue: "8th Slab", required: true, group: "Document Details", order: 8, bindings: [] },
      { id: "pending_amount_as_per_work", label: "Payment Due Till Commencement", type: "currency", defaultValue: 5200000, required: true, group: "Financial Details", order: 9, bindings: [] },
      { id: "amount_paid", label: "Amount Received", type: "currency", defaultValue: 4500000, required: true, group: "Financial Details", order: 10, bindings: [] },
      { id: "total_due_amount", label: "Balance Flat Amount Due", type: "currency", defaultValue: 700000, required: true, group: "Financial Details", order: 11, bindings: [] },
      { id: "total_tax_amount", label: "GST Due Amount", type: "currency", defaultValue: 35000, required: true, group: "Financial Details", order: 12, bindings: [] },
      { id: "total_due_amount_with_tds", label: "Payment Due Before TDS", type: "currency", defaultValue: 700000, required: true, group: "Financial Details", order: 13, bindings: [] },
      { id: "pending_tds_as_per_work", label: "TDS @ 1%", type: "currency", defaultValue: 7000, required: true, group: "Financial Details", order: 14, bindings: [] },
      { id: "balance_as_per_work", label: "Net Balance Due", type: "currency", defaultValue: 693000, required: true, group: "Financial Details", order: 15, bindings: [] },
    ],
  },

  // =========================================================================
  // DEMAND 3: Gurukrupa Realcon Developers
  // =========================================================================
  {
    id: "master-demand-3",
    name: "Demand Letter 3 - Gurukrupa Realcon Developers",
    category: "Demand Letters",
    description: "2-page formal demand letter with agreement details, demand percentage, flat cost & GST particulars table, and IDBI Bank account particulars.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        companyTitle: { fontSize: 14, bold: true, alignment: "center", color: "#0f172a" },
        letterHeader: { fontSize: 9.5, color: "#334155" },
        tableHeader: { bold: true, fontSize: 9, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9 },
        boldCell: { fontSize: 9, bold: true },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" },
      },
      content: [
        { text: "Gurukrupa Realcon Developers Private Limited", style: "companyTitle" },
        {
          canvas: [{ type: "line", x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 1, lineColor: "#cbd5e1" }],
          margin: [0, 4, 0, 12],
        },
        {
          columns: [
            {
              stack: [
                { text: "Letter No -: {{project_name}} / {{wing}} {{unit_name}} / Demand", bold: true },
                { text: "Payee -: {{customer_name}}", bold: true },
                { text: "Address -: {{customer_address}}", color: "#334155" },
                { text: "Project & Wing Unit No -: {{project_name}} / {{wing}} {{unit_name}}" },
                { text: "Project Address-: {{project_address}}", color: "#334155" },
              ],
              width: "*",
            },
            {
              text: "Date: {{slab_completion_date}}",
              alignment: "right",
              bold: true,
              width: 140,
            },
          ],
          margin: [0, 0, 0, 12],
        },
        {
          text: "Dear Sir/ Madam\nHope you are doing well and keeping safe.",
          margin: [0, 0, 0, 6],
        },
        {
          text: "We would just like to inform you that we have successfully completed {{installment_name}} and as per our agreed terms and conditions under the payment schedule mentioned Below.",
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            {
              stack: [
                { text: "Agreement Execution Date -: {{effective_date}}" },
                { text: "Agreement Registration Date -: {{agreement_date}}" },
              ],
            },
            {
              stack: [
                { text: "Agreement Value -: ₹{{agreement_amount}}", bold: true },
                { text: "Demand Percentage -: {{total_percentage}} %", bold: true },
              ],
            },
          ],
          margin: [0, 0, 0, 10],
        },
        {
          text: "We request you to complete the payment as early as possible. Hereby attaching the “Architect Certificate” with this letter for your reference.",
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 120, 110],
            body: [
              [
                { text: "Particulars", style: "tableHeader" },
                { text: "Flat Cost", style: "tableHeader", alignment: "right" },
                { text: "GST 5%", style: "tableHeader", alignment: "right" },
              ],
              [
                { text: "Agreement Value (AV)", style: "tableCell" },
                { text: "₹{{agreement_amount}}", style: "tableCell", alignment: "right" },
                { text: "₹{{total_gst}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "Amount Bill till date ({{total_percentage}} %) of AV", style: "tableCellBold" },
                { text: "₹{{pending_amount_as_per_work}}", style: "tableCellBold", alignment: "right" },
                { text: "₹{{pending_tax_as_per_work}}", style: "tableCellBold", alignment: "right" },
              ],
              [
                { text: "Amount Received till date", style: "tableCell" },
                { text: "₹{{amount_paid}}", style: "tableCell", alignment: "right" },
                { text: "₹{{tax_paid}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "Total Amount Payable", style: "boldCell", fillColor: "#f8fafc" },
                { text: "₹{{total_due_amount}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" },
                { text: "₹{{total_tax_amount}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 8],
        },
        {
          text: "Note: Delay in the payment shall levy interest on your due payment as agreed in the Agreement.",
          fontSize: 8.5,
          italics: true,
          color: "#64748b",
          margin: [0, 0, 0, 16],
          pageBreak: "after",
        },
        // PAGE 2
        {
          text: "Please Issue the Amount in Cheque or RTGS as mentioned below-:",
          bold: true,
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: [80, 120, 110, 110, 80],
            body: [
              [
                { text: "Payment Term", style: "tableHeader" },
                { text: "Company Name", style: "tableHeader" },
                { text: "Bank Name & Branch", style: "tableHeader" },
                { text: "Account No", style: "tableHeader" },
                { text: "IFSC Code", style: "tableHeader" },
              ],
              [
                { text: "FLAT COST Payment", style: "tableCellBold" },
                { text: "Gurukrupa Realcon Developers Private Limited", style: "tableCell" },
                { text: "IDBI Bank\nGhatkopar East", style: "tableCell" },
                { text: "0033102000028848", style: "tableCellBold" },
                { text: "IBKL0000033", style: "tableCell" },
              ],
              [
                { text: "GST Payment", style: "tableCellBold" },
                { text: "Gurukrupa Realcon Developers Private Limited", style: "tableCell" },
                { text: "IDBI Bank\nGhatkopar East", style: "tableCell" },
                { text: "0033102000028820", style: "tableCellBold" },
                { text: "IBKL0000033", style: "tableCell" },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 16],
        },
        {
          text: "If you have any query kindly contact our “ Customer Service Manager Mr. Devendra Naik Mobile 7208119728” If you do not provide payment within 7 days after receiving this email/ the letter we shall again send you a reminder letter via email/ RPAD or Courier after that our customer care executive reminds you on call also. Your Cooperation and promptness in making a said payment will enable us to hand over the possession of the said flat on time. Please ignore this letter if already paid.",
          fontSize: 9,
          color: "#475569",
          margin: [0, 0, 0, 24],
        },
        {
          stack: [
            { text: "Yours Faithfully,", margin: [0, 0, 0, 2] },
            { text: "For Gurukrupa Realcon Developers Private Limited", bold: true, margin: [0, 0, 0, 40] },
            { text: "This is auto generated demand it doesn't require signature", italics: true, color: "#64748b", fontSize: 9 },
          ],
        },
      ],
    },
    variables: [
      { id: "slab_completion_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "project_name", label: "Project Name", type: "text", defaultValue: "Marina Enclave", required: true, group: "Project Details", order: 1, bindings: [] },
      { id: "wing", label: "Wing", type: "text", defaultValue: "Wing C", required: true, group: "Property Details", order: 2, bindings: [] },
      { id: "unit_name", label: "Unit No", type: "text", defaultValue: "1103", required: true, group: "Property Details", order: 3, bindings: [] },
      { id: "customer_name", label: "Payee Name", type: "text", defaultValue: "Pooja Mehta", required: true, group: "Customer Details", order: 4, bindings: [] },
      { id: "customer_address", label: "Address", type: "textarea", defaultValue: "Flat 502, Palm Beach Residency, Vashi, Navi Mumbai", required: true, group: "Customer Details", order: 5, bindings: [] },
      { id: "project_address", label: "Project Address", type: "textarea", defaultValue: "Jankalyan Nagar, Malad West, Mumbai 400095", required: true, group: "Project Details", order: 6, bindings: [] },
      { id: "installment_name", label: "Completed Stage", type: "text", defaultValue: "11th Slab RCC Work", required: true, group: "Document Details", order: 7, bindings: [] },
      { id: "effective_date", label: "Agreement Execution Date", type: "date", defaultValue: "2025-08-15", required: false, group: "Document Details", order: 8, bindings: [] },
      { id: "agreement_date", label: "Agreement Registration Date", type: "date", defaultValue: "2025-08-28", required: false, group: "Document Details", order: 9, bindings: [] },
      { id: "agreement_amount", label: "Agreement Value (AV)", type: "currency", defaultValue: 8500000, required: true, group: "Financial Details", order: 10, bindings: [] },
      { id: "total_percentage", label: "Demand Percentage", type: "percent", defaultValue: 70, required: true, group: "Financial Details", order: 11, bindings: [] },
      { id: "total_gst", label: "Total GST (5%) on AV", type: "currency", defaultValue: 425000, required: false, group: "Financial Details", order: 12, bindings: [] },
      { id: "pending_amount_as_per_work", label: "Amount Billed Till Date", type: "currency", defaultValue: 5950000, required: true, group: "Financial Details", order: 13, bindings: [] },
      { id: "pending_tax_as_per_work", label: "GST Billed Till Date", type: "currency", defaultValue: 297500, required: true, group: "Financial Details", order: 14, bindings: [] },
      { id: "amount_paid", label: "Amount Received Till Date", type: "currency", defaultValue: 5100000, required: false, group: "Financial Details", order: 15, bindings: [] },
      { id: "tax_paid", label: "Tax Received Till Date", type: "currency", defaultValue: 255000, required: false, group: "Financial Details", order: 16, bindings: [] },
      { id: "total_due_amount", label: "Total Flat Cost Payable", type: "currency", defaultValue: 850000, required: true, group: "Financial Details", order: 17, bindings: [] },
      { id: "total_tax_amount", label: "Total GST Payable", type: "currency", defaultValue: 42500, required: true, group: "Financial Details", order: 18, bindings: [] },
    ],
  },

  // =========================================================================
  // DEMAND 4: Sankalp Builders - Tax Invoice
  // =========================================================================
  {
    id: "master-demand-4",
    name: "Demand Letter 4 - Sankalp Builders (Tax Invoice)",
    category: "Demand Letters",
    description: "Statutory Tax Invoice and Demand Letter with GSTIN, HSN/SAC code 995411, CGST/SGST calculation, and RERA registration.",
    definition: {
      pageSize: "A4",
      pageMargins: [36, 36, 36, 36],
      defaultStyle: { font: "Roboto", fontSize: 9.5, color: "#1e293b", lineHeight: 1.25 },
      styles: {
        companyTitle: { fontSize: 15, bold: true, color: "#0f172a" },
        invoiceTitle: { fontSize: 14, bold: true, alignment: "center", color: "#0f172a" },
        subHeader: { fontSize: 8.5, color: "#475569" },
        tableHeader: { bold: true, fontSize: 8.5, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 8.5 },
        tableCellBold: { fontSize: 8.5, bold: true },
        signatory: { bold: true, fontSize: 9.5, color: "#0f172a" },
      },
      content: [
        {
          columns: [
            {
              stack: [
                { text: "SANKALP BUILDERS", style: "companyTitle" },
                { text: "E-123-124, Behind IOC Petrol Pump, Sahakar Marg, Jaipur 302015", style: "subHeader" },
                { text: "GSTIN: 08ACOFS3617H1ZT | Original For Recipient", style: "subHeader", margin: [0, 2, 0, 0] },
              ],
              width: "*",
            },
            {
              stack: [
                { text: "Tax Invoice", style: "invoiceTitle" },
                { text: "Date: {{current_date}}", alignment: "right", bold: true, margin: [0, 2, 0, 0] },
                { text: "Invoice No: {{project_name}} / {{unit_name}} / Demand", alignment: "right", fontSize: 8.5 },
              ],
              width: 220,
            },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          canvas: [{ type: "line", x1: 0, y1: 2, x2: 523, y2: 2, lineWidth: 1, lineColor: "#cbd5e1" }],
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            {
              stack: [
                { text: "Customer Name : {{customer_name}}", bold: true },
                { text: "Address : {{customer_address}}" },
                { text: "State : Rajasthan  |  State Code : 8" },
              ],
              width: "*",
            },
            {
              stack: [
                { text: "Mobile : {{customer_phone}}" },
                { text: "Email : {{customer_email}}" },
              ],
              width: 200,
            },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          text: "DEMAND LETTER",
          alignment: "center",
          bold: true,
          fontSize: 11,
          margin: [0, 0, 0, 4],
        },
        {
          text: "Subject: Demand letter for due amount of Unit No. {{wing}} {{unit_name}} in {{project_name}} at {{project_address}}.",
          bold: true,
          fontSize: 9,
          margin: [0, 0, 0, 2],
        },
        {
          text: "Ref: {{total_percentage}} % amount due | {{installment_name}}",
          fontSize: 8.5,
          color: "#475569",
          margin: [0, 0, 0, 6],
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 50, 75, 55, 55],
            body: [
              [
                { text: "Description", style: "tableHeader" },
                { text: "HSN/SAC", style: "tableHeader" },
                { text: "Amount (A)", style: "tableHeader", alignment: "right" },
                { text: "CGST (B)", style: "tableHeader", alignment: "right" },
                { text: "SGST (C)", style: "tableHeader", alignment: "right" },
              ],
              [
                { text: "Sale of Residential Unit No {{unit_name}} in the project {{project_name}} (GST calculated on 2/3rd value as per N/N 11/2017 CGST Rate)", style: "tableCell" },
                { text: "995411", style: "tableCell" },
                { text: "₹{{latest_slab_amount}}", style: "tableCell", alignment: "right" },
                { text: "₹{{latest_tax_as_per_work_cgst}}", style: "tableCell", alignment: "right" },
                { text: "₹{{latest_tax_as_per_work_sgst}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "{{latest_slab_percentage}} % amount Due of Sale consideration (i)", style: "tableCell" },
                { text: "", style: "tableCell" },
                { text: "₹{{latest_slab_amount}}", style: "tableCell", alignment: "right" },
                { text: "", style: "tableCell" },
                { text: "", style: "tableCell" },
              ],
              [
                { text: "GST (ii)", style: "tableCell" },
                { text: "", style: "tableCell" },
                { text: "₹{{latest_slab_gst_amount}}", style: "tableCell", alignment: "right" },
                { text: "", style: "tableCell" },
                { text: "", style: "tableCell" },
              ],
              [
                { text: "Total (iii) = (i) + (ii)", style: "tableCellBold" },
                { text: "", style: "tableCell" },
                { text: "₹{{latest_slab_total_amount}}", style: "tableCellBold", alignment: "right" },
                { text: "", style: "tableCell" },
                { text: "", style: "tableCell" },
              ],
              [
                { text: "Add:- Previous Demand Value ({{previous_slabs_percentage}}%) + GST (iv)", style: "tableCell" },
                { text: "", style: "tableCell" },
                { text: "₹{{previous_slabs_total_amount}}", style: "tableCell", alignment: "right" },
                { text: "", style: "tableCell" },
                { text: "", style: "tableCell" },
              ],
              [
                { text: "Total Amount Due {{total_percentage}}% (v)", style: "tableCellBold" },
                { text: "", style: "tableCell" },
                { text: "₹{{total_pending_amount_as_per_work}}", style: "tableCellBold", alignment: "right" },
                { text: "", style: "tableCell" },
                { text: "", style: "tableCell" },
              ],
              [
                { text: "Amount Received Till Date (vi)", style: "tableCell" },
                { text: "", style: "tableCell" },
                { text: "₹{{total_paid}}", style: "tableCell", alignment: "right" },
                { text: "", style: "tableCell" },
                { text: "", style: "tableCell" },
              ],
              [
                { text: "Net Due (vii) = (v - vi)", style: "tableCellBold", fillColor: "#f8fafc" },
                { text: "", style: "tableCell", fillColor: "#f8fafc" },
                { text: "₹{{final_amount}}", style: "tableCellBold", alignment: "right", fillColor: "#f8fafc" },
                { text: "", style: "tableCell", fillColor: "#f8fafc" },
                { text: "", style: "tableCell", fillColor: "#f8fafc" },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 8],
        },
        {
          text: "Therefore, you are requested to make the payment of outstanding dues within 15 days from the date of issuance of this tax invoice to avoid interest charges on delayed payment as per the terms & condition of the firm.",
          fontSize: 8.5,
          margin: [0, 0, 0, 4],
        },
        {
          text: "Note: GST or any other govt. taxes and charges which may be applicable as per Govt. norms, shall be paid by Buyer.",
          fontSize: 8,
          italics: true,
          color: "#475569",
          margin: [0, 0, 0, 6],
        },
        {
          stack: [
            { text: "The Cheque, Demand Draft or RTGS can be made in the following bank account details:.", bold: true, fontSize: 8.5 },
            { text: "Account Name : SANKALP BUILDERS RERA COLLECTION ACCOUNT\nBank Account No. : 777705514422\nBank & Branch : ICICI Bank, Sahakar Marg, Jaipur | IFSC Code : ICIC0006790.", fontSize: 8.5, color: "#334155", margin: [0, 2, 0, 4] },
            { text: "For any further clarification please call us on 7073877746 or mail us on crm@sankalpbuilders.com", fontSize: 8.5, color: "#0284c7" },
            { text: "RERA Registration No. {{project_rera}} | RERA Website : http:// rera.rajasthan.gov.in/", fontSize: 8.5, bold: true, margin: [0, 2, 0, 8] },
          ],
        },
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "Thanking you,", margin: [0, 0, 0, 2] },
                { text: "For M/ s Sankalp Builders", bold: true, margin: [0, 0, 0, 28] },
                { text: "(Authorized Signatory)", style: "signatory" },
              ],
              alignment: "right",
              width: 180,
            },
          ],
        },
      ],
    },
    variables: [
      { id: "current_date", label: "Invoice Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "project_name", label: "Project Name", type: "text", defaultValue: "The Rise", required: true, group: "Project Details", order: 1, bindings: [] },
      { id: "wing", label: "Tower / Wing", type: "text", defaultValue: "Tower A", required: false, group: "Property Details", order: 2, bindings: [] },
      { id: "unit_name", label: "Unit No.", type: "text", defaultValue: "A-502", required: true, group: "Property Details", order: 3, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Sunil Agarwal", required: true, group: "Customer Details", order: 4, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "Plot 45, Civil Lines, Jaipur 302006", required: true, group: "Customer Details", order: 5, bindings: [] },
      { id: "customer_phone", label: "Mobile", type: "phone", defaultValue: "9829012345", required: false, group: "Contact Details", order: 6, bindings: [] },
      { id: "customer_email", label: "Email", type: "email", defaultValue: "sunil.agarwal@gmail.com", required: false, group: "Contact Details", order: 7, bindings: [] },
      { id: "project_address", label: "Project Address", type: "textarea", defaultValue: "Ajmer Road, Jaipur, Rajasthan", required: true, group: "Project Details", order: 8, bindings: [] },
      { id: "total_percentage", label: "Total Amount Due %", type: "percent", defaultValue: 75, required: false, group: "Financial Details", order: 9, bindings: [] },
      { id: "installment_name", label: "Stage / Milestone", type: "text", defaultValue: "On Completion of 5th Floor Slab", required: true, group: "Document Details", order: 10, bindings: [] },
      { id: "latest_slab_percentage", label: "Current Slab % Due", type: "percent", defaultValue: 10, required: false, group: "Financial Details", order: 11, bindings: [] },
      { id: "latest_slab_amount", label: "Current Slab Consideration", type: "currency", defaultValue: 600000, required: true, group: "Financial Details", order: 12, bindings: [] },
      { id: "latest_tax_as_per_work_cgst", label: "CGST (B)", type: "currency", defaultValue: 15000, required: false, group: "Financial Details", order: 13, bindings: [] },
      { id: "latest_tax_as_per_work_sgst", label: "SGST (C)", type: "currency", defaultValue: 15000, required: false, group: "Financial Details", order: 14, bindings: [] },
      { id: "latest_slab_gst_amount", label: "Current Slab GST Total", type: "currency", defaultValue: 30000, required: false, group: "Financial Details", order: 15, bindings: [] },
      { id: "latest_slab_total_amount", label: "Total (Consideration + GST)", type: "currency", defaultValue: 630000, required: false, group: "Financial Details", order: 16, bindings: [] },
      { id: "previous_slabs_percentage", label: "Previous Demanded %", type: "percent", defaultValue: 65, required: false, group: "Financial Details", order: 17, bindings: [] },
      { id: "previous_slabs_total_amount", label: "Previous Demand Value + GST", type: "currency", defaultValue: 4095000, required: false, group: "Financial Details", order: 18, bindings: [] },
      { id: "total_pending_amount_as_per_work", label: "Total Amount Due (v)", type: "currency", defaultValue: 4725000, required: false, group: "Financial Details", order: 19, bindings: [] },
      { id: "total_paid", label: "Amount Received Till Date (vi)", type: "currency", defaultValue: 4095000, required: false, group: "Financial Details", order: 20, bindings: [] },
      { id: "final_amount", label: "Net Due (vii) =(v-vi)", type: "currency", defaultValue: 630000, required: true, group: "Financial Details", order: 21, bindings: [] },
      { id: "project_rera", label: "RERA Registration No.", type: "text", defaultValue: "RAJ/P/2021/1542", required: false, group: "Project Details", order: 22, bindings: [] },
    ],
  },

  // =========================================================================
  // DEMAND 5: AK Hitech Associates (Sapphire)
  // =========================================================================
  {
    id: "master-demand-5",
    name: "Demand Letter 5 - AK Hitech Associates (Sapphire)",
    category: "Demand Letters",
    description: "Payment intimation for Sapphire project (Kharghar) with TDS 1% deduction and 2 separate Axis Bank accounts for Flat Cost and GST.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        title: { fontSize: 15, bold: true, alignment: "center", color: "#0f172a", margin: [0, 0, 0, 10] },
        tableHeader: { bold: true, fontSize: 9, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9 },
        boldCell: { fontSize: 9, bold: true },
        bankBox: { fontSize: 8.5, color: "#334155" },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" },
      },
      content: [
        { text: "DEMAND LETTER", style: "title" },
        {
          columns: [
            {
              stack: [
                { text: "To,", bold: true },
                { text: "{{customer_name}}", bold: true },
                { text: "{{customer_address}}", color: "#334155" },
                { text: "Email :- {{customer_email}}" },
                { text: "Mob :- {{customer_phone}}" },
              ],
              width: "*",
            },
            {
              text: "Date: {{current_date}}",
              alignment: "right",
              bold: true,
              width: 140,
            },
          ],
          margin: [0, 0, 0, 10],
        },
        {
          text: "Subject :- Intimation for payment of {{installment_name}} against your Booking of Flat No. {{unit_name}} on {{unit_floor}} , “Sapphire ” situated at Plot No.01, Sector-34C, Kharghar, Navi Mumbai.",
          bold: true,
          margin: [0, 0, 0, 8],
        },
        {
          text: "Dear Madam/ Sir, ,\nWe have to inform you that a payment of ₹{{amount_without_tds_final}} is due as below.",
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 120, 100],
            body: [
              [
                { text: "INSTALLMENT DUE", style: "tableHeader" },
                { text: "ON FLAT COST", style: "tableHeader", alignment: "right" },
                { text: "GST", style: "tableHeader", alignment: "right" },
              ],
              [
                { text: "Previous Demand Value", style: "tableCell" },
                { text: "₹{{previous_slabs_amount}}", style: "tableCell", alignment: "right" },
                { text: "₹{{previous_slabs_gst_amount}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "{{installment_name}}", style: "tableCell" },
                { text: "₹{{latest_slab_amount}}", style: "tableCell", alignment: "right" },
                { text: "₹{{latest_slab_gst_amount}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "Total Amount Due {{total_percentage}}%", style: "boldCell" },
                { text: "₹{{pending_amount_as_per_work}}", style: "boldCell", alignment: "right" },
                { text: "₹{{pending_tax_as_per_work}}", style: "boldCell", alignment: "right" },
              ],
              [
                { text: "Less Amount Received ……………………….", style: "tableCell" },
                { text: "₹{{amount_paid}}", style: "tableCell", alignment: "right" },
                { text: "₹{{tax_paid}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "AMOUNT DUE ……………………………….", style: "boldCell" },
                { text: "₹{{total_due_amount}}", style: "boldCell", alignment: "right" },
                { text: "₹{{total_tax_amount}}", style: "boldCell", alignment: "right" },
              ],
              [
                { text: "Less: TDS @ 1%", style: "tableCell" },
                { text: "₹{{pending_tds_as_per_work}}", style: "tableCell", alignment: "right" },
                { text: "-", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "Balance", style: "boldCell", fillColor: "#f8fafc" },
                { text: "₹{{balance_as_per_work}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" },
                { text: "₹{{total_tax_amount}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 6],
        },
        {
          text: "Kindly pay online TDS of ₹{{pending_tds_as_per_work}}",
          bold: true,
          color: "#0369a1",
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            widths: ["*", "*"],
            body: [
              [
                { text: "Flat Cost Banking Details", style: "tableHeader" },
                { text: "For GST Banking Details", style: "tableHeader" },
              ],
              [
                {
                  stack: [
                    { text: "Favouring Name : A K HITECH ASSOCIATES SAPPHIRE COLLECTION ACCOUNT", bold: true },
                    { text: "Bank Name : AXIS BANK" },
                    { text: "Current A/ C No. : 924020002973152", bold: true },
                    { text: "Bank IFSC : UTIB0001365" },
                  ],
                  style: "bankBox",
                },
                {
                  stack: [
                    { text: "Favouring Name : A K HITECH ASSOCIATES", bold: true },
                    { text: "Bank Name : AXIS BANK" },
                    { text: "Current A/ C No. : 923020031598565", bold: true },
                    { text: "Bank IFSC : UTIB0001365" },
                  ],
                  style: "bankBox",
                },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 10],
        },
        {
          text: "You are requested to kindly make the above payment within 15 days ({{due_date}}) from the receipt of this letter otherwise arrears will be charge on delay payment. Pl find above banking details.",
          fontSize: 9,
          margin: [0, 0, 0, 12],
        },
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "Yours Faithfully,", margin: [0, 0, 0, 2] },
                { text: "For AK Hitech Associates", bold: true, margin: [0, 0, 0, 36] },
                { text: "Authorized Signatory", style: "signatory" },
              ],
              alignment: "right",
              width: 180,
            },
          ],
        },
      ],
    },
    variables: [
      { id: "current_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Mahesh Patil", required: true, group: "Customer Details", order: 1, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "Row House No. 12, Sector 20, Kharghar, Navi Mumbai", required: true, group: "Customer Details", order: 2, bindings: [] },
      { id: "customer_email", label: "Email", type: "email", defaultValue: "patil.mahesh@rediffmail.com", required: false, group: "Contact Details", order: 3, bindings: [] },
      { id: "customer_phone", label: "Mobile", type: "phone", defaultValue: "9820512345", required: false, group: "Contact Details", order: 4, bindings: [] },
      { id: "installment_name", label: "Installment Name", type: "text", defaultValue: "Plinth Level", required: true, group: "Document Details", order: 5, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "302", required: true, group: "Property Details", order: 6, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "3rd Floor", required: true, group: "Property Details", order: 7, bindings: [] },
      { id: "amount_without_tds_final", label: "Total Payment Due", type: "currency", defaultValue: 525000, required: true, group: "Financial Details", order: 8, bindings: [] },
      { id: "previous_slabs_amount", label: "Previous Slabs Amount", type: "currency", defaultValue: 1000000, required: false, group: "Financial Details", order: 9, bindings: [] },
      { id: "previous_slabs_gst_amount", label: "Previous Slabs GST", type: "currency", defaultValue: 50000, required: false, group: "Financial Details", order: 10, bindings: [] },
      { id: "latest_slab_amount", label: "Current Slab Amount", type: "currency", defaultValue: 500000, required: true, group: "Financial Details", order: 11, bindings: [] },
      { id: "latest_slab_gst_amount", label: "Current Slab GST", type: "currency", defaultValue: 25000, required: true, group: "Financial Details", order: 12, bindings: [] },
      { id: "total_percentage", label: "Total Amount Due %", type: "percent", defaultValue: 30, required: false, group: "Financial Details", order: 13, bindings: [] },
      { id: "pending_amount_as_per_work", label: "Pending Flat Cost As Per Work", type: "currency", defaultValue: 1500000, required: false, group: "Financial Details", order: 14, bindings: [] },
      { id: "pending_tax_as_per_work", label: "Pending Tax As Per Work", type: "currency", defaultValue: 75000, required: false, group: "Financial Details", order: 15, bindings: [] },
      { id: "amount_paid", label: "Amount Received", type: "currency", defaultValue: 1000000, required: false, group: "Financial Details", order: 16, bindings: [] },
      { id: "tax_paid", label: "Tax Paid", type: "currency", defaultValue: 50000, required: false, group: "Financial Details", order: 17, bindings: [] },
      { id: "total_due_amount", label: "Amount Due", type: "currency", defaultValue: 500000, required: true, group: "Financial Details", order: 18, bindings: [] },
      { id: "total_tax_amount", label: "Total Tax Due", type: "currency", defaultValue: 25000, required: true, group: "Financial Details", order: 19, bindings: [] },
      { id: "pending_tds_as_per_work", label: "TDS @ 1%", type: "currency", defaultValue: 5000, required: false, group: "Financial Details", order: 20, bindings: [] },
      { id: "balance_as_per_work", label: "Balance Flat Cost", type: "currency", defaultValue: 495000, required: true, group: "Financial Details", order: 21, bindings: [] },
      { id: "due_date", label: "Due Date (15 Days)", type: "date", defaultValue: "2026-11-19", required: false, group: "Document Details", order: 22, bindings: [] },
    ],
  },

  // =========================================================================
  // DEMAND 6: Royal Buildcon (Avencia)
  // =========================================================================
  {
    id: "master-demand-6",
    name: "Demand Letter 6 - Royal Buildcon (Avencia)",
    category: "Demand Letters",
    description: "Demand letter for Avencia project (Pushpaknagar) with TDS 1% deduction, agreement value, and IndusInd Bank collection account.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        companyTitle: { fontSize: 16, bold: true, alignment: "center", color: "#0f172a" },
        docTitle: { fontSize: 12, bold: true, alignment: "center", color: "#334155", margin: [0, 4, 0, 10] },
        tableHeader: { bold: true, fontSize: 9.5, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9.5 },
        boldCell: { fontSize: 9.5, bold: true },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" },
        footerText: { fontSize: 8.5, color: "#64748b", alignment: "center" },
      },
      content: [
        { text: "ROYAL BUILDCON", style: "companyTitle" },
        { text: "DEMAND LETTER", style: "docTitle" },
        {
          columns: [
            {
              stack: [
                { text: "To,", bold: true },
                { text: "{{customer_name}}", bold: true },
                { text: "{{customer_address}}", color: "#334155" },
                { text: "Email :- {{customer_email}}" },
                { text: "Mob :- {{customer_phone}}" },
              ],
              width: "*",
            },
            {
              text: "Date: {{current_date}}",
              alignment: "right",
              bold: true,
              width: 140,
            },
          ],
          margin: [0, 0, 0, 10],
        },
        {
          text: "Subject :- Intimation for payment of {{installment_name}} against your Booking of Flat No. {{unit_name}} on {{unit_floor}} floor, “AVENCIA ” Plot-04, Sector-5, Pushpaknagar, Dapoli, Navi Mumbai, Maharastra.",
          bold: true,
          margin: [0, 0, 0, 6],
        },
        {
          text: "Agreement Amount: ₹{{agreement_amount}}",
          bold: true,
          color: "#0369a1",
          margin: [0, 0, 0, 8],
        },
        {
          text: "Dear Madam/ Sir, ,\nWe have to inform you that a payment of ₹{{balance_as_per_work_without_exceed}} is due as below.",
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 140],
            body: [
              [
                { text: "INSTALLMENT DUE", style: "tableHeader" },
                { text: "ON FLAT COST", style: "tableHeader", alignment: "right" },
              ],
              [
                { text: "Previous Demand Value", style: "tableCell" },
                { text: "₹{{previous_slabs_amount}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "{{installment_name}}", style: "tableCell" },
                { text: "₹{{latest_slab_amount}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "Total Amount Due {{total_percentage}}%", style: "boldCell" },
                { text: "₹{{pending_amount_as_per_work}}", style: "boldCell", alignment: "right" },
              ],
              [
                { text: "Less Amount Received ……………………….", style: "tableCell" },
                { text: "₹{{amount_paid}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "AMOUNT DUE ……………………………….", style: "boldCell" },
                { text: "₹{{total_due_amount_without_exceed}}", style: "boldCell", alignment: "right" },
              ],
              [
                { text: "Less: TDS @ 1%", style: "tableCell" },
                { text: "₹{{total_tds_amount_as_per_work}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "Balance", style: "boldCell", fillColor: "#f8fafc" },
                { text: "₹{{balance_as_per_work_without_exceed}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            {
              stack: [
                { text: "Flat Amount Collection Banking Details:", bold: true, fontSize: 9 },
                { text: "Favouring Name : ROYAL BUILDCON AVENCIA COLLECTION A/ C", bold: true, fontSize: 8.5 },
                { text: "Bank Name : IndusInd Bank, Belapur Branch", fontSize: 8.5 },
                { text: "Current A/ C No. : 201029817183 | IFSC : INDB0000599", bold: true, fontSize: 8.5 },
              ],
              width: "*",
            },
            {
              text: "Kindly pay online TDS of ₹{{tds_balance}}",
              bold: true,
              color: "#0369a1",
              alignment: "right",
              width: 180,
            },
          ],
          margin: [0, 0, 0, 10],
        },
        {
          text: "You are requested to kindly make the above payment within 15 days from the receipt of this letter otherwise arrears will be charged on delay payment. Please find above banking details.",
          fontSize: 9,
          margin: [0, 0, 0, 16],
        },
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "Yours Faithfully,", margin: [0, 0, 0, 36] },
                { text: "Authorized Signatory", style: "signatory" },
              ],
              alignment: "right",
              width: 170,
            },
          ],
          margin: [0, 0, 0, 20],
        },
        {
          text: "OFFICE ADDRESS: 905, Mayuresh Chambers. plot-60 sector-11, Cbd Belapur, Navi Mumbai, Maharashtra-400614.",
          style: "footerText",
        },
      ],
    },
    variables: [
      { id: "current_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Rohan Deshmukh", required: true, group: "Customer Details", order: 1, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "Flat 101, Shanti Niketan, Panvel, Navi Mumbai 410206", required: true, group: "Customer Details", order: 2, bindings: [] },
      { id: "customer_email", label: "Email", type: "email", defaultValue: "rohan.deshmukh@gmail.com", required: false, group: "Contact Details", order: 3, bindings: [] },
      { id: "customer_phone", label: "Mobile", type: "phone", defaultValue: "9833445566", required: false, group: "Contact Details", order: 4, bindings: [] },
      { id: "installment_name", label: "Installment Name", type: "text", defaultValue: "Top Slab Casting", required: true, group: "Document Details", order: 5, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "A-701", required: true, group: "Property Details", order: 6, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "7th", required: true, group: "Property Details", order: 7, bindings: [] },
      { id: "agreement_amount", label: "Agreement Amount", type: "currency", defaultValue: 6500000, required: true, group: "Financial Details", order: 8, bindings: [] },
      { id: "balance_as_per_work_without_exceed", label: "Net Due Balance", type: "currency", defaultValue: 643500, required: true, group: "Financial Details", order: 9, bindings: [] },
      { id: "previous_slabs_amount", label: "Previous Slabs Demanded", type: "currency", defaultValue: 4500000, required: false, group: "Financial Details", order: 10, bindings: [] },
      { id: "latest_slab_amount", label: "Current Slab Demanded", type: "currency", defaultValue: 650000, required: true, group: "Financial Details", order: 11, bindings: [] },
      { id: "total_percentage", label: "Total Demand %", type: "percent", defaultValue: 80, required: false, group: "Financial Details", order: 12, bindings: [] },
      { id: "pending_amount_as_per_work", label: "Total Billed Till Date", type: "currency", defaultValue: 5150000, required: false, group: "Financial Details", order: 13, bindings: [] },
      { id: "amount_paid", label: "Amount Received Till Date", type: "currency", defaultValue: 4500000, required: false, group: "Financial Details", order: 14, bindings: [] },
      { id: "total_due_amount_without_exceed", label: "Total Due Flat Cost", type: "currency", defaultValue: 650000, required: true, group: "Financial Details", order: 15, bindings: [] },
      { id: "total_tds_amount_as_per_work", label: "TDS @ 1%", type: "currency", defaultValue: 6500, required: false, group: "Financial Details", order: 16, bindings: [] },
      { id: "tds_balance", label: "TDS Online Payment", type: "currency", defaultValue: 6500, required: false, group: "Financial Details", order: 17, bindings: [] },
    ],
  },

  // =========================================================================
  // DEMAND 7: LMP Group (Rita Palace)
  // =========================================================================
  {
    id: "master-demand-7",
    name: "Demand Letter 7 - LMP Group (Rita Palace)",
    category: "Demand Letters",
    description: "Demand note for Rita Palace (Borivali West) with A.V. percentage calculation, Bank of Baroda account, and PAN/GSTIN registration.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 36, 40, 36],
      defaultStyle: { font: "Roboto", fontSize: 9.5, color: "#1e293b", lineHeight: 1.25 },
      styles: {
        companyTitle: { fontSize: 15, bold: true, alignment: "center", color: "#0f172a" },
        docTitle: { fontSize: 11, bold: true, alignment: "center", color: "#475569", margin: [0, 2, 0, 8] },
        tableHeader: { bold: true, fontSize: 8.5, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 8.5 },
        boldCell: { fontSize: 8.5, bold: true },
        signatory: { bold: true, fontSize: 9.5, color: "#0f172a" },
        footerText: { fontSize: 8, color: "#64748b", alignment: "center" },
      },
      content: [
        { text: "LMP GROUP RITA PALACE", style: "companyTitle" },
        { text: "Demand Note", style: "docTitle" },
        {
          columns: [
            {
              stack: [
                { text: "To,", bold: true },
                { text: "{{customer_name}}", bold: true },
                { text: "{{customer_address}}", color: "#334155" },
                { text: "Email :- {{customer_email}}" },
                { text: "Mob :- {{customer_phone}}" },
              ],
              width: "*",
            },
            {
              text: "Date: {{current_date}}",
              alignment: "right",
              bold: true,
              width: 140,
            },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          text: "Subject :- Intimation for payment due on {{installment_name}} stage against your Booking of Flat No. {{unit_name}} on {{unit_floor}} floor, “RITA PALCE” Wing {{wing}}, HARSHA PARK, CHANDRAVARKAR ROAD, OPP: MUNICIPAL GARDEN, BORIVALI (WEST) MUMBAI - 400 092.",
          bold: true,
          margin: [0, 0, 0, 6],
        },
        {
          text: "Dear Madam/ Sir, ,\nWe have to inform you that a payment of ₹{{balance_as_per_work}} is due as below. Your total payable Agreement Value is ₹{{agreement_amount}}",
          margin: [0, 0, 0, 6],
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 160],
            body: [
              [
                { text: "INSTALLMENT DUE", style: "tableHeader" },
                { text: "AMOUNT DUE ON PURCHASE AREA", style: "tableHeader", alignment: "right" },
              ],
              [
                { text: "Previous Demand Value", style: "tableCell" },
                { text: "₹{{previous_slabs_amount}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "{{installment_name}} Stage {{latest_slab_percentage}}% of A.V.", style: "tableCell" },
                { text: "₹{{latest_slab_amount}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "Total Amount Due {{total_percentage}}%", style: "boldCell" },
                { text: "₹{{pending_amount_as_per_work}}", style: "boldCell", alignment: "right" },
              ],
              [
                { text: "Less Amount Received ……………………….", style: "tableCell" },
                { text: "₹{{amount_paid}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "AMOUNT DUE ……………………………….", style: "boldCell" },
                { text: "₹{{total_due_amount}}", style: "boldCell", alignment: "right" },
              ],
              [
                { text: "Less: TDS @ 1%", style: "tableCell" },
                { text: "₹{{pending_tds_as_per_work}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "Balance", style: "boldCell", fillColor: "#f8fafc" },
                { text: "₹{{balance_as_per_work}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 6],
        },
        {
          stack: [
            { text: "Kindly pay total GST of ₹{{tax_balance}} seperately OR Kindly pay GST upto this stage ₹{{total_tax_amount}}", bold: true, color: "#b45309", fontSize: 8.5 },
            { text: "Kindly pay online TDS of ₹{{pending_tds_as_per_work}}", bold: true, color: "#0369a1", fontSize: 8.5, margin: [0, 2, 0, 4] },
          ],
        },
        {
          stack: [
            { text: "Our Bank Details:", bold: true, fontSize: 8.5 },
            { text: "Favouring Name : LMP GROUP RITA PALACE\nBank Name : BANK OF BARODA | Current A/ C No. : 03860200002856\nBank IFSC : BARB0BORIVL (5th figure is zero) | BRANCH : BORIVALI (W)", fontSize: 8.5, color: "#334155", margin: [0, 2, 0, 4] },
          ],
        },
        {
          text: "You are requested to kindly make the above payment within fifteen days from date of invoice. Interest will be charged on delayed payments as per norms.",
          fontSize: 8.5,
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            {
              stack: [
                { text: "GSTIN: 27AAHFL3298C1Z8", bold: true, fontSize: 8.5 },
                { text: "PAN: AAHFL3298C", bold: true, fontSize: 8.5 },
              ],
              width: "*",
            },
            {
              stack: [
                { text: "Yours Faithfully,", margin: [0, 0, 0, 2] },
                { text: "For LMP GROUP RITA PALACE", bold: true },
                { text: "Accounts Dept.", margin: [0, 0, 0, 16] },
              ],
              alignment: "right",
              width: 180,
            },
          ],
          margin: [0, 0, 0, 6],
        },
        {
          text: "(This is a computer generated authorised demand note and does not require to be signed)",
          style: "footerText",
          italics: true,
          margin: [0, 0, 0, 4],
        },
        {
          text: "Off: Kahan Bhavan, L.T.road, Behind Diamond Cinema, next to Purohit Hospital , Borivali west Mumbai-92\n98200 49360 | Email: lmpgroup.rpchsl@gmail.com",
          style: "footerText",
        },
      ],
    },
    variables: [
      { id: "current_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Ketan Shah", required: true, group: "Customer Details", order: 1, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "B-14, Shanti Nagar, S.V. Road, Borivali West, Mumbai 400092", required: true, group: "Customer Details", order: 2, bindings: [] },
      { id: "customer_email", label: "Email", type: "email", defaultValue: "ketanshah@yahoo.com", required: false, group: "Contact Details", order: 3, bindings: [] },
      { id: "customer_phone", label: "Mobile", type: "phone", defaultValue: "9821123456", required: false, group: "Contact Details", order: 4, bindings: [] },
      { id: "installment_name", label: "Installment Name / Stage", type: "text", defaultValue: "Brickwork & Plaster", required: true, group: "Document Details", order: 5, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "503", required: true, group: "Property Details", order: 6, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "5th", required: true, group: "Property Details", order: 7, bindings: [] },
      { id: "wing", label: "Wing", type: "text", defaultValue: "A", required: true, group: "Property Details", order: 8, bindings: [] },
      { id: "agreement_amount", label: "Agreement Value (A.V.)", type: "currency", defaultValue: 12000000, required: true, group: "Financial Details", order: 9, bindings: [] },
      { id: "balance_as_per_work", label: "Net Balance Due", type: "currency", defaultValue: 1188000, required: true, group: "Financial Details", order: 10, bindings: [] },
      { id: "previous_slabs_amount", label: "Previous Demand Value", type: "currency", defaultValue: 7200000, required: false, group: "Financial Details", order: 11, bindings: [] },
      { id: "latest_slab_percentage", label: "Current Stage % of A.V.", type: "percent", defaultValue: 10, required: false, group: "Financial Details", order: 12, bindings: [] },
      { id: "latest_slab_amount", label: "Current Stage Amount", type: "currency", defaultValue: 1200000, required: true, group: "Financial Details", order: 13, bindings: [] },
      { id: "total_percentage", label: "Total Demand % of A.V.", type: "percent", defaultValue: 70, required: false, group: "Financial Details", order: 14, bindings: [] },
      { id: "pending_amount_as_per_work", label: "Total Billed Till Date", type: "currency", defaultValue: 8400000, required: false, group: "Financial Details", order: 15, bindings: [] },
      { id: "amount_paid", label: "Amount Received Till Date", type: "currency", defaultValue: 7200000, required: false, group: "Financial Details", order: 16, bindings: [] },
      { id: "total_due_amount", label: "Amount Due", type: "currency", defaultValue: 1200000, required: true, group: "Financial Details", order: 17, bindings: [] },
      { id: "pending_tds_as_per_work", label: "TDS @ 1%", type: "currency", defaultValue: 12000, required: false, group: "Financial Details", order: 18, bindings: [] },
      { id: "tax_balance", label: "Total GST Due Seperately", type: "currency", defaultValue: 60000, required: false, group: "Financial Details", order: 19, bindings: [] },
      { id: "total_tax_amount", label: "GST Upto This Stage", type: "currency", defaultValue: 420000, required: false, group: "Financial Details", order: 20, bindings: [] },
    ],
  },

  // =========================================================================
  // RECEIPT 1: Pioneer Housing (Senroofs)
  // =========================================================================
  {
    id: "master-receipt-1",
    name: "Receipt 1 - Pioneer Housing (Senroofs)",
    category: "Receipts",
    description: "Official payment receipt for Pioneer Housing Senroofs project with flat/wing details, cheque/RTGS particulars table, and realization terms.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        companyTitle: { fontSize: 16, bold: true, alignment: "center", color: "#0f172a" },
        subHeader: { fontSize: 9, alignment: "center", color: "#475569", margin: [0, 2, 0, 4] },
        receiptTitle: { fontSize: 13, bold: true, alignment: "center", color: "#0f172a", margin: [0, 4, 0, 10] },
        tableHeader: { bold: true, fontSize: 9.5, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9.5 },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" },
      },
      content: [
        { text: "PIONEER HOUSING", style: "companyTitle" },
        { text: "R.O. Address : 322, Commerce House,140, N. M. Road, Fort,Mumbai - 400 001", style: "subHeader" },
        { text: "RECEIPT", style: "receiptTitle" },
        {
          columns: [
            {
              stack: [
                { text: "Flat No: {{unit_name}} on Floor: {{unit_floor}}", bold: true },
                { text: "in Building: D1 Wing: {{unit_wing}}" },
                { text: "at: SENROOFS Project on {{site_address}}", color: "#334155" },
              ],
              width: "*",
            },
            {
              stack: [
                { text: "Receipt No. : {{receipt_number}}", bold: true },
                { text: "Date : {{payment_date}}" },
              ],
              width: 160,
              alignment: "right",
            },
          ],
          margin: [0, 0, 0, 14],
        },
        {
          stack: [
            { text: "Received with thanks from : {{customer_name}} {{remark}} ₹{{amount_paid}}", bold: true, fontSize: 10.5 },
            { text: "the sum of : {{amount_in_words}}", italics: true, color: "#334155", margin: [0, 4, 0, 4] },
            { text: "by as under as per details in margin hereof", color: "#64748b", fontSize: 9 },
          ],
          margin: [0, 0, 0, 12],
        },
        {
          table: {
            headerRows: 1,
            widths: [100, 120, 90, "*"],
            body: [
              [
                { text: "Amount", style: "tableHeader", alignment: "right" },
                { text: "Chq/ RTGS No.", style: "tableHeader" },
                { text: "Date", style: "tableHeader" },
                { text: "Name of Bank / Branch", style: "tableHeader" },
              ],
              [
                { text: "₹{{amount_paid}}", style: "tableCell", bold: true, alignment: "right" },
                { text: "{{cheque_number}}", style: "tableCell" },
                { text: "{{cheque_date}}", style: "tableCell" },
                { text: "{{bank_name}}", style: "tableCell" },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 16],
        },
        {
          text: "Subject to Realisation of Cheque",
          fontSize: 8.5,
          italics: true,
          color: "#64748b",
          margin: [0, 0, 0, 20],
        },
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "For PIONEER HOUSING,", bold: true, margin: [0, 0, 0, 36] },
                { text: "Authorised Signatory", style: "signatory" },
              ],
              alignment: "right",
              width: 180,
            },
          ],
          margin: [0, 0, 0, 24],
        },
        {
          text: "This is auto generated receipt it doesn't require stamp",
          fontSize: 8.5,
          italics: true,
          alignment: "center",
          color: "#94a3b8",
        },
      ],
    },
    variables: [
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "PH/2026/0892", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "payment_date", label: "Payment Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 1, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "1402", required: true, group: "Property Details", order: 2, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "14th", required: true, group: "Property Details", order: 3, bindings: [] },
      { id: "unit_wing", label: "Building Wing", type: "text", defaultValue: "A", required: true, group: "Property Details", order: 4, bindings: [] },
      { id: "site_address", label: "Site Address", type: "textarea", defaultValue: "Senroofs, Nahur West, Mumbai 400078", required: true, group: "Project Details", order: 5, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Vipin Tomar", required: true, group: "Customer Details", order: 6, bindings: [] },
      { id: "amount_paid", label: "Amount Paid", type: "currency", defaultValue: 400000, required: true, group: "Financial Details", order: 7, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Four Lakh Only", required: true, group: "Financial Details", order: 8, bindings: [] },
      { id: "remark", label: "Payment Remark / Stage", type: "text", defaultValue: "towards 14th Slab casting", required: false, group: "Document Details", order: 9, bindings: [] },
      { id: "cheque_number", label: "Cheque / RTGS / UTR No.", type: "text", defaultValue: "HDFC001928374", required: true, group: "Bank Details", order: 10, bindings: [] },
      { id: "cheque_date", label: "Cheque / Transfer Date", type: "date", defaultValue: "2026-11-03", required: true, group: "Bank Details", order: 11, bindings: [] },
      { id: "bank_name", label: "Bank Name & Branch", type: "text", defaultValue: "HDFC Bank, Mulund West", required: true, group: "Bank Details", order: 12, bindings: [] },
    ],
  },

  // =========================================================================
  // RECEIPT 2: Standard Payment Receipt
  // =========================================================================
  {
    id: "master-receipt-2",
    name: "Receipt 2 - Standard Payment Receipt",
    category: "Receipts",
    description: "Payment receipt with RERA registration, company landline contact, Basic + GST breakdown, unit info, and prominent amount callout.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        receiptTitle: { fontSize: 14, bold: true, alignment: "center", color: "#0f172a" },
        amountBanner: { fontSize: 18, bold: true, color: "#0369a1", margin: [0, 8, 0, 8] },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" },
      },
      content: [
        {
          columns: [
            {
              stack: [
                { text: "{{project_by}}", bold: true, fontSize: 13, color: "#0f172a" },
                { text: "Contact : {{sub_company_landline}}", fontSize: 9, color: "#475569" },
              ],
              width: "*",
            },
            {
              text: "Rera No.: {{rera}}",
              alignment: "right",
              bold: true,
              fontSize: 9.5,
              width: 180,
            },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          canvas: [{ type: "line", x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 1, lineColor: "#cbd5e1" }],
          margin: [0, 0, 0, 12],
        },
        {
          columns: [
            { text: "Date: {{payment_date}}", bold: true },
            { text: "RECEIPT", style: "receiptTitle" },
            { text: "Receipt No.: {{receipt_number}}", alignment: "right", bold: true },
          ],
          margin: [0, 0, 0, 14],
        },
        {
          stack: [
            { text: "Received with thanks from {{customer_name}}", bold: true, fontSize: 11 },
            { text: "Basic: ₹{{amount_without_tax}} {{tds_payment_type}} + GST: ₹{{tax_amount}} = Total: ₹{{amount_for_paid}}", color: "#334155", margin: [0, 4, 0, 4] },
            { text: "a sum of {{amount_in_words}} against Unit No.: {{unit_wing}}- {{unit_name}} On {{unit_floor}} Floor", color: "#334155" },
            { text: "₹{{amount_for_paid}}", style: "amountBanner" },
          ],
          margin: [0, 0, 0, 12],
        },
        {
          stack: [
            { text: "Cheque/ D.D. No./ RTGS : {{cheque_number}} Dated : {{cheque_date}}", bold: true },
            { text: "Bank Name: {{bank_name}}" },
            { text: "Remark: {{remark}}", italics: true, color: "#475569" },
          ],
          margin: [0, 0, 0, 16],
        },
        {
          columns: [
            {
              text: "Cheques are subject to realisation",
              fontSize: 8.5,
              italics: true,
              color: "#64748b",
              margin: [0, 40, 0, 0],
            },
            {
              stack: [
                { text: "For {{project_by}}", bold: true, margin: [0, 0, 0, 36] },
                { text: "Authorised Signatory", style: "signatory" },
              ],
              alignment: "right",
              width: 180,
            },
          ],
          margin: [0, 0, 0, 20],
        },
        {
          text: "This is an auto- generated Payment Receipt.",
          alignment: "center",
          fontSize: 8.5,
          italics: true,
          color: "#94a3b8",
        },
      ],
    },
    variables: [
      { id: "rera", label: "RERA No.", type: "text", defaultValue: "P51800001234", required: true, group: "Project Details", order: 0, bindings: [] },
      { id: "project_by", label: "Developer / Company Name", type: "text", defaultValue: "Dimple Realtors Pvt. Ltd.", required: true, group: "Company Details", order: 1, bindings: [] },
      { id: "sub_company_landline", label: "Contact / Landline", type: "phone", defaultValue: "+91-22-28901234", required: false, group: "Contact Details", order: 2, bindings: [] },
      { id: "payment_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 3, bindings: [] },
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "DR/REC/2026/104", required: true, group: "Document Details", order: 4, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Rajesh Sharma", required: true, group: "Customer Details", order: 5, bindings: [] },
      { id: "amount_without_tax", label: "Basic Amount", type: "currency", defaultValue: 693000, required: true, group: "Financial Details", order: 6, bindings: [] },
      { id: "tds_payment_type", label: "TDS Note / Breakup", type: "text", defaultValue: "(Net of TDS)", required: false, group: "Financial Details", order: 7, bindings: [] },
      { id: "tax_amount", label: "GST Amount", type: "currency", defaultValue: 35000, required: true, group: "Financial Details", order: 8, bindings: [] },
      { id: "amount_for_paid", label: "Total Amount Received", type: "currency", defaultValue: 728000, required: true, group: "Financial Details", order: 9, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Seven Lakh Twenty Eight Thousand Only", required: true, group: "Financial Details", order: 10, bindings: [] },
      { id: "unit_wing", label: "Wing", type: "text", defaultValue: "B", required: false, group: "Property Details", order: 11, bindings: [] },
      { id: "unit_name", label: "Unit No.", type: "text", defaultValue: "804", required: true, group: "Property Details", order: 12, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "8th", required: true, group: "Property Details", order: 13, bindings: [] },
      { id: "cheque_number", label: "Cheque / D.D. / RTGS No.", type: "text", defaultValue: "SBI092837192", required: true, group: "Bank Details", order: 14, bindings: [] },
      { id: "cheque_date", label: "Dated", type: "date", defaultValue: "2026-11-02", required: true, group: "Bank Details", order: 15, bindings: [] },
      { id: "bank_name", label: "Bank Name", type: "text", defaultValue: "State Bank of India, Borivali", required: true, group: "Bank Details", order: 16, bindings: [] },
      { id: "remark", label: "Remark", type: "text", defaultValue: "Part Payment against Flat 804", required: false, group: "Document Details", order: 17, bindings: [] },
    ],
  },

  // =========================================================================
  // RECEIPT 3: Comprehensive Receipt (PAN & GST)
  // =========================================================================
  {
    id: "master-receipt-3",
    name: "Receipt 3 - Comprehensive Receipt (PAN & GST)",
    category: "Receipts",
    description: "Comprehensive receipt featuring dual company/project header with PAN, GSTIN, RERA, Basic + GST breakdown, and prominent amount box.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        receiptTitle: { fontSize: 14, bold: true, alignment: "center", color: "#0f172a" },
        amountBanner: { fontSize: 18, bold: true, color: "#059669", margin: [0, 8, 0, 8] },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" },
      },
      content: [
        {
          columns: [
            {
              stack: [
                { text: "{{project_by}}", bold: true, fontSize: 12, color: "#0f172a" },
                { text: "{{sub_company_address}}", fontSize: 8.5, color: "#475569" },
                { text: "Contact : {{sub_company_landline}}", fontSize: 8.5 },
                { text: "PAN : {{sub_company_pan}}", bold: true, fontSize: 8.5 },
              ],
              width: "*",
            },
            {
              stack: [
                { text: "Project : {{project_name}}", bold: true, fontSize: 11 },
                { text: "{{site_address}}", fontSize: 8.5, color: "#475569" },
                { text: "Rera No.: {{rera}}", bold: true, fontSize: 8.5 },
                { text: "GST : {{sub_company_gst}}", bold: true, fontSize: 8.5 },
              ],
              width: 220,
              alignment: "right",
            },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          canvas: [{ type: "line", x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 1, lineColor: "#cbd5e1" }],
          margin: [0, 0, 0, 12],
        },
        {
          columns: [
            { text: "Date: {{payment_date}}", bold: true },
            { text: "RECEIPT", style: "receiptTitle" },
            { text: "Receipt No.: {{receipt_number}}", alignment: "right", bold: true },
          ],
          margin: [0, 0, 0, 14],
        },
        {
          stack: [
            { text: "Received with the thanks from {{customer_name}}", bold: true, fontSize: 11 },
            { text: "Basic: ₹ {{amount_without_tax}} + GST: ₹ {{tax_amount}} = Total: ₹ {{amount_for_paid}}", color: "#334155", margin: [0, 4, 0, 4] },
            { text: "a sum of {{amount_in_words}} on account of amount received against Unit No.: {{unit_wing}}- {{unit_name}}", color: "#334155" },
            { text: "₹{{amount_paid}}", style: "amountBanner" },
          ],
          margin: [0, 0, 0, 12],
        },
        {
          stack: [
            { text: "Cheque/ D.D. No./ RTGS : {{cheque_number}} Dated : {{cheque_date}}", bold: true },
            { text: "Bank Name: {{bank_name}}" },
            { text: "Remark: {{remark}}", italics: true, color: "#475569" },
          ],
          margin: [0, 0, 0, 16],
        },
        {
          columns: [
            {
              text: "Cheques are subject to realisation",
              fontSize: 8.5,
              italics: true,
              color: "#64748b",
              margin: [0, 40, 0, 0],
            },
            {
              stack: [
                { text: "For {{project_by}}", bold: true, margin: [0, 0, 0, 36] },
                { text: "Authorised Signatory", style: "signatory" },
              ],
              alignment: "right",
              width: 180,
            },
          ],
          margin: [0, 0, 0, 20],
        },
        {
          text: "This is an auto- generated Payment Receipt.",
          alignment: "center",
          fontSize: 8.5,
          italics: true,
          color: "#94a3b8",
        },
      ],
    },
    variables: [
      { id: "project_by", label: "Company / Developer", type: "text", defaultValue: "Gurukrupa Realcon Developers Pvt. Ltd.", required: true, group: "Company Details", order: 0, bindings: [] },
      { id: "sub_company_address", label: "Company Address", type: "textarea", defaultValue: "Gurukrupa Heights, Ghatkopar East, Mumbai - 400077", required: false, group: "Company Details", order: 1, bindings: [] },
      { id: "sub_company_landline", label: "Contact No.", type: "phone", defaultValue: "+91-22-25123456", required: false, group: "Contact Details", order: 2, bindings: [] },
      { id: "sub_company_pan", label: "Company PAN", type: "text", defaultValue: "AABCG1234F", required: false, group: "Company Details", order: 3, bindings: [] },
      { id: "project_name", label: "Project Name", type: "text", defaultValue: "Marina Enclave", required: true, group: "Project Details", order: 4, bindings: [] },
      { id: "site_address", label: "Site Address", type: "textarea", defaultValue: "Jankalyan Nagar, Malad West, Mumbai - 400095", required: false, group: "Project Details", order: 5, bindings: [] },
      { id: "rera", label: "RERA No.", type: "text", defaultValue: "P51800004567", required: false, group: "Project Details", order: 6, bindings: [] },
      { id: "sub_company_gst", label: "GSTIN", type: "text", defaultValue: "27AABCG1234F1Z2", required: false, group: "Company Details", order: 7, bindings: [] },
      { id: "payment_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 8, bindings: [] },
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "GRD/2026/512", required: true, group: "Document Details", order: 9, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Pooja Mehta", required: true, group: "Customer Details", order: 10, bindings: [] },
      { id: "amount_without_tax", label: "Basic Amount", type: "currency", defaultValue: 850000, required: true, group: "Financial Details", order: 11, bindings: [] },
      { id: "tax_amount", label: "GST Amount", type: "currency", defaultValue: 42500, required: true, group: "Financial Details", order: 12, bindings: [] },
      { id: "amount_for_paid", label: "Total Amount", type: "currency", defaultValue: 892500, required: true, group: "Financial Details", order: 13, bindings: [] },
      { id: "amount_paid", label: "Amount Paid", type: "currency", defaultValue: 892500, required: true, group: "Financial Details", order: 14, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Eight Lakh Ninety Two Thousand Five Hundred Only", required: true, group: "Financial Details", order: 15, bindings: [] },
      { id: "unit_wing", label: "Wing", type: "text", defaultValue: "Wing C", required: false, group: "Property Details", order: 16, bindings: [] },
      { id: "unit_name", label: "Unit No.", type: "text", defaultValue: "1103", required: true, group: "Property Details", order: 17, bindings: [] },
      { id: "cheque_number", label: "Cheque / RTGS / UTR No.", type: "text", defaultValue: "ICIC00088921", required: true, group: "Bank Details", order: 18, bindings: [] },
      { id: "cheque_date", label: "Dated", type: "date", defaultValue: "2026-11-03", required: true, group: "Bank Details", order: 19, bindings: [] },
      { id: "bank_name", label: "Bank Name", type: "text", defaultValue: "ICICI Bank, Ghatkopar", required: true, group: "Bank Details", order: 20, bindings: [] },
      { id: "remark", label: "Remark", type: "text", defaultValue: "11th Slab RCC milestone payment", required: false, group: "Document Details", order: 21, bindings: [] },
    ],
  },

  // =========================================================================
  // RECEIPT 4: Sankalp Builders
  // =========================================================================
  {
    id: "master-receipt-4",
    name: "Receipt 4 - Sankalp Builders",
    category: "Receipts",
    description: "Statutory payment receipt for Sankalp Builders (Jaipur) with GSTIN, RERA, detailed tax breakdown table (Basic, CGST, SGST, Total), and terms.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 9.5, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        companyTitle: { fontSize: 15, bold: true, alignment: "center", color: "#0f172a" },
        subHeader: { fontSize: 8.5, alignment: "center", color: "#475569" },
        receiptTitle: { fontSize: 13, bold: true, alignment: "center", color: "#0f172a" },
        tableHeader: { bold: true, fontSize: 9, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9 },
        boldCell: { fontSize: 9, bold: true },
        signatory: { bold: true, fontSize: 9.5, color: "#0f172a" },
        noteText: { fontSize: 8, color: "#64748b", lineHeight: 1.2 },
      },
      content: [
        { text: "SANKALP BUILDERS", style: "companyTitle" },
        { text: "Corp. Off.. E-123-124, Behind IOC Petrol Pump, Sahakar Marg, Jaipur -302015 (Raj.)\nPhone: +91-141-247-0007/2470008", style: "subHeader", margin: [0, 2, 0, 8] },
        {
          columns: [
            { text: "GSTIN: {{sub_company_gst}}", bold: true, fontSize: 9 },
            { text: "RECEIPT", style: "receiptTitle" },
            { text: "Rera REG No.: {{rera}}", alignment: "right", bold: true, fontSize: 9 },
          ],
          margin: [0, 0, 0, 6],
        },
        {
          canvas: [{ type: "line", x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 1, lineColor: "#cbd5e1" }],
          margin: [0, 0, 0, 10],
        },
        {
          columns: [
            { text: "Date: {{payment_date}}", bold: true },
            { text: "Receipt No.: {{receipt_number}}", alignment: "right", bold: true },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          text: "Received with the thanks from {{customer_name}}\na sum of {{amount_in_words}} vide {{payment_mode}}: {{cheque_number}} Dated: {{cheque_date}} Drawn on {{bank_name}} on account of {{remark}} in respect of provisional Unit No. {{unit_name}} in the project {{project_name}} {{site_address}}",
          margin: [0, 0, 0, 8],
        },
        {
          text: "In accordance with the terms and conditions of booking. The break- up the amount received is as under:-",
          fontSize: 9,
          color: "#475569",
          margin: [0, 0, 0, 6],
        },
        {
          table: {
            headerRows: 1,
            widths: [50, "*", 120],
            body: [
              [
                { text: "Sr. No.", style: "tableHeader", alignment: "center" },
                { text: "Particulars", style: "tableHeader" },
                { text: "Amount(Rs.)", style: "tableHeader", alignment: "right" },
              ],
              [
                { text: "1.", style: "tableCell", alignment: "center" },
                { text: "Basic Consideration", style: "tableCell" },
                { text: "₹{{amount_without_tax}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "2.", style: "tableCell", alignment: "center" },
                { text: "CGST", style: "tableCell" },
                { text: "₹{{cgst}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "3.", style: "tableCell", alignment: "center" },
                { text: "SGST", style: "tableCell" },
                { text: "₹{{sgst}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "4.", style: "boldCell", alignment: "center", fillColor: "#f8fafc" },
                { text: "Total Amount", style: "boldCell", fillColor: "#f8fafc" },
                { text: "₹{{amount_for_paid}}", style: "boldCell", alignment: "right", fillColor: "#f8fafc" },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            {
              text: "Receipt of cheque shall be valid subject to realization.",
              fontSize: 8.5,
              italics: true,
              color: "#64748b",
              margin: [0, 16, 0, 0],
            },
            {
              stack: [
                { text: "For M/ s Sankalp Builders", bold: true, margin: [0, 0, 0, 30] },
                { text: "(Authorised Signatory)", style: "signatory" },
              ],
              alignment: "right",
              width: 170,
            },
          ],
          margin: [0, 0, 0, 12],
        },
        {
          stack: [
            { text: "Note:", bold: true, fontSize: 8.5 },
            { text: "1. This receipt is not transerable.", style: "noteText" },
            { text: "2. This receipt is neither a dcoument of title nor a document giving any other right in the respect of immovable property and thus entering into a transaction of subsequent sale/ purchase etc. based on this receipt would be so at his/ her own risk.", style: "noteText" },
            { text: "3. The amount mentioned in this receipt may be liable to be forfeited, in accordance with the terms and conditions of the booking if all payments are not mode on time or the other breach by the applicant(s).", style: "noteText" },
          ],
        },
      ],
    },
    variables: [
      { id: "rera", label: "RERA REG No.", type: "text", defaultValue: "RAJ/P/2021/1542", required: true, group: "Project Details", order: 0, bindings: [] },
      { id: "sub_company_gst", label: "GSTIN", type: "text", defaultValue: "08ACOFS3617H1ZT", required: true, group: "Company Details", order: 1, bindings: [] },
      { id: "payment_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 2, bindings: [] },
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "SB/2026/0431", required: true, group: "Document Details", order: 3, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Sunil Agarwal", required: true, group: "Customer Details", order: 4, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Six Lakh Thirty Thousand Only", required: true, group: "Financial Details", order: 5, bindings: [] },
      { id: "payment_mode", label: "Payment Mode", type: "text", defaultValue: "RTGS", required: true, group: "Bank Details", order: 6, bindings: [] },
      { id: "cheque_number", label: "Cheque / UTR No.", type: "text", defaultValue: "HDFCR52026110291", required: true, group: "Bank Details", order: 7, bindings: [] },
      { id: "cheque_date", label: "Instrument Date", type: "date", defaultValue: "2026-11-02", required: true, group: "Bank Details", order: 8, bindings: [] },
      { id: "bank_name", label: "Drawn On (Bank)", type: "text", defaultValue: "HDFC Bank, Jaipur", required: true, group: "Bank Details", order: 9, bindings: [] },
      { id: "remark", label: "On Account Of", type: "text", defaultValue: "5th Floor Slab Milestone", required: false, group: "Document Details", order: 10, bindings: [] },
      { id: "unit_name", label: "Provisional Unit No.", type: "text", defaultValue: "A-502", required: true, group: "Property Details", order: 11, bindings: [] },
      { id: "project_name", label: "Project Name", type: "text", defaultValue: "The Rise", required: true, group: "Project Details", order: 12, bindings: [] },
      { id: "site_address", label: "Project Site Address", type: "textarea", defaultValue: "Ajmer Road, Jaipur", required: true, group: "Project Details", order: 13, bindings: [] },
      { id: "amount_without_tax", label: "Basic Consideration", type: "currency", defaultValue: 600000, required: true, group: "Financial Details", order: 14, bindings: [] },
      { id: "cgst", label: "CGST (2.5%)", type: "currency", defaultValue: 15000, required: true, group: "Financial Details", order: 15, bindings: [] },
      { id: "sgst", label: "SGST (2.5%)", type: "currency", defaultValue: 15000, required: true, group: "Financial Details", order: 16, bindings: [] },
      { id: "amount_for_paid", label: "Total Amount Received", type: "currency", defaultValue: 630000, required: true, group: "Financial Details", order: 17, bindings: [] },
    ],
  },

  // =========================================================================
  // RECEIPT 5: Margin Table Receipt
  // =========================================================================
  {
    id: "master-receipt-5",
    name: "Receipt 5 - Margin Table Receipt",
    category: "Receipts",
    description: "Compact payment receipt format with upper right metadata box, payment mode table, unit details, and 10% booking cancellation clause.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        tableHeader: { bold: true, fontSize: 9.5, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9.5 },
        signatory: { bold: true, fontSize: 10, color: "#0f172a" },
        notice: { fontSize: 8.5, color: "#64748b", italics: true },
      },
      content: [
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "Receipt No. : {{receipt_number}}", bold: true },
                { text: "Date : {{payment_date}}" },
                { text: "₹{{amount_paid}}", fontSize: 18, bold: true, color: "#0369a1", margin: [0, 4, 0, 0] },
              ],
              alignment: "right",
              width: 180,
            },
          ],
          margin: [0, 0, 0, 16],
        },
        {
          stack: [
            { text: "Received with thanks from :", color: "#64748b" },
            { text: "{{customer_name}}", bold: true, fontSize: 12, margin: [0, 2, 0, 6] },
            { text: "the sum of : {{amount_in_words}}", italics: true, margin: [0, 0, 0, 4] },
            { text: "by as under as per details in margin hereof", color: "#64748b", fontSize: 9 },
          ],
          margin: [0, 0, 0, 14],
        },
        {
          table: {
            headerRows: 1,
            widths: [80, 110, 90, "*"],
            body: [
              [
                { text: "Mode", style: "tableHeader" },
                { text: "Chq/ RTGS No.", style: "tableHeader" },
                { text: "DATED", style: "tableHeader" },
                { text: "Name of Bank / Branch", style: "tableHeader" },
              ],
              [
                { text: "{{payment_mode}}", style: "tableCell" },
                { text: "{{cheque_number}}", style: "tableCell" },
                { text: "{{cheque_date}}", style: "tableCell" },
                { text: "{{bank_name}}", style: "tableCell" },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 14],
        },
        {
          text: "ON ACCOUNT OF EARNEST MONEY / FULL PAYMENT / GST TOWARDS THE PURCHASE VALUE OF SHOP / FLAT NO. {{unit_name}} ON FLOOR {{unit_floor}}",
          bold: true,
          fontSize: 9.5,
          color: "#334155",
          margin: [0, 0, 0, 16],
        },
        {
          columns: [
            {
              stack: [
                { text: "ALL PAYMENT BY CHEQUE ARE ACKNOWLEDGED SUBJECT TO REALISATION", style: "notice" },
                { text: "*On Cancellation of booking 10% payment will be deducted", style: "notice", color: "#ef4444" },
              ],
              width: "*",
            },
            {
              text: "Authorised Signatory",
              style: "signatory",
              alignment: "right",
              width: 160,
              margin: [0, 20, 0, 0],
            },
          ],
          margin: [0, 0, 0, 24],
        },
        {
          text: "This is computer generated copy",
          alignment: "center",
          style: "notice",
        },
      ],
    },
    variables: [
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "REC/2026/0921", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "payment_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 1, bindings: [] },
      { id: "amount_paid", label: "Amount Paid", type: "currency", defaultValue: 250000, required: true, group: "Financial Details", order: 2, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Amitabh Banerjee", required: true, group: "Customer Details", order: 3, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Two Lakh Fifty Thousand Only", required: true, group: "Financial Details", order: 4, bindings: [] },
      { id: "payment_mode", label: "Mode", type: "text", defaultValue: "Cheque", required: true, group: "Bank Details", order: 5, bindings: [] },
      { id: "cheque_number", label: "Chq / RTGS No.", type: "text", defaultValue: "000412", required: true, group: "Bank Details", order: 6, bindings: [] },
      { id: "cheque_date", label: "Dated", type: "date", defaultValue: "2026-11-01", required: true, group: "Bank Details", order: 7, bindings: [] },
      { id: "bank_name", label: "Name of Bank / Branch", type: "text", defaultValue: "Axis Bank, Bandra West", required: true, group: "Bank Details", order: 8, bindings: [] },
      { id: "unit_name", label: "Shop / Flat No.", type: "text", defaultValue: "Flat 402", required: true, group: "Property Details", order: 9, bindings: [] },
      { id: "unit_floor", label: "On Floor", type: "text", defaultValue: "4th Floor", required: true, group: "Property Details", order: 10, bindings: [] },
    ],
  },

  // =========================================================================
  // RECEIPT 6: Royal Buildcon
  // =========================================================================
  {
    id: "master-receipt-6",
    name: "Receipt 6 - Royal Buildcon",
    category: "Receipts",
    description: "Full-scale company receipt with dual Customer and Company/GSTIN detail blocks, 9-column instrument and tax breakdown table, and terms.",
    definition: {
      pageSize: "A4",
      pageMargins: [36, 36, 36, 36],
      defaultStyle: { font: "Roboto", fontSize: 9.5, color: "#1e293b", lineHeight: 1.25 },
      styles: {
        companyTitle: { fontSize: 16, bold: true, alignment: "center", color: "#0f172a" },
        receiptTitle: { fontSize: 12, bold: true, alignment: "center", color: "#475569", margin: [0, 2, 0, 8] },
        sectionHead: { fontSize: 9.5, bold: true, color: "#0f172a", margin: [0, 2, 0, 2] },
        tableHeader: { bold: true, fontSize: 8, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 8 },
        tableCellBold: { fontSize: 8, bold: true },
        signatory: { bold: true, fontSize: 9.5, color: "#0f172a" },
        noteText: { fontSize: 8, color: "#64748b", lineHeight: 1.2 },
      },
      content: [
        { text: "ROYAL BUILDCON", style: "companyTitle" },
        { text: "RECEIPT", style: "receiptTitle" },
        {
          columns: [
            { text: "Receipt No.: {{receipt_number}}", bold: true },
            { text: "Date: {{current_date}}", alignment: "right", bold: true },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            {
              stack: [
                { text: "CUSTOMER DETAILS", style: "sectionHead" },
                { text: "{{customer_name}}", bold: true },
                { text: "{{customer_address}}", color: "#334155" },
                { text: "(M): {{customer_contact}}" },
                { text: "UNIT DETAILS", style: "sectionHead", margin: [0, 6, 0, 2] },
                { text: "Project : {{project_name}}" },
                { text: "Unit No.: {{unit_name}}" },
                { text: "Floor: {{unit_floor}}  |  Block: {{unit_wing}}" },
              ],
              width: "*",
            },
            {
              stack: [
                { text: "COMPANY DETAILS", style: "sectionHead" },
                { text: "ROYAL BUILDCON", bold: true },
                { text: "Plot-60, Sector-11, Cbd Belapur, Navi Mumbai, Maharashtra 400614", color: "#334155" },
                { text: "Tel: 7977174537 / 8080200802" },
                { text: "Email: vinit@hitechinfragroup.com / hitech270918@gmail.com" },
                { text: "State: Maharashtra  |  State Code: 27" },
                { text: "GSTIN: 27ABAFR3966R1ZD", bold: true },
              ],
              width: 240,
            },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          text: "Received with thanks from a sum of Rs. {{amount_paid}} /- ( {{amount_in_words}} )",
          bold: true,
          fontSize: 9.5,
          margin: [0, 0, 0, 6],
        },
        {
          table: {
            headerRows: 1,
            widths: [20, 45, 55, 60, "*", 55, 45, 45, 55],
            body: [
              [
                { text: "S.No", style: "tableHeader" },
                { text: "Mode", style: "tableHeader" },
                { text: "Inst. Date", style: "tableHeader" },
                { text: "Inst. No", style: "tableHeader" },
                { text: "Bank", style: "tableHeader" },
                { text: "Amount", style: "tableHeader", alignment: "right" },
                { text: "CGST", style: "tableHeader", alignment: "right" },
                { text: "SGST", style: "tableHeader", alignment: "right" },
                { text: "Total Amount", style: "tableHeader", alignment: "right" },
              ],
              [
                { text: "1", style: "tableCell" },
                { text: "{{payment_mode}}", style: "tableCell" },
                { text: "{{cheque_date}}", style: "tableCell" },
                { text: "{{cheque_number}}", style: "tableCell" },
                { text: "{{bank_name}}", style: "tableCell" },
                { text: "₹{{amount_without_tax}}", style: "tableCell", alignment: "right" },
                { text: "₹{{cgst}}", style: "tableCell", alignment: "right" },
                { text: "₹{{sgst}}", style: "tableCell", alignment: "right" },
                { text: "₹{{amount_for_paid}}", style: "tableCell", alignment: "right" },
              ],
              [
                { text: "Total", style: "tableCellBold", colSpan: 5 },
                {},
                {},
                {},
                {},
                { text: "₹{{amount_without_tax}}", style: "tableCellBold", alignment: "right" },
                { text: "₹{{cgst}}", style: "tableCellBold", alignment: "right" },
                { text: "₹{{sgst}}", style: "tableCellBold", alignment: "right" },
                { text: "₹{{amount_for_paid}}", style: "tableCellBold", alignment: "right" },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 8],
        },
        {
          text: "Total Amount Received: ₹{{amount_paid}}",
          bold: true,
          fontSize: 11,
          color: "#0369a1",
          margin: [0, 0, 0, 8],
        },
        {
          stack: [
            { text: "Terms & Conditions.", bold: true, fontSize: 8.5 },
            { text: "1. This receipt is non transferable.", style: "noteText" },
            { text: "2. This receipt is neither a dcoument of title nor a document giving any other right in the respect of immovable property and thus entering into a transaction of subsequent sale/ purchase etc. based on this receipt would be so at his/ her own risk.", style: "noteText" },
            { text: "3. The amount mentioned in this receipt may be liable to be forfeited, in accordance with the terms and conditions of the booking if all payments are not mode on time or the other breach by the applicant(s).", style: "noteText" },
          ],
          margin: [0, 0, 0, 10],
        },
        {
          columns: [
            {
              text: "This is an auto- generated payment receipt and therefore does not require any signature.",
              fontSize: 8,
              italics: true,
              color: "#94a3b8",
              margin: [0, 18, 0, 0],
            },
            {
              stack: [
                { text: "Authorized Signatory", style: "signatory" },
              ],
              alignment: "right",
              width: 150,
            },
          ],
          margin: [0, 0, 0, 10],
        },
        {
          text: "SITE ADDRESS: Plot-04, Sector-5, Pushpaknagar, Dapoli, Navi Mumbai, Maharastra",
          fontSize: 8,
          color: "#64748b",
          alignment: "center",
        },
      ],
    },
    variables: [
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "RB/REC/2026/184", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "current_date", label: "Receipt Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 1, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Rohan Deshmukh", required: true, group: "Customer Details", order: 2, bindings: [] },
      { id: "customer_address", label: "Customer Address", type: "textarea", defaultValue: "Flat 101, Shanti Niketan, Panvel 410206", required: true, group: "Customer Details", order: 3, bindings: [] },
      { id: "customer_contact", label: "Customer Mobile", type: "phone", defaultValue: "9833445566", required: false, group: "Contact Details", order: 4, bindings: [] },
      { id: "project_name", label: "Project Name", type: "text", defaultValue: "Avencia", required: true, group: "Project Details", order: 5, bindings: [] },
      { id: "unit_name", label: "Unit No.", type: "text", defaultValue: "A-701", required: true, group: "Property Details", order: 6, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "7th", required: true, group: "Property Details", order: 7, bindings: [] },
      { id: "unit_wing", label: "Block / Wing", type: "text", defaultValue: "A", required: false, group: "Property Details", order: 8, bindings: [] },
      { id: "amount_paid", label: "Amount Paid", type: "currency", defaultValue: 650000, required: true, group: "Financial Details", order: 9, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Six Lakh Fifty Thousand Only", required: true, group: "Financial Details", order: 10, bindings: [] },
      { id: "payment_mode", label: "Instrument Mode", type: "text", defaultValue: "NEFT", required: true, group: "Bank Details", order: 11, bindings: [] },
      { id: "cheque_date", label: "Instrument Date", type: "date", defaultValue: "2026-11-03", required: true, group: "Bank Details", order: 12, bindings: [] },
      { id: "cheque_number", label: "Instrument No.", type: "text", defaultValue: "INDBN20261103001", required: true, group: "Bank Details", order: 13, bindings: [] },
      { id: "bank_name", label: "Bank Name", type: "text", defaultValue: "IndusInd Bank, Belapur", required: true, group: "Bank Details", order: 14, bindings: [] },
      { id: "amount_without_tax", label: "Amount (Basic)", type: "currency", defaultValue: 619048, required: true, group: "Financial Details", order: 15, bindings: [] },
      { id: "cgst", label: "CGST", type: "currency", defaultValue: 15476, required: true, group: "Financial Details", order: 16, bindings: [] },
      { id: "sgst", label: "SGST", type: "currency", defaultValue: 15476, required: true, group: "Financial Details", order: 17, bindings: [] },
      { id: "amount_for_paid", label: "Total Amount", type: "currency", defaultValue: 650000, required: true, group: "Financial Details", order: 18, bindings: [] },
    ],
  },

  // =========================================================================
  // RECEIPT 7: LMP Group (Rita Palace)
  // =========================================================================
  {
    id: "master-receipt-7",
    name: "Receipt 7 - LMP Group (Rita Palace)",
    category: "Receipts",
    description: "Rita Palace (Borivali West) receipt format with unit and building coordinates, payment acknowledgment, instrument table, and office footer.",
    definition: {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 9.5, color: "#1e293b", lineHeight: 1.3 },
      styles: {
        companyTitle: { fontSize: 15, bold: true, alignment: "center", color: "#0f172a" },
        receiptTitle: { fontSize: 12, bold: true, alignment: "center", color: "#475569", margin: [0, 2, 0, 10] },
        tableHeader: { bold: true, fontSize: 9, fillColor: "#f1f5f9" },
        tableCell: { fontSize: 9 },
        signatory: { bold: true, fontSize: 9.5, color: "#0f172a" },
        footerText: { fontSize: 8, color: "#64748b", alignment: "center" },
      },
      content: [
        { text: "LMP GROUP RITA PALACE", style: "companyTitle" },
        { text: "RECEIPT", style: "receiptTitle" },
        {
          columns: [
            {
              stack: [
                { text: "Flat No: {{unit_name}} on Floor: {{unit_floor}}", bold: true },
                { text: "in Building: RITA PALACE Wing: {{unit_wing}}" },
                { text: "Project on {{site_address}}", color: "#334155" },
              ],
              width: "*",
            },
            {
              stack: [
                { text: "Receipt No. : {{receipt_number}}", bold: true },
                { text: "Date : {{payment_date}}" },
              ],
              width: 160,
              alignment: "right",
            },
          ],
          margin: [0, 0, 0, 12],
        },
        {
          stack: [
            { text: "Received with thanks from : {{customer_name}} {{remark}} ₹{{amount_paid}}", bold: true, fontSize: 10.5 },
            { text: "the sum of : {{amount_in_words}}", italics: true, color: "#334155", margin: [0, 4, 0, 4] },
            { text: "by as under as per details", color: "#64748b", fontSize: 8.5 },
          ],
          margin: [0, 0, 0, 12],
        },
        {
          table: {
            headerRows: 1,
            widths: [100, 120, 90, "*"],
            body: [
              [
                { text: "Amount", style: "tableHeader", alignment: "right" },
                { text: "Chq/ RTGS No.", style: "tableHeader" },
                { text: "Date", style: "tableHeader" },
                { text: "Name of Bank / Branch", style: "tableHeader" },
              ],
              [
                { text: "₹{{amount_paid}}", style: "tableCell", bold: true, alignment: "right" },
                { text: "{{cheque_number}}", style: "tableCell" },
                { text: "{{cheque_date}}", style: "tableCell" },
                { text: "{{bank_name}}", style: "tableCell" },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 14],
        },
        {
          text: "Subject to Realisation of Cheque",
          fontSize: 8.5,
          italics: true,
          color: "#64748b",
          margin: [0, 0, 0, 16],
        },
        {
          columns: [
            { text: "" },
            {
              stack: [
                { text: "For LMP GROUP RITA PALACE,", bold: true },
                { text: "Account department", margin: [0, 0, 0, 30] },
              ],
              alignment: "right",
              width: 190,
            },
          ],
          margin: [0, 0, 0, 16],
        },
        {
          text: "This is auto generated receipt it doesn't require stamp",
          style: "footerText",
          italics: true,
          margin: [0, 0, 0, 8],
        },
        {
          text: "Off: Kahan Bhavan, L.T.road, Behind Diamond Cinema, next to Purohit Hospital , Borivali west Mumbai-92\n98200 49360 | Email: lmpgroup.rpchsl@gmail.com",
          style: "footerText",
        },
      ],
    },
    variables: [
      { id: "receipt_number", label: "Receipt No.", type: "text", defaultValue: "LMP/REC/2026/088", required: true, group: "Document Details", order: 0, bindings: [] },
      { id: "payment_date", label: "Date", type: "date", defaultValue: "2026-11-04", required: true, group: "Document Details", order: 1, bindings: [] },
      { id: "unit_name", label: "Flat No.", type: "text", defaultValue: "503", required: true, group: "Property Details", order: 2, bindings: [] },
      { id: "unit_floor", label: "Floor", type: "text", defaultValue: "5th", required: true, group: "Property Details", order: 3, bindings: [] },
      { id: "unit_wing", label: "Wing", type: "text", defaultValue: "A", required: true, group: "Property Details", order: 4, bindings: [] },
      { id: "site_address", label: "Project Site Address", type: "textarea", defaultValue: "Rita Palace, Harsha Park, Chandravarkar Road, Borivali West, Mumbai - 400092", required: true, group: "Project Details", order: 5, bindings: [] },
      { id: "customer_name", label: "Customer Name", type: "text", defaultValue: "Ketan Shah", required: true, group: "Customer Details", order: 6, bindings: [] },
      { id: "remark", label: "Remark", type: "text", defaultValue: "against Brickwork & Plaster milestone", required: false, group: "Document Details", order: 7, bindings: [] },
      { id: "amount_paid", label: "Amount Paid", type: "currency", defaultValue: 1188000, required: true, group: "Financial Details", order: 8, bindings: [] },
      { id: "amount_in_words", label: "Amount in Words", type: "text", defaultValue: "Rupees Eleven Lakh Eighty Eight Thousand Only", required: true, group: "Financial Details", order: 9, bindings: [] },
      { id: "cheque_number", label: "Chq / RTGS No.", type: "text", defaultValue: "BARBN2026110298", required: true, group: "Bank Details", order: 10, bindings: [] },
      { id: "cheque_date", label: "Date", type: "date", defaultValue: "2026-11-02", required: true, group: "Bank Details", order: 11, bindings: [] },
      { id: "bank_name", label: "Bank / Branch", type: "text", defaultValue: "Bank of Baroda, Borivali West", required: true, group: "Bank Details", order: 12, bindings: [] },
    ],
  },
];
