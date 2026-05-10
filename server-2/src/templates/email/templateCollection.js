/**
 * CA-Flow Email Templates Library
 * Modern, responsive email templates optimized for all email clients
 * @version 2.0.0
 */

/**
 * @typedef {Object} TemplateConfig
 * @property {string} title - Email subject/heading
 * @property {string} content - HTML content body
 * @property {string} [actionUrl] - Optional CTA button URL
 * @property {string} [actionLabel] - Optional CTA button text
 */

// ============================================================================
// BASE STYLES & UTILITIES
// ============================================================================

class EmailStyles {
  static get base() {
    return `
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
  }

  static get currentYear() {
    return new Date().getFullYear();
  }
}

// ============================================================================
// TEMPLATE BUILDER UTILITIES
// ============================================================================

class TemplateBuilder {
  /**
   * Creates HTML document structure
   * @param {string} title - Document title
   * @param {string} body - Body content
   * @returns {string} Complete HTML document
   */
  static createDocument(title, body) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${EmailStyles.base}
</head>
${body}
</html>`;
  }

  /**
   * Creates CTA button HTML
   * @param {string} url - Button link URL
   * @param {string} label - Button text
   * @param {Object} styles - Custom button styles
   * @returns {string} Button HTML or empty string
   */
  static createButton(url, label, styles = {}) {
    if (!url || !label) return '';

    const defaultStyles = {
      background: '#2563eb',
      borderRadius: '6px',
      padding: '14px 32px',
      color: '#fff',
      fontSize: '15px',
      fontWeight: '600',
      ...styles
    };

    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;">
        <tr>
          <td style="background:${defaultStyles.background};border-radius:${defaultStyles.borderRadius};">
            <a href="${url}" style="display:inline-block;padding:${defaultStyles.padding};color:${defaultStyles.color};text-decoration:none;font-size:${defaultStyles.fontSize};font-weight:${defaultStyles.fontWeight};">${label}</a>
          </td>
        </tr>
      </table>
    `;
  }

  /**
   * Creates footer copyright text
   * @param {string} [additionalText] - Optional additional footer text
   * @returns {string} Footer HTML
   */
  static createFooter(additionalText = '') {
    const copyrightText = `© ${EmailStyles.currentYear} CA-Flow. All rights reserved.`;
    return additionalText ? `${additionalText}<br>${copyrightText}` : copyrightText;
  }
}

// ============================================================================
// EMAIL TEMPLATE CLASSES
// ============================================================================

class EmailTemplate {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  /**
   * Generates the email HTML
   * @param {TemplateConfig} config - Template configuration
   * @returns {string} Complete email HTML
   */
  render(config) {
    throw new Error('render() must be implemented by subclass');
  }
}

// ----------------------------------------------------------------------------
// Template 1: Classic Professional
// ----------------------------------------------------------------------------
class ClassicProfessional extends EmailTemplate {
  constructor() {
    super('Classic Professional', 'Traditional corporate design with navy blue accents');
  }

  render({ title, content, actionUrl, actionLabel }) {
    const body = `
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f5;">
    <tr>
      <td class="wrapper" style="padding:20px 10px;">
        <table role="presentation" class="container" width="640" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #ddd;">
          <tr>
            <td class="mobile-padding" style="padding:32px 40px;border-bottom:3px solid #1e3a8a;background:#fff;">
              <h1 class="mobile-font-xl" style="margin:0;color:#1e3a8a;font-size:32px;font-weight:700;">CA-Flow</h1>
              <p style="margin:4px 0 0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Chartered Accountant Services</p>
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:40px;">
              <h2 class="mobile-font-lg" style="margin:0 0 20px;color:#1e293b;font-size:22px;font-weight:600;border-bottom:2px solid #e2e8f0;padding-bottom:14px;">${title}</h2>
              <div class="mobile-font-md" style="font-size:15px;line-height:1.7;color:#334155;">${content}</div>
              ${TemplateBuilder.createButton(actionUrl, actionLabel, { background: '#1e3a8a', borderRadius: '4px' })}
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 12px;color:#64748b;font-size:12px;line-height:1.6;">${TemplateBuilder.createFooter()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`;

    return TemplateBuilder.createDocument(title, body);
  }
}

