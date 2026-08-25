/**
 * Firestore-triggered SMS sender (Twilio Send Message extension replacement).
 * Listens for new docs in `messages/{docId}` and sends SMS via Twilio.
 */

import {setGlobalOptions} from "firebase-functions";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import twilio from "twilio";
import {toE164ForTwilio} from "./twilioPhone.js";

setGlobalOptions({maxInstances: 10});

/**
 * Triggered when a document is created under `messages/{docId}`.
 * Expected fields: `to` (E.164 phone), `body` (SMS text).
 */
export const processTwilioSms = onDocumentCreated(
  "messages/{docId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.error("No document snapshot on create event", {
        docId: event.params.docId,
      });
      return;
    }

    const data = snapshot.data();
    const rawTo = typeof data.to === "string" ? data.to : "";
    const body = typeof data.body === "string" ? data.body.trim() : "";

    const to = toE164ForTwilio(rawTo);
    if (!to) {
      logger.error("Invalid Twilio 'to' phone number after E.164 normalization", {
        docId: event.params.docId,
        rawTo,
      });
      return;
    }

    if (!body) {
      logger.error("Missing required field 'body' in messages doc", {
        docId: event.params.docId,
        rawTo,
        bodyType: typeof (data as Record<string, unknown>)?.body,
        bodyRaw: (data as Record<string, unknown>)?.body,
        keys: Object.keys(data ?? {}),
        wholeDoc: data,
      });
      return;
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const rawFrom = process.env.TWILIO_PHONE_NUMBER ?? "";

    if (!accountSid || !authToken || !rawFrom) {
      logger.error(
        "Twilio credentials missing. Set TWILIO_ACCOUNT_SID, " +
          "TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
      );
      throw new Error("Twilio credentials are not configured");
    }

    const from = toE164ForTwilio(rawFrom);
    if (!from) {
      logger.error("Invalid Twilio 'from' phone number after E.164 normalization", {
        rawFrom,
      });
      throw new Error("TWILIO_PHONE_NUMBER is not a valid E.164 number");
    }

    const client = twilio(accountSid, authToken);

    // TEMP DEV DISABLE — set to `false` to re-enable live Twilio SMS.
    const TWILIO_SMS_DISABLED_FOR_DEV = true;
    if (TWILIO_SMS_DISABLED_FOR_DEV) {
      console.log("Twilio SMS sending is temporarily disabled for development");
      logger.info("Twilio SMS skipped (temporarily disabled for development)", {
        docId: event.params.docId,
        rawTo,
        to,
        from,
        body,
      });
      return;
    }

    try {
      const message = await client.messages.create({
        to,
        from,
        body,
      });

      logger.info("SMS sent successfully", {
        docId: event.params.docId,
        sid: message.sid,
        status: message.status,
        rawTo,
        to,
        from,
      });
    } catch (error) {
      logger.error("Failed to send SMS via Twilio", {
        docId: event.params.docId,
        rawTo,
        to,
        from,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);
