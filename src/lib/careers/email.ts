export async function sendImpersonationReportEmail({
  reporterUserId,
  reporterEmail,
  reportedPlayerUid,
  message,
}: {
  reporterUserId: string;
  reporterEmail: string;
  reportedPlayerUid?: string;
  message: string;
}) {
  const adminEmail = "noahryannicol@gmail.com";
  console.log("[Careers impersonation report]", {
    to: adminEmail,
    reporterUserId,
    reporterEmail,
    reportedPlayerUid,
    message,
  });

  // Reuse nodemailer when SMTP is configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: adminEmail,
      subject: "[HuckHub Careers] Impersonation report",
      text: `Reporter: ${reporterEmail} (${reporterUserId})\nProfile: ${reportedPlayerUid}\n\n${message}`,
    });
  }
}