// ----------------------------------------------------------------------------
// Template 2: Modern Gradient
// ----------------------------------------------------------------------------
class ModernGradient extends EmailTemplate {
  constructor() {
    super('Modern Gradient', 'Contemporary design with blue gradient header');
  }

  render({ title, content, actionUrl, actionLabel }) {
    const body = `
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0f4f8;">
    <tr>
      <td class="wrapper" style="padding:20px 10px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:32px 40px;background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);">
              <h1 class="mobile-font-xl" style="margin:0;color:#fff;font-size:28px;font-weight:700;">CA-Flow</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.9);font-size:13px;">Professional Document Management</p>
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:40px;">
              <h2 class="mobile-font-lg" style="margin:0 0 20px;color:#0f172a;font-size:24px;font-weight:700;">${title}</h2>
              <div class="mobile-font-md" style="font-size:15px;line-height:1.7;color:#475569;">${content}</div>
              ${TemplateBuilder.createButton(actionUrl, actionLabel, {
                background: 'linear-gradient(135deg,#2563eb 0%,#1e40af 100%)',
                borderRadius: '8px',
                fontSize: '16px',
                padding: '16px 40px'
              })}
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">${TemplateBuilder.createFooter()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`;

    return TemplateBuilder.createDocument(title, body);
  }
}

// ----------------------------------------------------------------------------
// Template 3: Minimal Clean
// ----------------------------------------------------------------------------
class MinimalClean extends EmailTemplate {
  constructor() {
    super('Minimal Clean', 'Ultra-clean design with maximum white space');
  }

  render({ title, content, actionUrl, actionLabel }) {
    const body = `
<body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td class="wrapper" style="padding:60px 20px;">
        <table role="presentation" class="container" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;margin:0 auto;">
          <tr>
            <td style="padding-bottom:48px;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:600;letter-spacing:-0.5px;">CA-Flow</h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;">
              <h2 class="mobile-font-lg" style="margin:0;color:#000;font-size:28px;font-weight:600;line-height:1.3;letter-spacing:-0.5px;">${title}</h2>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:32px;">
              <div class="mobile-font-md" style="font-size:16px;line-height:1.7;color:#374151;">${content}</div>
            </td>
          </tr>
          ${actionUrl ? `<tr><td style="padding-bottom:48px;">${TemplateBuilder.createButton(actionUrl, actionLabel, { background: '#000', borderRadius: '8px', padding: '16px 32px', fontSize: '15px', fontWeight: '500' })}</td></tr>` : ''}
          <tr>
            <td style="padding:32px 0;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">${TemplateBuilder.createFooter()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`;

    return TemplateBuilder.createDocument(title, body);
  }
}

// ----------------------------------------------------------------------------
// Template 4: Bordered Card
// ----------------------------------------------------------------------------
class BorderedCard extends EmailTemplate {
  constructor() {
    super('Bordered Card', 'Card-style design with subtle borders');
  }

  render({ title, content, actionUrl, actionLabel }) {
    const body = `
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',Tahoma,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f9fafb;">
    <tr>
      <td class="wrapper" style="padding:40px 20px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background:#fff;border:2px solid #e5e7eb;border-radius:8px;">
          <tr>
            <td class="mobile-padding" style="padding:40px;border-bottom:1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width:60px;vertical-align:middle;">
                    <div style="width:48px;height:48px;background:#2563eb;border-radius:8px;"></div>
                  </td>
                  <td style="vertical-align:middle;">
                    <h1 class="mobile-font-xl" style="margin:0;color:#111827;font-size:24px;font-weight:700;">CA-Flow</h1>
                    <p style="margin:2px 0 0;color:#6b7280;font-size:12px;">Document Platform</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:40px;">
              <h2 class="mobile-font-lg" style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:600;">${title}</h2>
              <div class="mobile-font-md" style="font-size:15px;line-height:1.7;color:#4b5563;">${content}</div>
              ${TemplateBuilder.createButton(actionUrl, actionLabel)}
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">${TemplateBuilder.createFooter()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`;

    return TemplateBuilder.createDocument(title, body);
  }
}

