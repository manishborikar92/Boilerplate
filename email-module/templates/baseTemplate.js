/**
 * Base Email Template
 *
 * Responsive HTML email wrapper used by all notification templates.
 * Customize branding by editing the constants below.
 *
 * @module templates/baseTemplate
 */

// ─── Branding (edit these to match your project) ─────────────────────────────
const BRAND = {
    name: 'MyApp',
    tagline: 'Professional Services',
    primaryColor: '#1e3a8a',
    footerText: 'This is an automated notification. You are receiving this because you have notifications enabled.',
};

const baseStyles = `
  <style>
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .wrapper { padding: 10px !important; }
      .container { width: 100% !important; }
      .mobile-padding { padding: 24px 20px !important; }
      .mobile-font-xl { font-size: 26px !important; }
      .mobile-font-lg { font-size: 20px !important; }
      .mobile-font-md { font-size: 15px !important; }
      .mobile-hide { display: none !important; }
      .mobile-show { display: block !important; }
      .mobile-center { text-align: center !important; }
      .mobile-full { width: 100% !important; display: block !important; }
    }
  </style>
`;

/**
 * Wrap content in a branded, responsive email layout.
 *
 * @param {Object} options
 * @param {string} options.title       - Email heading
 * @param {string} options.content     - Inner HTML body
 * @param {string} [options.actionUrl] - CTA button URL
 * @param {string} [options.actionLabel] - CTA button label
 * @param {string} [options.priority]  - 'urgent' | 'high' | 'normal' | 'low'
 * @param {Object} [options.brand]     - Override default BRAND values
 * @returns {string} Full HTML email document
 */
const baseTemplate = ({ title, content, actionUrl, actionLabel, priority, brand }) => {
    const b = { ...BRAND, ...brand };

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${baseStyles}
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f5;">
      <tr>
        <td class="wrapper" style="padding:20px 10px;">
          <table role="presentation" class="container" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #ddd;">
            <tr>
              <td class="mobile-padding" style="padding:32px 40px;border-bottom:3px solid ${b.primaryColor};background:#fff;">
                <h1 class="mobile-font-xl" style="margin:0;color:${b.primaryColor};font-size:32px;font-weight:700;">${b.name}</h1>
                <p style="margin:4px 0 0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">${b.tagline}</p>
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" style="padding:40px;">
                <h2 class="mobile-font-lg" style="margin:0 0 20px;color:#1e293b;font-size:22px;font-weight:600;border-bottom:2px solid #e2e8f0;padding-bottom:14px;">${title}</h2>
                <div class="mobile-font-md" style="font-size:15px;line-height:1.7;color:#334155;">${content}</div>
                ${actionUrl && actionLabel ? `
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;">
                  <tr>
                    <td style="background:${b.primaryColor};border-radius:4px;text-align:center;">
                      <a href="${actionUrl}" style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;text-transform:uppercase;">${actionLabel}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0;color:#64748b;font-size:12px;line-height:1.5;">Or visit: <a href="${actionUrl}" style="color:${b.primaryColor};word-break:break-all;">${actionUrl}</a></p>
                ` : ''}
              </td>
            </tr>
            <tr>
              <td class="mobile-padding" style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 12px;color:#64748b;font-size:12px;line-height:1.6;">${b.footerText}</p>
                <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} ${b.name}. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
};

module.exports = { baseTemplate, BRAND };
