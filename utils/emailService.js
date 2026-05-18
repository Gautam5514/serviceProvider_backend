const nodemailer = require("nodemailer");
const { generateInvoicePdf } = require("./invoicePdf");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── OTP Email ───────────────────────────────────────────────────────────────

function buildOTPEmail(otp, purpose) {
  const isReset    = purpose === "forgot_password";
  const isProvider = purpose === "provider_email_verify";

  const subject = isReset
    ? "Reset Your Password — ServiceMarket"
    : "Your Verification Code — ServiceMarket";

  const accentColor = isReset ? "#dc2626" : "#2563eb";
  const badgeBg     = isReset ? "#fef2f2" : "#eff6ff";
  const badgeLabel  = isReset ? "Password Reset" : isProvider ? "Provider Verification" : "Email Verification";
  const badgeColor  = isReset ? "#dc2626" : "#2563eb";
  const headline    = isReset ? "Reset your password" : "Verify your email address";

  const bodyText = isReset
    ? "We received a request to reset the password on your ServiceMarket account. Use the one-time code below to proceed. If you did not make this request, simply ignore this email \u2014 your account is safe."
    : isProvider
    ? "Welcome to ServiceMarket. Complete your provider registration by verifying your email with the code below. This keeps your account secure."
    : "Welcome to ServiceMarket! One last step \u2014 enter the code below to verify your email and activate your account.";

  const digitCells = otp.split("").map(d =>
    `<td style="padding:0 4px;">` +
    `<div style="width:52px;height:68px;background:#09090b;border-radius:10px;` +
    `text-align:center;line-height:68px;font-size:30px;font-weight:900;` +
    `color:#ffffff;font-family:'Courier New',Courier,monospace;` +
    `box-shadow:0 4px 12px rgba(0,0,0,0.25);">${d}</div></td>`
  ).join("");

  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:32px 16px 48px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
    style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;
           overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">

    <tr><td style="background:${accentColor};height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <tr>
      <td style="background:#09090b;padding:28px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle;">
            <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
              Service<span style="color:#71717a;font-weight:400;">Market</span>
            </span>
          </td>
          <td align="right" style="vertical-align:middle;">
            <span style="display:inline-block;background:${badgeBg};color:${badgeColor};
              font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
              padding:5px 14px;border-radius:100px;">
              ${badgeLabel}
            </span>
          </td>
        </tr></table>
      </td>
    </tr>

    <tr>
      <td style="padding:44px 40px 40px;">

        <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#09090b;
          letter-spacing:-0.5px;line-height:1.2;">
          ${headline}
        </h1>
        <p style="margin:0 0 36px;font-size:15px;color:#52525b;line-height:1.65;max-width:480px;">
          ${bodyText}
        </p>

        <p style="margin:0 0 14px;font-size:10px;font-weight:800;letter-spacing:2.5px;
          text-transform:uppercase;color:#94a3b8;">
          Your One-Time Code
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
          <tr>${digitCells}</tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="margin:0 0 36px;">
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td style="vertical-align:middle;">
                  <span style="font-size:13px;font-weight:600;color:#475569;">
                    Expires in <strong style="color:#09090b;">10 minutes</strong>
                  </span>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="font-size:12px;font-weight:600;color:#94a3b8;">
                    Max&nbsp;<strong style="color:#09090b;">5&nbsp;attempts</strong>
                  </span>
                </td>
              </tr></table>
            </td>
          </tr>
        </table>

        <div style="border-top:1px solid #f1f5f9;margin:0 0 28px;"></div>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td style="width:22px;vertical-align:top;padding-top:2px;">
                  <span style="font-size:16px;">&#128274;</span>
                </td>
                <td style="padding-left:10px;vertical-align:top;">
                  <p style="margin:0 0 3px;font-size:11px;font-weight:800;color:#78350f;
                    text-transform:uppercase;letter-spacing:0.8px;">Security Notice</p>
                  <p style="margin:0;font-size:13px;color:#92400e;line-height:1.55;">
                    Never share this code with anyone. ServiceMarket will
                    <strong style="color:#78350f;">never</strong> call or message you asking for your OTP.
                  </p>
                </td>
              </tr></table>
            </td>
          </tr>
        </table>

      </td>
    </tr>

    <tr>
      <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:22px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:800;color:#09090b;">ServiceMarket</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;">Professional Home Services Platform</p>
          </td>
          <td align="right" style="vertical-align:middle;">
            <p style="margin:0;font-size:11px;color:#cbd5e1;text-align:right;line-height:1.6;">
              Automated notification<br/>Do not reply to this email
            </p>
          </td>
        </tr></table>
      </td>
    </tr>

  </table>

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
    style="max-width:600px;width:100%;margin-top:20px;">
    <tr>
      <td align="center">
        <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">
          If you didn&rsquo;t request this, you can safely ignore this email.
        </p>
        <p style="margin:0;font-size:11px;color:#cbd5e1;">
          &copy; ${year} ServiceMarket &middot; Professional Home Services
        </p>
      </td>
    </tr>
  </table>

</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}


