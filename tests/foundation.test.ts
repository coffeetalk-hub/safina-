import { describe, it, expect } from "vitest";
import { computeLine, round, sum, D } from "@/lib/money";
import { renderPattern } from "@/core/numbering";
import { allPermissions, ROLE_TEMPLATES } from "@/core/rbac/permissions";
import { cellValue, parseListParams, plain } from "@/components/data-table/types";
import { Prisma } from "@prisma/client";

describe("money", () => {
  it("computes a VAT line with percentage discount", () => {
    const l = computeLine({ quantity: 2, unitPrice: 100, discountPct: 10, taxRate: 15 });
    expect(l.gross.toString()).toBe("200");
    expect(l.discount.toString()).toBe("20");
    expect(l.net.toString()).toBe("180");
    expect(l.tax.toString()).toBe("27");
    expect(l.total.toString()).toBe("207");
  });
  it("rounds half-up to halalas", () => {
    expect(round("1.005").toString()).toBe("1.01");
    expect(sum([D("0.1"), D("0.2")]).toString()).toBe("0.3");
  });
});

describe("numbering", () => {
  it("renders patterns", () => {
    const d = new Date(2026, 2, 5);
    expect(renderPattern("{PREFIX}-{YYYY}-{SEQ:4}", "INV", 7, d)).toBe("INV-2026-0007");
    expect(renderPattern("{PREFIX}/{YY}{MM}/{SEQ:6}", "PO", 123, d)).toBe("PO/2603/000123");
    expect(renderPattern("{PREFIX}{SEQ}", "C", 42, d)).toBe("C0042");
  });
});

describe("rbac", () => {
  it("builds a consistent permission catalogue", () => {
    const all = allPermissions();
    expect(all).toContain("finance.invoice:approve");
    expect(new Set(all).size).toBe(all.length);
    expect(ROLE_TEMPLATES.ADMIN.permissions().length).toBe(all.length);
    expect(ROLE_TEMPLATES.EMPLOYEE.permissions()).not.toContain("finance.journal:delete");
  });
});

describe("table helpers", () => {
  it("parses list params and filters", () => {
    const p = parseListParams({ q: "x", page: "3", pageSize: "50", sort: "-code", "f.type": "COMPANY" });
    expect(p).toMatchObject({ q: "x", page: 3, pageSize: 50, sort: "-code", filters: { type: "COMPANY" } });
  });
  it("resolves bilingual and nested values", () => {
    const row = { nameAr: "أ", nameEn: "A", branch: { nameAr: "ف", nameEn: "B" } };
    expect(cellValue({ key: "name", label: "", bilingual: "name" }, row, "ar")).toBe("أ");
    expect(cellValue({ key: "b", label: "", bilingual: "branch.name" }, row, "en")).toBe("B");
  });
  it("serialises Decimal and Date", () => {
    const out = plain({ amount: new Prisma.Decimal("12.5"), at: new Date("2026-01-01T00:00:00Z"), nested: [{ v: new Prisma.Decimal(1) }] });
    expect(out.amount).toBe(12.5);
    expect(out.at).toBe("2026-01-01T00:00:00.000Z");
    expect(out.nested[0].v).toBe(1);
  });
});

