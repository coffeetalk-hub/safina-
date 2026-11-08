import { z } from "zod";
import { makeCrud, zStr, zOptStr, zMoney } from "../_shared/crud";
import { allocateNumber } from "@/core/numbering";

export const customerSchema = z.object({
  id: z.string().nullable().optional(),
  code: z.string().trim().max(30).nullable().optional(),
  nameAr: zStr(),
  nameEn: zStr(),
  type: z.enum(["COMPANY", "INDIVIDUAL", "GOVERNMENT"]).default("COMPANY"),
  vatNumber: zOptStr(20),
  crNumber: zOptStr(20),
  email: z.string().trim().email().nullable().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  phone: zOptStr(30),
  mobile: zOptStr(30),
  addressAr: zOptStr(),
  addressEn: zOptStr(),
  city: zOptStr(80),
  country: z.string().trim().max(2).default("SA"),
  buildingNo: zOptStr(10),
  district: zOptStr(80),
  postalCode: zOptStr(10),
  contactPerson: zOptStr(120),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(30),
  currencyCode: z.string().trim().max(3).default("SAR"),
  receivableAccountId: zOptStr(40),
  creditLimit: zMoney,
  blockOnCreditExceed: z.coerce.boolean().default(true),
  notes: zOptStr(2000),
  isActive: z.coerce.boolean().default(true),
});

export const customers = makeCrud({
  model: "customer",
  resource: "customer",
  schema: customerSchema,
  searchFields: ["code", "nameAr", "nameEn", "vatNumber", "email", "phone", "mobile"],
  sortFields: ["code", "nameAr", "nameEn", "city", "creditLimit", "createdAt"],
  defaultOrder: { code: "asc" },
  beforeSave: async (data, session, id) => {
    if (!id && !data.code) data.code = await allocateNumber(session.companyId, "CUSTOMER");
    return data;
  },
});