async function sendOTPEmail(to, otp, purpose) {
  const { subject, html } = buildOTPEmail(otp, purpose);
  await transporter.sendMail({
    from: `"ServiceMarket" <${process.env.SMTP_FROM}>`,
    to,
    subject,
    html,
  });
}

// ─── Provider Decision Email ──────────────────────────────────────────────────

function buildDecisionEmail(providerName, decision, remarks) {
  if (decision === "approved") {
    const subject = "🎉 Congratulations! You're Approved — ServiceMarket";
    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">

  <!-- Top accent bar -->
  <tr><td style="background:linear-gradient(135deg,#059669,#10b981);height:6px;"></td></tr>

  <!-- Header -->
  <tr>
    <td style="background:#000;padding:32px 40px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td><span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Service<span style="color:#a3a3a3;">Market</span></span></td>
        <td align="right">
          <span style="display:inline-block;background:#059669;color:#fff;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:5px 14px;border-radius:100px;">✓ Approved</span>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- Hero section -->
  <tr>
    <td style="padding:48px 40px 0;text-align:center;">
      <div style="width:72px;height:72px;background:#ecfdf5;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;border:2px solid #a7f3d0;">
        <span style="font-size:36px;line-height:72px;display:block;">✅</span>
      </div>
      <h1 style="margin:0 0 10px;font-size:30px;font-weight:900;color:#09090b;letter-spacing:-0.5px;">Congratulations, ${providerName}!</h1>
      <p style="margin:0 0 32px;font-size:16px;color:#059669;font-weight:600;">Your application has been approved.</p>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:0 40px 40px;">
      <p style="margin:0 0 28px;font-size:15px;color:#52525b;line-height:1.7;text-align:center;">
        Your ServiceMarket provider profile is now <strong style="color:#09090b;">live and active</strong>. Customers in your area can now find and book your services.
      </p>

      <!-- What's next card -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 32px;">
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px 28px;">
            <p style="margin:0 0 16px;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;">What you can do now</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="padding:6px 0;">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:24px;"><span style="color:#059669;font-size:16px;font-weight:900;">✓</span></td>
                  <td style="font-size:14px;color:#1e293b;font-weight:500;padding-left:8px;">Receive job offers from customers nearby</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:6px 0;">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:24px;"><span style="color:#059669;font-size:16px;font-weight:900;">✓</span></td>
                  <td style="font-size:14px;color:#1e293b;font-weight:500;padding-left:8px;">Manage your availability and working hours</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:6px 0;">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:24px;"><span style="color:#059669;font-size:16px;font-weight:900;">✓</span></td>
                  <td style="font-size:14px;color:#1e293b;font-weight:500;padding-left:8px;">Build your rating by completing quality work</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:6px 0;">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:24px;"><span style="color:#059669;font-size:16px;font-weight:900;">✓</span></td>
                  <td style="font-size:14px;color:#1e293b;font-weight:500;padding-left:8px;">Get paid directly through the platform</td>
                </tr></table>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Pro tip -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 36px;">
        <tr>
          <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;">
            <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
              <strong>💡 Pro tip:</strong> Make sure your availability schedule is up to date so customers can book you at the right times.
            </p>
          </td>
        </tr>
      </table>

      <!-- CTA Button -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td align="center">
          <a href="http://localhost:3000/login" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:16px 40px;border-radius:8px;">
            Open ServiceMarket →
          </a>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td>
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#09090b;">ServiceMarket</p>
          <p style="margin:0;font-size:12px;color:#a1a1aa;">Professional Home Services Platform</p>
        </td>
        <td align="right" valign="middle">
          <p style="margin:0;font-size:11px;color:#d4d4d8;text-align:right;">Automated notification<br/>Do not reply to this email</p>
        </td>
      </tr></table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body></html>`;
    return { subject, html };
  }

  if (decision === "rejected") {
    const subject = "Application Update — ServiceMarket";
    const remarksBlock = remarks
      ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 28px;">
          <tr><td style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:18px 20px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#dc2626;">Reason from Admin</p>
            <p style="margin:0;font-size:14px;color:#7f1d1d;line-height:1.5;">${remarks}</p>
          </td></tr>
        </table>`
      : "";

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.08);">

  <tr><td style="background:#dc2626;height:4px;"></td></tr>

  <tr>
    <td style="background:#000;padding:32px 40px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td><span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Service<span style="color:#a3a3a3;">Market</span></span></td>
        <td align="right">
          <span style="display:inline-block;background:#dc2626;color:#fff;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:5px 14px;border-radius:100px;">Application Update</span>
        </td>
      </tr></table>
    </td>
  </tr>

  <tr>
    <td style="padding:48px 40px 40px;">
      <h1 style="margin:0 0 12px;font-size:26px;font-weight:900;color:#09090b;letter-spacing:-0.5px;">Hi ${providerName},</h1>
      <p style="margin:0 0 28px;font-size:15px;color:#52525b;line-height:1.7;">
        Thank you for applying to join ServiceMarket as a service provider. After carefully reviewing your application, we're <strong style="color:#09090b;">unable to approve it at this time</strong>.
      </p>

      ${remarksBlock}

      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 32px;">
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px 28px;">
            <p style="margin:0 0 14px;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;">Common reasons for rejection</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="padding:5px 0;font-size:13px;color:#475569;">· Missing or unclear KYC documents (Aadhaar, PAN, Selfie)</td></tr>
              <tr><td style="padding:5px 0;font-size:13px;color:#475569;">· Incomplete profile information</td></tr>
              <tr><td style="padding:5px 0;font-size:13px;color:#475569;">· Services listed don't match experience provided</td></tr>
              <tr><td style="padding:5px 0;font-size:13px;color:#475569;">· Missing or incomplete agreement acceptance</td></tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 36px;font-size:14px;color:#71717a;line-height:1.6;">
        You are welcome to <strong style="color:#09090b;">reapply</strong> after addressing the issues above. Please ensure all required documents are clearly uploaded and your profile is complete.
      </p>

      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td align="center">
          <a href="http://localhost:3000/login" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:14px 36px;border-radius:8px;">
            Update My Application →
          </a>
        </td>
      </tr></table>
    </td>
  </tr>

  <tr>
    <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td>
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#09090b;">ServiceMarket</p>
          <p style="margin:0;font-size:12px;color:#a1a1aa;">Professional Home Services Platform</p>
        </td>
        <td align="right" valign="middle">
          <p style="margin:0;font-size:11px;color:#d4d4d8;text-align:right;">Automated notification<br/>Do not reply to this email</p>
        </td>
      </tr></table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body></html>`;
    return { subject, html };
  }

  if (decision === "suspended") {
    const subject = "Account Suspended — ServiceMarket";
    const remarksBlock = remarks
      ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 28px;">
          <tr><td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:18px 20px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#c2410c;">Reason</p>
            <p style="margin:0;font-size:14px;color:#7c2d12;line-height:1.5;">${remarks}</p>
          </td></tr>
        </table>`
      : "";

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.08);">

  <tr><td style="background:#f97316;height:4px;"></td></tr>

  <tr>
    <td style="background:#000;padding:32px 40px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td><span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Service<span style="color:#a3a3a3;">Market</span></span></td>
        <td align="right">
          <span style="display:inline-block;background:#f97316;color:#fff;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:5px 14px;border-radius:100px;">⚠ Suspended</span>
        </td>
      </tr></table>
    </td>
  </tr>

  <tr>
    <td style="padding:48px 40px 40px;">
      <h1 style="margin:0 0 12px;font-size:26px;font-weight:900;color:#09090b;letter-spacing:-0.5px;">Account Suspended</h1>
      <p style="margin:0 0 28px;font-size:15px;color:#52525b;line-height:1.7;">
        Hi <strong>${providerName}</strong>, your ServiceMarket provider account has been <strong style="color:#09090b;">temporarily suspended</strong>. You will not receive new job offers during this period.
      </p>
      ${remarksBlock}
      <p style="margin:0 0 36px;font-size:14px;color:#71717a;line-height:1.6;">
        Please contact our support team to understand the next steps and resolve any outstanding issues.
      </p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td align="center">
          <a href="http://localhost:3000/login" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:14px 36px;border-radius:8px;">
            Contact Support →
          </a>
        </td>
      </tr></table>
    </td>
  </tr>

  <tr>
    <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td>
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#09090b;">ServiceMarket</p>
          <p style="margin:0;font-size:12px;color:#a1a1aa;">Professional Home Services Platform</p>
        </td>
        <td align="right" valign="middle">
          <p style="margin:0;font-size:11px;color:#d4d4d8;text-align:right;">Automated notification<br/>Do not reply to this email</p>
        </td>
      </tr></table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body></html>`;
    return { subject, html };
  }

  return null;
}

async function sendProviderDecisionEmail(to, providerName, decision, remarks) {
  const result = buildDecisionEmail(providerName, decision, remarks);
  if (!result) return;
  await transporter.sendMail({
    from: `"ServiceMarket" <${process.env.SMTP_FROM}>`,
    to,
    subject: result.subject,
    html: result.html,
  });
}

// ─── Booking notification emails ─────────────────────────────────────────────

function emailShell(accentColor, badgeLabel, bodyHtml) {
  return `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:${accentColor};height:4px;"></td></tr>
  <tr>
    <td style="background:#000;padding:28px 40px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td><span style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Service<span style="color:#a3a3a3;">Market</span></span></td>
        <td align="right"><span style="display:inline-block;background:${accentColor};color:#fff;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:100px;">${badgeLabel}</span></td>
      </tr></table>
    </td>
  </tr>
  <tr><td style="padding:36px 40px 32px;">${bodyHtml}</td></tr>
  <tr>
    <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td><p style="margin:0;font-size:12px;font-weight:700;color:#09090b;">ServiceMarket</p><p style="margin:0;font-size:11px;color:#a1a1aa;">Professional Home Services</p></td>
        <td align="right"><p style="margin:0;font-size:11px;color:#d4d4d8;text-align:right;">Automated notification.<br/>Do not reply.</p></td>
      </tr></table>
    </td>
  </tr>