describe("zatca", async () => {
  const z = await import("@/core/zatca");
  it("encodes TLV and decodes back", () => {
    const b64 = z.buildQrTlv([{ tag: 1, value: "شركة" }, { tag: 2, value: "300000000000003" }]);
    const buf = Buffer.from(b64, "base64");
    expect(buf[0]).toBe(1);
    expect(buf[1]).toBe(Buffer.byteLength("شركة", "utf8"));
    expect(buf.subarray(2, 2 + buf[1]).toString("utf8")).toBe("شركة");
  });
  it("builds UBL XML with the right type codes and hash chain", () => {
    const inv = {
      number: "INV-1", uuid: "u", issueDate: new Date("2026-05-01T10:00:00Z"), type: "SIMPLIFIED" as const, kind: "INVOICE" as const, currency: "SAR", icv: 1, previousHash: z.GENESIS_HASH,
      seller: { nameAr: "بائع", nameEn: "Seller", vatNumber: "300000000000003" }, buyer: null,
      lines: [{ id: 1, name: "x", quantity: 2, unitPrice: 100, net: 200, discount: 0, taxRate: 15, taxAmount: 30, total: 230, taxCategory: "S" as const }],
      subtotal: 200, discountTotal: 0, taxTotal: 30, total: 230,
    };
    const xml = z.buildUblXml(inv);
    expect(xml).toContain('<cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>');
    expect(xml).toContain("<cbc:TaxInclusiveAmount currencyID=\"SAR\">230.00</cbc:TaxInclusiveAmount>");
    expect(z.invoiceHash(xml)).toHaveLength(44);
    expect(z.invoiceTypeCode("CREDIT_NOTE")).toBe("381");
  });
});

describe("depreciation", async () => {
  const { monthlyDepreciation } = await import("@/modules/finance/assets/service");
  it("straight line and declining balance", () => {
    expect(monthlyDepreciation({ cost: 36000, salvage: 0, lifeMonths: 36, method: "STRAIGHT_LINE", rate: 0, accumulated: 0 }).toString()).toBe("1000");
    expect(monthlyDepreciation({ cost: 36000, salvage: 0, lifeMonths: 36, method: "STRAIGHT_LINE", rate: 0, accumulated: 35500 }).toString()).toBe("500");
    expect(monthlyDepreciation({ cost: 120000, salvage: 0, lifeMonths: 60, method: "DECLINING_BALANCE", rate: 24, accumulated: 0 }).toString()).toBe("2400");
    expect(monthlyDepreciation({ cost: 1000, salvage: 1000, lifeMonths: 12, method: "STRAIGHT_LINE", rate: 0, accumulated: 0 }).isZero()).toBe(true);
  });
});

import { computeScore, WEIGHTS } from "@/modules/purchasing/evaluations";
import { compare } from "@/modules/purchasing/rfq";

describe("purchasing", () => {
  it("vendor evaluation weighted score", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(computeScore({ quality: 5, delivery: 5, price: 5, service: 5, compliance: 5 })).toBe(100);
    expect(computeScore({ quality: 3, delivery: 3, price: 3, service: 3, compliance: 3 })).toBe(60);
    expect(computeScore({ quality: 5, delivery: 1, price: 1, service: 1, compliance: 1 })).toBe(44);
  });
  it("RFQ comparison picks lowest per line and ranks vendors", () => {
    const rfq = {
      lines: [{ id: "L1", lineNo: 1, descriptionAr: "أ", descriptionEn: "A", quantity: 2, unit: "EA" }, { id: "L2", lineNo: 2, descriptionAr: "ب", descriptionEn: "B", quantity: 1, unit: "EA" }],
      quotes: [
        { vendorId: "V1", received: true, total: 300, leadDays: 5, paymentTerms: null, validUntil: null, quoteRef: null, selected: false, vendor: { id: "V1", code: "V1", nameAr: "", nameEn: "" }, lines: [{ rfqLineId: "L1", unitPrice: 100 }, { rfqLineId: "L2", unitPrice: 100 }] },
        { vendorId: "V2", received: true, total: 250, leadDays: 9, paymentTerms: null, validUntil: null, quoteRef: null, selected: false, vendor: { id: "V2", code: "V2", nameAr: "", nameEn: "" }, lines: [{ rfqLineId: "L1", unitPrice: 50 }, { rfqLineId: "L2", unitPrice: 150 }] },
        { vendorId: "V3", received: false, total: 0, leadDays: null, paymentTerms: null, validUntil: null, quoteRef: null, selected: false, vendor: { id: "V3", code: "V3", nameAr: "", nameEn: "" }, lines: [] },
      ],
    } as unknown as Parameters<typeof compare>[0];
    const c = compare(rfq);
    expect(c.totals.map((t) => t.vendorId)).toEqual(["V1", "V2"]);
    expect(c.rows[0].min).toBe(50);
    expect(c.rows[1].min).toBe(100);
    expect(c.totals.find((t) => t.vendorId === "V2")?.rank).toBe(1);
    expect(c.totals.find((t) => t.vendorId === "V1")?.lowestLines).toBe(1);
  });
});

