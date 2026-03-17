import twilio from "twilio";

export async function sendSmsCode(params: {
  to: string;
  code: string;
}): Promise<void> {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  await client.messages.create({
    body: `Your Postar verification code is: ${params.code}`,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: params.to,
  });
}