// ----------------------------------------------------------------------------
// Template 5: Side Accent
// ----------------------------------------------------------------------------
class SideAccent extends EmailTemplate {
  constructor() {
    super('Side Accent', 'Design with colorful left border accent');
  }

  render({ title, content, actionUrl, actionLabel }) {
    const body = `
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;">
    <tr>
      <td class="wrapper" style="padding:40px 20px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background:#fff;border-left:6px solid #2563eb;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td class="mobile-padding" style="padding:40px;">
              <h1 class="mobile-font-xl" style="margin:0 0 8px;color:#2563eb;font-size:26px;font-weight:700;">CA-Flow</h1>
              <p style="margin:0 0 32px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Professional Services</p>
              <h2 class="mobile-font-lg" style="margin:0 0 20px;color:#111827;font-size:22px;font-weight:600;">${title}</h2>
              <div class="mobile-font-md" style="font-size:15px;line-height:1.7;color:#374151;">${content}</div>
              ${TemplateBuilder.createButton(actionUrl, actionLabel, { borderRadius: '4px' })}
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">${TemplateBuilder.createFooter()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`;

    return TemplateBuilder.createDocument(title, body);
  }
}

// ----------------------------------------------------------------------------
// Template 6: Dark Header
// ----------------------------------------------------------------------------
class DarkHeader extends EmailTemplate {
  constructor() {
    super('Dark Header', 'Bold design with dark header section');
  }

  render({ title, content, actionUrl, actionLabel }) {
    const body = `
<body style="margin:0;padding:0;background:#e5e7eb;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#e5e7eb;">
    <tr>
      <td class="wrapper" style="padding:40px 20px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background:#fff;">
          <tr>
            <td class="mobile-padding" style="padding:40px;background:#1f2937;text-align:center;">
              <h1 class="mobile-font-xl" style="margin:0;color:#fff;font-size:32px;font-weight:700;letter-spacing:-0.5px;">CA-Flow</h1>
              <p style="margin:8px 0 0;color:#d1d5db;font-size:13px;">Chartered Accountant Platform</p>
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:40px;">
              <h2 class="mobile-font-lg" style="margin:0 0 20px;color:#111827;font-size:24px;font-weight:600;">${title}</h2>
              <div class="mobile-font-md" style="font-size:15px;line-height:1.7;color:#374151;">${content}</div>
              ${TemplateBuilder.createButton(actionUrl, actionLabel, { background: '#1f2937' })}
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:24px 40px;background:#f9fafb;text-align:center;">
              <p style="margin:0;color:#6b7280;font-size:12px;">${TemplateBuilder.createFooter()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`;

    return TemplateBuilder.createDocument(title, body);
  }
}

// ----------------------------------------------------------------------------
// Template 7: Soft Rounded
// ----------------------------------------------------------------------------
class SoftRounded extends EmailTemplate {
  constructor() {
    super('Soft Rounded', 'Friendly design with rounded corners throughout');
  }

  render({ title, content, actionUrl, actionLabel }) {
    const body = `
<body style="margin:0;padding:0;background:#f0f9ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0f9ff;">
    <tr>
      <td class="wrapper" style="padding:40px 20px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
          <tr>
            <td class="mobile-padding" style="padding:40px;background:#eff6ff;border-radius:16px 16px 0 0;">
              <h1 class="mobile-font-xl" style="margin:0;color:#1e40af;font-size:28px;font-weight:700;">CA-Flow</h1>
              <p style="margin:6px 0 0;color:#60a5fa;font-size:13px;">Your Trusted CA Partner</p>
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:40px;">
              <h2 class="mobile-font-lg" style="margin:0 0 20px;color:#0f172a;font-size:22px;font-weight:600;">${title}</h2>
              <div class="mobile-font-md" style="font-size:15px;line-height:1.7;color:#475569;">${content}</div>
              ${TemplateBuilder.createButton(actionUrl, actionLabel, { background: '#3b82f6', borderRadius: '12px' })}
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:24px 40px;background:#f8fafc;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">${TemplateBuilder.createFooter()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`;

    return TemplateBuilder.createDocument(title, body);
  }
}

