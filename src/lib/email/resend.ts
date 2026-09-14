import "server-only";

import { Resend } from "resend";
import { getEnv } from "@/lib/env";

export async function sendReportEmail(recipients: string[], clientName: string, reportMonth: string, pdf: Buffer) {
  if (!recipients.length) return;
  const resend = new Resend(getEnv().RESEND_API_KEY);
  const result = await resend.emails.send({
    from: "Rebel Reports <reports@rebelmarketing.co>",
    to: recipients,
    subject: `${clientName} performance report — ${reportMonth}`,
    text: `Your ${reportMonth} performance report from Rebel Marketing is attached.`,
    attachments: [{ filename: `${clientName.replace(/[^a-z0-9]+/gi, "-")}-${reportMonth}.pdf`, content: pdf }],
  });
  if (result.error) throw new Error("Unable to send report email");
}
