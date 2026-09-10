// ============================================================
// LOCATION: lib/sms.ts
// Text.lk SMS sender (SERVER ONLY) — forgot-password OTP eka
// yawanna. Parana project eke flow eka widiyatama:
//
//   sendSms(phone, message)        ← forgot route eken call wenne meka
//     ↓
//   normalizeSmsPhone()            ← 07XXXXXXXX → 947XXXXXXXX
//                                    +947XXXXXXXX → 947XXXXXXXX
//     ↓
//   sendTextLkSMS()                ← POST https://app.text.lk/api/v3/sms/send
//                                    Authorization: Bearer {TEXTLK_API_TOKEN}
//                                    body: { recipient, sender_id, type, message }
//
// .env eke vars DEKA oni (SMS_API_URL template eka ain una):
//   TEXTLK_API_TOKEN=xxxx
//   TEXTLK_SENDER_ID=xxxx
//
// Vars set karala nathnam sendSms() false return karanai
// (UI eka "contact admin" fallback ekata yanawa).
// ============================================================

const TEXTLK_SMS_ENDPOINT = "https://app.text.lk/api/v3/sms/send";

/** 07XXXXXXXX / +947XXXXXXXX / 947XXXXXXXX → 947XXXXXXXX */
export function normalizeSmsPhone(phone: string): string {
  const digits = String(phone || "").trim().replace(/[^\d+]/g, "");
  if (/^0\d{9}$/.test(digits)) return "94" + digits.slice(1);
  if (/^\+94\d{9}$/.test(digits)) return digits.slice(1);
  return digits;
}

function isTextLkConfigured(): boolean {
  return Boolean(process.env.TEXTLK_API_TOKEN && process.env.TEXTLK_SENDER_ID);
}

/** Text.lk v3 API — POST + Bearer auth */
export async function sendTextLkSMS(
  recipient: string,
  message: string
): Promise<boolean> {
  if (!isTextLkConfigured()) {
    console.warn(
      "[SMS] TEXTLK_API_TOKEN / TEXTLK_SENDER_ID set naha — SMS yawenne naha (contact-admin fallback)"
    );
    return false;
  }

  try {
    const res = await fetch(TEXTLK_SMS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TEXTLK_API_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        recipient, // 947XXXXXXXX (normalized)
        sender_id: process.env.TEXTLK_SENDER_ID,
        type: "plain",
        message,
      }),
    });

    const body = await res.text().catch(() => "");

    if (!res.ok) {
      // gateway reject — exact reason eka log ekata (token eka log wenne naha)
      console.error(
        `[SMS] Gateway ${res.status} ${res.statusText} → to=${recipient} body=${body.slice(0, 300)}`
      );
      return false;
    }

    // 200 nam text.lk error ekak JSON body eke enawa ok status ekka
    try {
      const j = JSON.parse(body);
      if (
        j &&
        j.status &&
        String(j.status).toLowerCase() !== "success" &&
        String(j.status) !== "200" &&
        String(j.status) !== "201"
      ) {
        console.error(
          `[SMS] Gateway error → to=${recipient} body=${body.slice(0, 300)}`
        );
        return false;
      }
    } catch {
      /* JSON nemei — ok status eka witharai */
    }

    console.log(`[SMS] Sent → to=${recipient}`);
    return true;
  } catch (e) {
    console.error("[SMS] Send failed:", e);
    return false;
  }
}

/** Entry point — forgot route eken meka witharai call karanne */
export async function sendSms(
  phone: string,
  message: string
): Promise<boolean> {
  if (!phone) return false;
  const to = normalizeSmsPhone(phone);
  return sendTextLkSMS(to, message);
}