// ----------------------------------------------------------------------------
// Template 8: Two-Tone
// ----------------------------------------------------------------------------
class TwoTone extends EmailTemplate {
  constructor() {
    super('Two-Tone', 'Split design with contrasting sections');
  }

  render({ title, content, actionUrl, actionLabel }) {
    const body = `
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f5;">
    <tr>
      <td class="wrapper" style="padding:40px 20px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;">
          <tr>
            <td class="mobile-padding" style="padding:40px;background:#1e3a8a;">
              <h1 class="mobile-font-xl" style="margin:0 0 8px;color:#fff;font-size:28px;font-weight:700;">CA-Flow</h1>
              <p style="margin:0;color:#93c5fd;font-size:13px;">Professional Document Services</p>
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:40px;background:#fff;">
              <h2 class="mobile-font-lg" style="margin:0 0 20px;color:#1e3a8a;font-size:22px;font-weight:600;">${title}</h2>
              <div class="mobile-font-md" style="font-size:15px;line-height:1.7;color:#334155;">${content}</div>
              ${TemplateBuilder.createButton(actionUrl, actionLabel, { background: '#1e3a8a', borderRadius: '4px' })}
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:24px 40px;background:#f8fafc;text-align:center;">
              <p style="margin:0;color:#64748b;font-size:12px;">${TemplateBuilder.createFooter()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`;

    return TemplateBuilder.createDocument(title, body);
  }
}

// ----------------------------------------------------------------------------
// Template 9: Elegant Serif
// ----------------------------------------------------------------------------
class ElegantSerif extends EmailTemplate {
  constructor() {
    super('Elegant Serif', 'Sophisticated design with serif typography');
  }

  render({ title, content, actionUrl, actionLabel }) {
    const body = `
<body style="margin:0;padding:0;background:#fafaf9;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fafaf9;">
    <tr>
      <td class="wrapper" style="padding:40px 20px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;">
          <tr>
            <td class="mobile-padding" style="padding:40px;border-bottom:2px solid #78716c;">
              <h1 class="mobile-font-xl" style="margin:0;color:#292524;font-size:36px;font-weight:400;font-family:Georgia,serif;">CA-Flow</h1>
              <p style="margin:8px 0 0;color:#78716c;font-size:14px;font-family:Arial,sans-serif;font-style:italic;">Chartered Accountant Excellence</p>
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:40px;">
              <h2 class="mobile-font-lg" style="margin:0 0 24px;color:#1c1917;font-size:24px;font-weight:400;font-family:Georgia,serif;">${title}</h2>
              <div class="mobile-font-md" style="font-size:16px;line-height:1.8;color:#44403c;font-family:Arial,sans-serif;">${content}</div>
              ${TemplateBuilder.createButton(actionUrl, actionLabel, {
                background: '#292524',
                borderRadius: '2px',
                padding: '14px 36px',
                fontSize: '14px'
              })}
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:24px 40px;background:#fafaf9;border-top:1px solid #e7e5e4;text-align:center;">
              <p style="margin:0;color:#a8a29e;font-size:12px;font-family:Arial,sans-serif;">${TemplateBuilder.createFooter()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`;

    return TemplateBuilder.createDocument(title, body);
  }
}

// ----------------------------------------------------------------------------
// Template 10: Tech Modern
// ----------------------------------------------------------------------------
class TechModern extends EmailTemplate {
  constructor() {
    super('Tech Modern', 'Contemporary tech-inspired design');
  }

