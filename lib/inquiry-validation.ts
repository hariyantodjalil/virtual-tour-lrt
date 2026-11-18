import { z } from "zod";

export const inquiryPhoneSchema = z.string().trim().max(32)
  .regex(/^\+?[0-9][0-9()\s.-]*$/, "Format nomor WhatsApp tidak valid.")
  .refine(value => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }, "Nomor WhatsApp harus berisi 10–15 digit.");
