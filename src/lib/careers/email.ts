export async function sendImpersonationReportEmail({
  reporterUserId,
  reporterEmail,
  reportedPlayerUid,
  message,
  evidenceNotes,
}: {
  reporterUserId: string;
  reporterEmail: string;
  reportedPlayerUid?: string;
  message: string;
  evidenceNotes?: string;
}) {
  const adminEmail = "noahryannicol@gmail.com";
  console.log("[Careers impersonation report]", {
    to: adminEmail,
    reporterUserId,
    reporterEmail,
    reportedPlayerUid,
    message,
    evidenceNotes,
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
      subject: "[HuckHub Careers] Profile claim dispute",
      text: [
        `Reporter: ${reporterEmail} (${reporterUserId})`,
        `Profile: ${reportedPlayerUid}`,
        "",
        "Claim statement:",
        message,
        "",
        evidenceNotes ? `Evidence offered:\n${evidenceNotes}` : "No evidence notes provided.",
      ].join("\n"),
    });
  }
}