</table>
<p style="margin:16px 0 0;font-size:11px;color:#a1a1aa;text-align:center;">© ${new Date().getFullYear()} ServiceMarket</p>
</td></tr></table>
</body></html>`;
}

function bookingInfoBlock(b) {
  const date = new Date(b.scheduledDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const slot = b.scheduledTimeSlot || "";
  const rows = [
    ["Booking No.",  b.bookingNumber || "—"],
    ["Service",      b.serviceName],
    ["Date",         date + (slot ? " · " + slot : "")],
    ["Address",      `${b.address?.text || ""}, ${b.address?.city || ""}`],
    ["Payment",      b.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : "Online"],
    ["Total",        `₹${(b.pricing?.totalAmount || 0).toLocaleString("en-IN")}`],
  ];
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:24px 0;">
    ${rows.map((r, i) => `<tr style="${i > 0 ? "border-top:1px solid #e2e8f0;" : ""}">
      <td style="padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;width:38%;">${r[0]}</td>
      <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1e293b;">${r[1]}</td>
    </tr>`).join("")}
  </table>`;
}

// Booking confirmed → customer
async function sendBookingConfirmedEmail(to, name, booking) {
  const body = `
    <h2 style="margin:0 0 6px;font-size:24px;font-weight:900;color:#09090b;">Booking Confirmed!</h2>
    <p style="margin:0 0 4px;font-size:15px;color:#52525b;">Hi <strong>${name}</strong>, your booking has been received.</p>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">We're finding the best available technician for you. You'll receive an update when a provider is confirmed.</p>
    ${bookingInfoBlock(booking)}
    <p style="margin:0 0 8px;font-size:13px;color:#52525b;font-weight:600;">Your verification OTP</p>
    <p style="margin:0 0 24px;font-size:13px;color:#71717a;">Share the 4-digit OTP on your booking details page with the technician when they arrive to start the job.</p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td align="center">
        <a href="http://localhost:3000/bookings/${booking._id}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:14px 32px;border-radius:8px;">View Booking →</a>
      </td>
    </tr></table>`;

  await transporter.sendMail({
    from: `"ServiceMarket" <${process.env.SMTP_FROM}>`,
    to,
    subject: `Booking Confirmed — ${booking.serviceName} | ServiceMarket`,
    html: emailShell("#000000", "Booking Confirmed", body),
  });
}

