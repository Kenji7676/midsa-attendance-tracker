import QRCode from 'qrcode';
import { Scholar } from '../types';
import { getAccessToken, getCurrentUser } from './googleAuth';
import { formatScholarName, personalizeEmailTemplate } from '../utils/formatters';

export interface SendEmailOptions {
  scholar: Scholar;
  subject: string;
  body: string;
  senderName?: string;
  senderEmail?: string;
}

export interface SendResult {
  scholarId: string;
  studentId: string;
  email: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Generates a PNG data URL for the scholar's unique QR code token.
 */
export async function generateQrPngDataUrl(qrToken: string): Promise<string> {
  return await QRCode.toDataURL(qrToken, {
    width: 320,
    margin: 2,
    color: {
      dark: '#004ACD',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });
}

/**
 * Encodes a string into Base64URL (RFC 4648 § 5) format required by Gmail API.
 */
function encodeBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Encodes a header value (e.g. Subject, From) using RFC 2047 MIME encoded-word syntax for full UTF-8 safety.
 */
function encodeMimeWord(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?utf-8?B?${btoa(binary)}?=`;
}

/**
 * Generates a styled, branded HTML email message for the scholar attendance pass.
 */
function buildHtmlBody(scholar: Scholar, customBodyText: string): string {
  // Convert newlines in custom text to HTML paragraphs / breaks
  const formattedCustomText = customBodyText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin: 0 0 12px 0; line-height: 1.6; color: #334155; font-size: 14px;">${p}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MIDSA Official Digital Attendance Pass</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 74, 205, 0.08); border: 1px solid #e2e8f0;">
    <!-- Association Banner Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #004ACD 0%, #0165CB 100%); padding: 32px 28px; text-align: center; color: #ffffff;">
        <div style="display: inline-block; background-color: #ffffff; border-radius: 12px; padding: 6px 12px; margin-bottom: 12px;">
          <span style="color: #004ACD; font-weight: 900; font-size: 18px; letter-spacing: 1px;">MIDSA</span>
        </div>
        <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">MSU-IIT DOST-SEI Scholars' Association</h1>
        <p style="margin: 0; font-size: 12px; color: #00F7FF; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Official Digital Attendance Pass</p>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td style="padding: 28px 28px 16px 28px;">
        <div style="background-color: #f8fafc; border-left: 4px solid #004ACD; padding: 14px 16px; border-radius: 6px; margin-bottom: 24px;">
          <span style="font-size: 11px; font-weight: 700; color: #004ACD; text-transform: uppercase; letter-spacing: 0.5px;">Recipient</span>
          <h2 style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #0f172a;">${formatScholarName(scholar)}</h2>
          <p style="margin: 2px 0 0 0; font-size: 13px; color: #64748b; font-family: monospace;">Student ID: ${scholar.student_id}</p>
        </div>

        <!-- Custom message from organizer -->
        <div style="margin-bottom: 24px;">
          ${formattedCustomText}
        </div>

        <!-- Digital Pass Card Box -->
        <div style="background: linear-gradient(180deg, #004ACD 0%, #0165CB 100%); border-radius: 14px; padding: 24px; text-align: center; color: #ffffff; border: 2px solid #00F7FF; margin-bottom: 24px;">
          <div style="background-color: #ffffff; border-radius: 12px; padding: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin-bottom: 14px;">
            <!-- Embedded inline QR image via CID -->
            <img src="cid:midsa_qr_pass" alt="Attendance QR Code" width="190" height="190" style="display: block; margin: 0 auto; border: 0;" />
          </div>

          <div style="background-color: rgba(0, 0, 0, 0.25); border-radius: 20px; display: inline-block; padding: 4px 14px; margin-bottom: 12px;">
            <code style="color: #00F7FF; font-size: 12px; font-weight: 700; letter-spacing: 1px; font-family: monospace;">${scholar.qr_code}</code>
          </div>

          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 10px; font-size: 12px; text-align: left; background-color: rgba(0, 0, 0, 0.2); border-radius: 8px; padding: 10px;">
            <tr>
              <td style="color: #bfdbfe; padding: 3px 6px; width: 80px;">Program:</td>
              <td style="color: #ffffff; font-weight: 600; padding: 3px 6px;">${scholar.year_program}</td>
            </tr>
            <tr>
              <td style="color: #bfdbfe; padding: 3px 6px;">College:</td>
              <td style="color: #ffffff; font-weight: 600; padding: 3px 6px;">${scholar.college}</td>
            </tr>
          </table>
        </div>

        <!-- Instructions Box -->
        <div style="background-color: #eff6ff; border: 1px dashed #0165CB; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #004ACD;">How to use your pass:</h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 12px; color: #334155; line-height: 1.6;">
            <li>Keep this email accessible on your smartphone or save the attached pass image.</li>
            <li>Present the QR code at the check-in camera terminal upon entering MIDSA events.</li>
            <li>The system will register your attendance instantly.</li>
          </ol>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 28px; text-align: center;">
        <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.5;">
          This official attendance pass was generated for <strong>${formatScholarName(scholar)}</strong> by the MSU-IIT DOST-SEI Scholars' Association (MIDSA).<br/>
          Please do not share your individual QR code with other students.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Constructs an RFC 2822 MIME message string containing HTML and an embedded PNG attachment.
 */
async function buildMimeMessage(options: SendEmailOptions): Promise<string> {
  const { scholar, subject, body, senderName = 'MIDSA Attendance Office', senderEmail } = options;

  // Generate QR Code PNG Base64 data
  const qrDataUrl = await generateQrPngDataUrl(scholar.qr_code);
  const qrBase64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');

  const boundary = `boundary_midsa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const fromHeader = senderEmail ? `"${encodeMimeWord(senderName)}" <${senderEmail}>` : encodeMimeWord(senderName);
  const toHeader = `"${encodeMimeWord(formatScholarName(scholar))}" <${scholar.email}>`;
  const subjectHeader = encodeMimeWord(subject);

  const htmlContent = buildHtmlBody(scholar, body);

  const mimeParts = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${subjectHeader}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/related; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    '',
    htmlContent,
    '',
    `--${boundary}`,
    `Content-Type: image/png; name="midsa-pass-${scholar.student_id}.png"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: inline; filename="midsa-pass-${scholar.student_id}.png"`,
    `Content-ID: <midsa_qr_pass>`,
    '',
    qrBase64Data,
    '',
    `--${boundary}--`,
  ];

  return mimeParts.join('\r\n');
}

/**
 * Sends a single email pass to a scholar using the authenticated user's Gmail account.
 */
export async function sendScholarEmailPass(options: SendEmailOptions): Promise<SendResult> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('You are not signed in with Google. Please connect your Google account first to send emails.');
  }

  const user = getCurrentUser();
  const effectiveSenderEmail = options.senderEmail || user?.email || undefined;
  const effectiveSenderName = options.senderName || user?.displayName || 'MIDSA Attendance Office';

  try {
    const rawMime = await buildMimeMessage({
      ...options,
      senderName: effectiveSenderName,
      senderEmail: effectiveSenderEmail,
    });

    const base64UrlMessage = encodeBase64Url(rawMime);

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: base64UrlMessage,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      const errMsg = errJson?.error?.message || `Gmail API Error (${response.status})`;
      throw new Error(errMsg);
    }

    const data = await response.json();
    return {
      scholarId: options.scholar.id,
      studentId: options.scholar.student_id,
      email: options.scholar.email,
      success: true,
      messageId: data.id,
    };
  } catch (error: any) {
    return {
      scholarId: options.scholar.id,
      studentId: options.scholar.student_id,
      email: options.scholar.email,
      success: false,
      error: error.message || 'Unknown sending failure',
    };
  }
}

/**
 * Dispatches emails to multiple scholars with rate limiting and progress updates.
 */
export async function sendBatchScholarEmailPasses(
  scholars: Scholar[],
  template: { subject: string; body: string; senderName?: string },
  onProgress?: (current: number, total: number, lastResult: SendResult) => void
): Promise<SendResult[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in with Google to send real emails.');
  }

  const user = getCurrentUser();
  const results: SendResult[] = [];

  for (let i = 0; i < scholars.length; i++) {
    const scholar = scholars[i];

    // Personalize subject and body variables using comprehensive token engine
    const personalizedSubject = personalizeEmailTemplate(template.subject, scholar);
    const personalizedBody = personalizeEmailTemplate(template.body, scholar);

    const result = await sendScholarEmailPass({
      scholar,
      subject: personalizedSubject,
      body: personalizedBody,
      senderName: template.senderName,
      senderEmail: user?.email || undefined,
    });

    results.push(result);
    if (onProgress) {
      onProgress(i + 1, scholars.length, result);
    }

    // Gentle pacing between emails (250ms) to respect Gmail API quotas
    if (i < scholars.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return results;
}