import { computeGosi, computeEosb, sickPayFraction, annualLeaveDays, overtimePay, attendanceMetrics, calendarDays } from "@/modules/hr/rules";

describe("hr rules (Saudi labour law / GOSI)", () => {
  const saudi = { employeePension: 9, employerPension: 9, employeeSaned: 0.75, employerSaned: 0.75, employerHazard: 2 };
  const nonSaudi = { employeePension: 0, employerPension: 0, employeeSaned: 0, employerSaned: 0, employerHazard: 2 };
  it("GOSI: Saudi 9.75% / 11.75% on basic+housing, capped at 45,000 and floored at 1,500", () => {
    const g = computeGosi(true, 10000, saudi, 1500, 45000);
    expect(g.employee).toBe(975); expect(g.employer).toBe(1175);
    expect(computeGosi(true, 60000, saudi, 1500, 45000).wage).toBe(45000);
    expect(computeGosi(true, 1000, saudi, 1500, 45000).wage).toBe(1500);
    const n = computeGosi(false, 8000, nonSaudi, 1500, 45000);
    expect(n.employee).toBe(0); expect(n.employer).toBe(160);
  });
  it("EOSB Art. 84/85: half month for first 5 years, full after; resignation tiers", () => {
    expect(computeEosb(3, 10000, "TERMINATION").amount).toBe(15000);
    expect(computeEosb(7, 10000, "TERMINATION").amount).toBe(45000);
    expect(computeEosb(1.5, 10000, "RESIGNATION").amount).toBe(0);
    expect(computeEosb(3, 10000, "RESIGNATION").amount).toBe(5000);
    expect(computeEosb(7, 10000, "RESIGNATION").amount).toBe(30000);
    expect(computeEosb(12, 10000, "RESIGNATION").amount).toBe(95000);
    expect(computeEosb(7, 10000, "ARTICLE_80").amount).toBe(0);
  });
  it("leave rules: Art. 109 entitlement and Art. 117 sick pay tiers", () => {
    expect(annualLeaveDays(2, 21, 30)).toBe(21); expect(annualLeaveDays(5, 21, 30)).toBe(30);
    expect(sickPayFraction(0, 30, 60, 75)).toBe(1); expect(sickPayFraction(29, 30, 60, 75)).toBe(1);
    expect(sickPayFraction(30, 30, 60, 75)).toBe(0.75); expect(sickPayFraction(89, 30, 60, 75)).toBe(0.75);
    expect(sickPayFraction(90, 30, 60, 75)).toBe(0);
    expect(calendarDays(new Date("2026-03-01"), new Date("2026-03-07"))).toBe(7);
  });
  it("overtime Art. 107 and attendance metrics", () => {
    expect(overtimePay(10, 6000, 30, 8, 1.5)).toBe(375); // 6000/240 = 25/h × 1.5 × 10
    const m = attendanceMetrics("08:25", "19:00", "08:00", "17:00", 10, 8);
    expect(m.lateMin).toBe(25); expect(m.workedHrs).toBe(9.58); expect(m.overtimeHrs).toBe(1.58);
    expect(attendanceMetrics("08:00", "17:00", "08:00", "17:00", 10, 8).overtimeHrs).toBe(0);
    expect(attendanceMetrics("08:05", "17:00", "08:00", "17:00", 10, 8).lateMin).toBe(0);
  });
});