// New job assigned → provider
async function sendNewJobEmail(to, providerName, booking, customerName = "") {
  const date = new Date(booking.scheduledDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const customerLine = customerName ? `<p style="margin:0 0 4px;font-size:13px;color:#64748b;">Customer: <strong style="color:#1e293b;">${customerName}</strong></p>` : "";
  const body = `
    <h2 style="margin:0 0 6px;font-size:24px;font-weight:900;color:#09090b;">New Job Assigned</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#52525b;">Hi <strong>${providerName}</strong>, you have a new job request. Please accept or reject it promptly.</p>
    ${customerLine}
    ${bookingInfoBlock(booking)}
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
      <tr><td><p style="margin:0;font-size:13px;color:#92400e;"><strong>⚡ Action required:</strong> Log in to your dashboard to accept this job. If you don't respond in time, it will be reassigned.</p></td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td align="center">
        <a href="http://localhost:3000/dashboard/provider/orders" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:14px 32px;border-radius:8px;">View in Dashboard →</a>
      </td>
    </tr></table>`;

  await transporter.sendMail({
    from: `"ServiceMarket" <${process.env.SMTP_FROM}>`,
    to,
    subject: `New Job: ${booking.serviceName} on ${date} | ServiceMarket`,
    html: emailShell("#f59e0b", "New Job", body),
  });
}

// Provider accepted → customer
async function sendJobAcceptedEmail(to, customerName, booking, providerName) {
  const body = `
    <h2 style="margin:0 0 6px;font-size:24px;font-weight:900;color:#09090b;">Provider Confirmed! ✓</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;">Hi <strong>${customerName}</strong>, <strong>${providerName}</strong> has confirmed your booking and will be there on schedule.</p>
    ${bookingInfoBlock(booking)}
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
      <tr><td><p style="margin:0;font-size:13px;color:#065f46;"><strong>🔑 Remember:</strong> Share your OTP (shown on the booking page) with the technician when they arrive — this starts the job.</p></td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td align="center">
        <a href="http://localhost:3000/bookings/${booking._id}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:14px 32px;border-radius:8px;">View Booking & OTP →</a>
      </td>
    </tr></table>`;

  await transporter.sendMail({
    from: `"ServiceMarket" <${process.env.SMTP_FROM}>`,
    to,
    subject: `${providerName} is confirmed for your booking | ServiceMarket`,
    html: emailShell("#059669", "Provider Confirmed", body),
  });
}

// Job completed -> customer receipt with PDF invoice
async function sendJobCompletedEmail(to, customerName, booking, providerInfo = {}) {
  const total = booking.pricing?.totalAmount || 0;
  const invoicePdf = await generateInvoicePdf({
    booking,
    customerName,
    providerName: providerInfo.providerName,
    providerPhone: providerInfo.providerPhone,
  });
  const body = `
    <h2 style="margin:0 0 6px;font-size:24px;font-weight:900;color:#09090b;">Invoice Ready</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;">Hi <strong>${customerName}</strong>, your <strong>${booking.serviceName}</strong> service is complete. Your PDF invoice is attached for your records, and the printable invoice is also available in your booking page.</p>
    ${bookingInfoBlock(booking)}
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:0 0 24px;">
      <tr>
        <td style="background:#09090b;color:#fff;padding:18px 22px;">
          <p style="margin:0;font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#a1a1aa;">Invoice Summary</p>
          <p style="margin:6px 0 0;font-size:22px;font-weight:900;">₹${total.toLocaleString("en-IN")}</p>
        </td>
      </tr>
      <tr><td style="padding:16px 22px;background:#fff;">
        <p style="margin:0 0 6px;font-size:13px;color:#52525b;">Invoice No: <strong style="color:#09090b;">${booking.bookingNumber}</strong></p>
        <p style="margin:0;font-size:13px;color:#52525b;">Payment: <strong style="color:#09090b;">${booking.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : "Online"}</strong></p>
      </td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
      <tr><td><p style="margin:0;font-size:13px;color:#065f46;"><strong>Record saved:</strong> Keep the invoice for payment proof, service history, and any future query with the same provider.</p></td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td align="center">
        <a href="http://localhost:3000/bookings/${booking._id}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:14px 32px;border-radius:8px;">View Invoice</a>
      </td>
    </tr></table>`;

  await transporter.sendMail({
    from: `"ServiceMarket" <${process.env.SMTP_FROM}>`,
    to,
    subject: `Invoice Ready — ${booking.bookingNumber} | ServiceMarket`,
    html: emailShell("#059669", "Invoice Ready", body),
    attachments: [
      {
        filename: `ServiceMarket-Invoice-${booking.bookingNumber || booking._id}.pdf`,
        content: invoicePdf,
        contentType: "application/pdf",
      },
    ],
  });
}

module.exports = {
  sendOTPEmail,
  sendProviderDecisionEmail,
  sendBookingConfirmedEmail,
  sendNewJobEmail,
  sendJobAcceptedEmail,
  sendJobCompletedEmail,
};
