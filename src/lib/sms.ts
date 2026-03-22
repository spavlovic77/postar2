import twilio from "twilio";
import { getTwilioPhoneNumber } from "@/lib/settings";

export async function sendSmsCode(params: {
  to: string;
  code: string;
}): Promise<void> {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  const fromNumber = await getTwilioPhoneNumber();

  await client.messages.create({
    body: `Your Postar verification code is: ${params.code}`,
    from: fromNumber,
    to: params.to,
  });
}
