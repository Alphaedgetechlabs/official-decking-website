const AU_COUNTRY_CODE = "61";
const PK_COUNTRY_CODE = "92";

/** E.164: + then 8–15 digits, country code cannot start with 0. */
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/** Strip spaces, hyphens, brackets, dots. Preserves a leading +. */
function stripSeparators(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/[\s\-().]/g, "")}`;
  }
  return trimmed.replace(/[\s\-().]/g, "");
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Normalizes any phone string to strict E.164 for Twilio (e.g. +923174433711).
 * AU +61 and PK +92 inputs are both supported — no extra prefix is added when
 * sending from an AU Twilio number to a PK recipient; Twilio routes by E.164.
 */
export function toE164ForTwilio(phone: string): string | null {
  const cleaned = stripSeparators(phone);
  if (!cleaned || cleaned.includes("@")) {
    return null;
  }

  let e164: string;

  if (cleaned.startsWith("+")) {
    const digits = digitsOnly(cleaned.slice(1));
    if (!digits) return null;
    e164 = `+${digits}`;
  } else {
    const digits = digitsOnly(cleaned);
    if (!digits) return null;

    if (digits.startsWith("00")) {
      e164 = `+${digits.slice(2)}`;
    } else if (digits.startsWith("04")) {
      e164 = `+${AU_COUNTRY_CODE}${digits.slice(1)}`;
    } else if (digits.startsWith("03")) {
      e164 = `+${PK_COUNTRY_CODE}${digits.slice(1)}`;
    } else if (digits.startsWith(AU_COUNTRY_CODE)) {
      e164 = `+${digits}`;
    } else if (digits.startsWith(PK_COUNTRY_CODE)) {
      e164 = `+${digits}`;
    } else if (digits.startsWith("0")) {
      const national = digits.slice(1);
      if (national.startsWith("3")) {
        e164 = `+${PK_COUNTRY_CODE}${national}`;
      } else if (national.startsWith("4")) {
        e164 = `+${AU_COUNTRY_CODE}${national}`;
      } else {
        e164 = `+${AU_COUNTRY_CODE}${national}`;
      }
    } else if (digits.startsWith("3")) {
      e164 = `+${PK_COUNTRY_CODE}${digits}`;
    } else if (digits.startsWith("4")) {
      e164 = `+${AU_COUNTRY_CODE}${digits}`;
    } else {
      e164 = `+${digits}`;
    }
  }

  if (!E164_REGEX.test(e164)) {
    return null;
  }

  return e164;
}

// ponytail: smoke-check — run `node lib/twilioPhone.js` after build if this file grows
if (require.main === module) {
  const cases: Array<[string, string | null]> = [
    ["+92 317 4433711", "+923174433711"],
    ["+923174433711", "+923174433711"],
    ["03174433711", "+923174433711"],
    ["+61 412 345 678", "+61412345678"],
    ["user@email.com", null],
  ];
  for (const [input, expected] of cases) {
    const got = toE164ForTwilio(input);
    if (got !== expected) {
      throw new Error(`toE164ForTwilio(${JSON.stringify(input)}) => ${got}, want ${expected}`);
    }
  }
}
