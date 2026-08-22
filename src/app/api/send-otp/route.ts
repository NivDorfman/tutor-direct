import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const { email, code, name, type = 'otp' } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'no-reply@tutordirect.com';

    // If SMTP credentials exist, use them
    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort) || 587,
        secure: Number(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      let mailOptions: any;

      if (type === 'password_changed') {
        mailOptions = {
          from: `"TutorDirect" <${smtpFrom}>`,
          to: email,
          subject: `הסיסמה שלך ב-TutorDirect עודכנה בהצלחה`,
          html: `
            <div style="direction: rtl; text-align: right; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <h2 style="color: #4f46e5; margin-bottom: 16px; font-size: 22px;">TutorDirect - עדכון סיסמה</h2>
              <p style="font-size: 15px; color: #334155; line-height: 1.6;">שלום <strong>${name || 'משתמש יקר'}</strong>,</p>
              <p style="font-size: 15px; color: #334155; line-height: 1.6;">הסיסמה לחשבונך באתר <strong>TutorDirect</strong> שונתה ועודכנה בהצלחה.</p>
              <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; border: 1px solid #bbf7d0; margin: 20px 0; color: #166534; font-size: 14px;">
                ✓ הסיסמה החדשה נשמרה בבטחה. כעת באפשרותך להתחבר עם הסיסמה החדשה.
              </div>
              <p style="font-size: 13px; color: #64748b;">אם לא ביצעת שינוי זה, אנא פנה לתמיכה באופן מיידי כדי לאבטח את חשבונך.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">הודעה אוטומטית ממערכת TutorDirect</p>
            </div>
          `,
        };
      } else {
        mailOptions = {
          from: `"TutorDirect" <${smtpFrom}>`,
          to: email,
          subject: `קוד אימות לשינוי סיסמה - TutorDirect`,
          html: `
            <div style="direction: rtl; text-align: right; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <h2 style="color: #4f46e5; margin-bottom: 16px; font-size: 22px;">TutorDirect - אימות שינוי סיסמה</h2>
              <p style="font-size: 15px; color: #334155; line-height: 1.6;">שלום <strong>${name || 'משתמש יקר'}</strong>,</p>
              <p style="font-size: 15px; color: #334155; line-height: 1.6;">התקבלה בקשה לשינוי הסיסמה בחשבונך. קוד האימות החד-פעמי שלך הוא:</p>
              <div style="background-color: #f8fafc; padding: 18px; text-align: center; font-size: 28px; font-weight: 800; letter-spacing: 6px; margin: 24px 0; border-radius: 8px; border: 1px solid #cbd5e1; color: #4f46e5; font-family: monospace;">
                ${code}
              </div>
              <p style="font-size: 13px; color: #475569; line-height: 1.5;">קוד זה בתוקף ל-10 דקות. אם לא ביקשת לשנות סיסמה, ניתן להתעלם מהודעה זו.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">הודעה אוטומטית ממערכת TutorDirect</p>
            </div>
          `,
        };
      }

      await transporter.sendMail(mailOptions);
      return NextResponse.json({ success: true, smtpConfigured: true });
    }

    // If SMTP is not yet configured, log clearly and return success with informative status
    console.log(`[Email Dispatcher] To: ${email} | Type: ${type} | Code: ${code || 'N/A'}`);
    return NextResponse.json({
      success: true,
      smtpConfigured: false,
      message: "Email dispatch processed. Note: To deliver to real external inboxes, configure SMTP credentials in environment settings."
    });

  } catch (error: any) {
    console.error("Error sending email:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