  render({ title, content, actionUrl, actionLabel }) {
    const body = `
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f172a;">
    <tr>
      <td class="wrapper" style="padding:40px 20px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:8px;">
          <tr>
            <td class="mobile-padding" style="padding:40px;border-bottom:1px solid #334155;">
              <h1 class="mobile-font-xl" style="margin:0;color:#fff;font-size:28px;font-weight:700;">CA-Flow</h1>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Next-Gen Document Platform</p>
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:40px;">
              <h2 class="mobile-font-lg" style="margin:0 0 20px;color:#f1f5f9;font-size:22px;font-weight:600;">${title}</h2>
              <div class="mobile-font-md" style="font-size:15px;line-height:1.7;color:#cbd5e1;">${content}</div>
              ${TemplateBuilder.createButton(actionUrl, actionLabel, { background: '#3b82f6' })}
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding:24px 40px;background:#0f172a;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;color:#64748b;font-size:12px;">${TemplateBuilder.createFooter()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`;

    return TemplateBuilder.createDocument(title, body);
  }
}

// ============================================================================
// TEMPLATE REGISTRY & FACTORY
// ============================================================================

class TemplateRegistry {
  static templates = {
    classicProfessional: new ClassicProfessional(),
    modernGradient: new ModernGradient(),
    minimalClean: new MinimalClean(),
    borderedCard: new BorderedCard(),
    sideAccent: new SideAccent(),
    darkHeader: new DarkHeader(),
    softRounded: new SoftRounded(),
    twoTone: new TwoTone(),
    elegantSerif: new ElegantSerif(),
    techModern: new TechModern()
  };

  /**
   * Get a template by name
   * @param {string} name - Template name (camelCase)
   * @returns {EmailTemplate|null} Template instance or null
   */
  static getTemplate(name) {
    return this.templates[name] || null;
  }

  /**
   * Get all available templates
   * @returns {Object} All templates
   */
  static getAllTemplates() {
    return this.templates;
  }

  /**
   * List all template names and descriptions
   * @returns {Array<{name: string, description: string}>}
   */
  static listTemplates() {
    return Object.entries(this.templates).map(([key, template]) => ({
      key,
      name: template.name,
      description: template.description
    }));
  }
}

// ============================================================================
// SAMPLE CONTENT GENERATOR
// ============================================================================

class SampleContentGenerator {
  static createSampleContent(recipientName = 'Manish') {
    return `
      <p style="margin:0 0 16px;">Hello <strong>${recipientName}</strong>,</p>
      <p style="margin:0 0 16px;">This is a sample email template for CA-Flow. Each template is fully responsive and optimized for all devices and email clients.</p>
      <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:16px;margin:20px 0;border-radius:4px;">
        <p style="margin:0 0 8px;font-weight:600;">Key Features:</p>
        <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;">
          <li>Mobile-responsive design</li>
          <li>Works on all email clients</li>
          <li>Professional appearance</li>
          <li>Easy to customize</li>
        </ul>
      </div>
      <p style="margin:0;">Choose the template that best represents your brand and we'll apply it to all CA-Flow notifications.</p>
    `;
  }

  /**
   * Generate sample email for a specific template
   * @param {string} templateName - Template name
   * @param {Object} customConfig - Custom configuration
   * @returns {string|null} Generated HTML or null
   */
  static generateSample(templateName, customConfig = {}) {
    const template = TemplateRegistry.getTemplate(templateName);
    if (!template) return null;

    const defaultConfig = {
      title: 'Welcome to CA-Flow',
      content: this.createSampleContent(),
      actionUrl: 'https://ca-flow.example.com/app/dashboard',
      actionLabel: 'View Dashboard'
    };

    return template.render({ ...defaultConfig, ...customConfig });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Core classes
  EmailTemplate,
  EmailStyles,
  TemplateBuilder,
  
  // Template classes
  ClassicProfessional,
  ModernGradient,
  MinimalClean,
  BorderedCard,
  SideAccent,
  DarkHeader,
  SoftRounded,
  TwoTone,
  ElegantSerif,
  TechModern,
  
  // Registry and utilities
  TemplateRegistry,
  SampleContentGenerator,
  
  // Convenience methods
  getTemplate: (name) => TemplateRegistry.getTemplate(name),
  listTemplates: () => TemplateRegistry.listTemplates(),
  generateSample: (templateName, config) => SampleContentGenerator.generateSample(templateName, config)
};