/** Shared branded HTML shell for transactional FUPE emails (dark UI). */

export interface BrandedEmailContent {
  preheader?: string;
  headline: string;
  bodyHtml: string;
  /** Primary button */
  cta?: { label: string; url: string };
  /** Extra note under CTA (expiry, ignore if…) */
  footnoteHtml?: string;
}

export function siteBaseUrl(raw?: string | null): string {
  return (raw ?? 'https://fupe.app').replace(/\/$/, '');
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Table-based layout for broad client support. Colors match apps/web fupe theme.
 */
export function renderBrandedEmail(
  content: BrandedEmailContent,
  opts: { siteUrl: string; supportEmail?: string },
): string {
  const site = siteBaseUrl(opts.siteUrl);
  const support = opts.supportEmail ?? 'support@fupe.app';
  const logoUrl = `${site}/icon.png`;
  const preheader = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(content.preheader)}</div>`
    : '';

  const cta = content.cta
    ? `
      <tr>
        <td style="padding:28px 0 8px;text-align:center">
          <a href="${escapeHtml(content.cta.url)}"
             style="display:inline-block;background:#ffffff;color:#141414;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px">
            ${escapeHtml(content.cta.label)}
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.5;color:#737373;word-break:break-all">
          Or paste this link:<br/>
          <a href="${escapeHtml(content.cta.url)}" style="color:#a0a0a0">${escapeHtml(content.cta.url)}</a>
        </td>
      </tr>`
    : '';

  const footnote = content.footnoteHtml
    ? `<tr><td style="padding:24px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.5;color:#737373">${content.footnoteHtml}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>FUPE</title></head>
<body style="margin:0;padding:0;background:#0a0a0a">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141414;border:1px solid #3a3a3a;border-radius:12px">
        <tr>
          <td style="padding:28px 32px 8px;text-align:center">
            <a href="${escapeHtml(site)}" style="text-decoration:none">
              <img src="${escapeHtml(logoUrl)}" width="48" height="48" alt="FUPE" style="display:inline-block;border-radius:10px"/>
            </a>
            <div style="margin-top:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:20px;font-weight:700;letter-spacing:0.04em;color:#ffffff">FUPE</div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:600;line-height:1.3;color:#ffffff;text-align:center">
            ${escapeHtml(content.headline)}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.55;color:#a0a0a0;text-align:left">
            ${content.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${cta}
              ${footnote}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #3a3a3a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.5;color:#737373;text-align:center">
            <a href="${escapeHtml(site)}" style="color:#a0a0a0;text-decoration:none">fupe.app</a>
            · Find Ultimate Parent Entity<br/>
            Questions?
            <a href="mailto:${escapeHtml(support)}" style="color:#a0a0a0">${escapeHtml(support)}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
