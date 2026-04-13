function renderLayout({ title, heading, intro, bodyLines = [], ctaLabel, ctaUrl, footerNote }) {
  const bodyHtml = bodyLines.map((line) => `<p style="margin:0 0 10px;line-height:1.55;color:#1b2a36;">${line}</p>`).join('')
  const ctaHtml = ctaLabel && ctaUrl
    ? `<p style="margin:18px 0 0;"><a href="${ctaUrl}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#b1fa50;color:#0b1600;text-decoration:none;font-weight:700;">${ctaLabel}</a></p>`
    : ''

  return {
    subject: title,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7fafc;padding:24px;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e9eef3;border-radius:14px;padding:22px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.12em;color:#5f7384;text-transform:uppercase;">PlayWise Notifications</p>
          <h2 style="margin:0 0 10px;color:#0f1a24;">${heading}</h2>
          <p style="margin:0 0 16px;line-height:1.55;color:#425564;">${intro}</p>
          ${bodyHtml}
          ${ctaHtml}
          <hr style="border:none;border-top:1px solid #edf2f7;margin:18px 0;" />
          <p style="margin:0;font-size:12px;color:#6b7f91;">${footerNote || 'You are receiving this because you subscribed in PlayWise.'}</p>
        </div>
      </div>
    `.trim()
  }
}

function priceAlertEmail({ gameTitle, gameSlug, currentPrice, targetPrice, reason }) {
  return renderLayout({
    title: `PlayWise price alert: ${gameTitle}`,
    heading: `Price update for ${gameTitle}`,
    intro: reason === 'TARGET_REACHED'
      ? 'Your target price has been reached.'
      : 'A new lower price has been detected compared to the last tracked value.',
    bodyLines: [
      `Current price: ${currentPrice}`,
      targetPrice != null ? `Your target price: ${targetPrice}` : 'No target price was set for this alert.',
      'Open PlayWise to review live stores and timing signals.'
    ],
    ctaLabel: 'Open game page',
    ctaUrl: `/games/${gameSlug}`,
    footerNote: 'You can disable this alert anytime from your PlayWise account.'
  })
}

function tournamentSoonEmail({ tournamentTitle, startsAt, gameSlug }) {
  return renderLayout({
    title: `PlayWise tournament reminder: ${tournamentTitle} starts soon`,
    heading: `${tournamentTitle} starts soon`,
    intro: 'Your tournament subscription is active, and this event is about to begin.',
    bodyLines: [
      `Start time: ${new Date(startsAt).toLocaleString()}`,
      'Jump in now to register, warm up, and review your setup.'
    ],
    ctaLabel: 'Open PlayWise',
    ctaUrl: gameSlug ? `/games/${gameSlug}` : '/games'
  })
}

function tournamentLiveEmail({ tournamentTitle, gameSlug }) {
  return renderLayout({
    title: `PlayWise tournament live: ${tournamentTitle}`,
    heading: `${tournamentTitle} is live now`,
    intro: 'A tournament you subscribed to is now live.',
    bodyLines: ['Open PlayWise to check details and join quickly.'],
    ctaLabel: 'Open live tournament',
    ctaUrl: gameSlug ? `/games/${gameSlug}` : '/games'
  })
}

function newsletterCampaignEmail({ heading, intro, lines = [] }) {
  return renderLayout({
    title: `PlayWise newsletter: ${heading}`,
    heading,
    intro,
    bodyLines: lines,
    ctaLabel: 'Visit PlayWise',
    ctaUrl: '/games'
  })
}

module.exports = {
  newsletterCampaignEmail,
  priceAlertEmail,
  tournamentLiveEmail,
  tournamentSoonEmail
}
