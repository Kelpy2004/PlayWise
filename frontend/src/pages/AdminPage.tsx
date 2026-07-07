import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type {
  NewsletterSubscriberRecord,
  NotificationAdminOverview,
  NotificationDeliveryRecord,
  PriceAlertRecord,
  TournamentSubscriptionRecord
} from '../types/api'

const card: CSSProperties = { background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)' }

function StatCard({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div style={{ ...card, borderRadius: 16, padding: '18px 20px', boxShadow: `5px 5px 0 ${accent}` }}>
      <div style={{ fontFamily: 'var(--fm)', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1, color: 'var(--tx,#f6f4ff)' }}>{value}</div>
      <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 500, letterSpacing: '.05em', color: 'var(--tx2,#aaa3c6)', marginTop: 8, textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

function Panel({ title, accent, children }: { title: string; accent: string; children: ReactNode }) {
  return (
    <div style={{ ...card, borderRadius: 18, boxShadow: '6px 6px 0 var(--hard)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 18px', borderBottom: '2px solid var(--line)' }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: accent, border: '1.5px solid var(--bd,#f6f4ff)' }} />
        <h3 style={{ fontFamily: 'var(--fd)', fontSize: 15.5, fontWeight: 800, letterSpacing: '-.01em', margin: 0 }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  )
}

function Row({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div className="adminrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 18px', borderTop: '2px solid var(--line)' }}>
      <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--tx,#f6f4ff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primary}</span>
      <span style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--tx2,#aaa3c6)', whiteSpace: 'nowrap', flexShrink: 0 }}>{secondary}</span>
    </div>
  )
}

function EmptyRow({ text }: { text: string }) {
  return <div style={{ padding: '16px 18px', borderTop: '2px solid var(--line)', fontFamily: 'var(--fm)', fontSize: 12.5, color: 'var(--tx3,#736c92)' }}>{text}</div>
}

export default function AdminPage() {
  const { token } = useAuth()
  const [notificationOverview, setNotificationOverview] = useState<NotificationAdminOverview | null>(null)
  const [adminPriceAlerts, setAdminPriceAlerts] = useState<PriceAlertRecord[]>([])
  const [adminNewsletterSubscribers, setAdminNewsletterSubscribers] = useState<NewsletterSubscriberRecord[]>([])
  const [adminTournamentSubscribers, setAdminTournamentSubscribers] = useState<TournamentSubscriptionRecord[]>([])
  const [adminDeliveries, setAdminDeliveries] = useState<NotificationDeliveryRecord[]>([])
  const [feedback, setFeedback] = useState({ tone: 'info', message: '' })

  useEffect(() => {
    if (!token) return
    let ignore = false
    void (async () => {
      try {
        const [overview, alerts, subscribers, tournamentSubs, deliveries] = await Promise.all([
          api.fetchAdminNotificationOverview(token),
          api.fetchAdminPriceAlerts(token),
          api.fetchAdminNewsletterSubscribers(token),
          api.fetchAdminTournamentSubscribers(token),
          api.fetchAdminNotificationDeliveries(token)
        ])
        if (ignore) return
        setNotificationOverview(overview)
        setAdminPriceAlerts(alerts || [])
        setAdminNewsletterSubscribers(subscribers || [])
        setAdminTournamentSubscribers(tournamentSubs || [])
        setAdminDeliveries(deliveries || [])
      } catch (error) {
        if (!ignore) {
          setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'Could not load notification admin data.' })
        }
      }
    })()
    return () => { ignore = true }
  }, [token])

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '40px 26px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--vio)' }}>
            <span style={{ width: 18, height: 2, background: 'var(--vio)' }} />NOTIFICATION ADMIN
          </div>
          <h1 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-.03em', margin: '12px 0 0', lineHeight: 1 }}>Subscriptions &amp; deliveries</h1>
          <p style={{ fontSize: 14.5, color: 'var(--tx2,#aaa3c6)', marginTop: 10, maxWidth: '58ch', lineHeight: 1.5 }}>Visibility into alerts, subscribers, and recent notification sends.</p>
        </div>
        {feedback.message ? (
          <div style={{ background: 'var(--bg,#0b0a12)', border: `2px solid ${feedback.tone === 'danger' ? 'var(--pink)' : 'var(--line2,#3a3460)'}`, borderRadius: 12, padding: '11px 15px', fontSize: 13.5, fontWeight: 600, color: feedback.tone === 'danger' ? 'var(--pink)' : 'var(--tx2,#aaa3c6)' }}>{feedback.message}</div>
        ) : null}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 26 }}>
        <StatCard value={notificationOverview?.activePriceAlerts ?? 0} label="Active price alerts" accent="var(--cyan)" />
        <StatCard value={notificationOverview?.subscribedNewsletters ?? 0} label="Newsletter subscribers" accent="var(--lime)" />
        <StatCard value={notificationOverview?.activeTournamentSubs ?? 0} label="Tournament subs" accent="var(--vio)" />
        <StatCard value={notificationOverview?.recentDeliveries ?? 0} label="Recent sends (24h)" accent="var(--amber)" />
      </div>

      {/* Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 18 }}>
        <Panel title="Recent price alerts" accent="var(--cyan)">
          {adminPriceAlerts.slice(0, 12).map((entry) => (
            <Row key={entry.id} primary={entry.gameSlug} secondary={`${entry.email} · ${entry.isActive ? 'active' : 'off'}`} />
          ))}
          {!adminPriceAlerts.length ? <EmptyRow text="No alerts yet." /> : null}
        </Panel>

        <Panel title="Newsletter subscribers" accent="var(--lime)">
          {adminNewsletterSubscribers.slice(0, 12).map((entry) => (
            <Row key={entry.id || entry.email} primary={entry.email} secondary={entry.isSubscribed ? 'subscribed' : 'unsubscribed'} />
          ))}
          {!adminNewsletterSubscribers.length ? <EmptyRow text="No subscribers yet." /> : null}
        </Panel>

        <Panel title="Tournament subscriptions" accent="var(--vio)">
          {adminTournamentSubscribers.slice(0, 12).map((entry) => (
            <Row key={entry.id} primary={entry.email} secondary={`${entry.scope}${entry.gameSlug ? ` · ${entry.gameSlug}` : ''}`} />
          ))}
          {!adminTournamentSubscribers.length ? <EmptyRow text="No tournament subscriptions yet." /> : null}
        </Panel>

        <Panel title="Recent deliveries" accent="var(--amber)">
          {adminDeliveries.slice(0, 12).map((entry) => (
            <Row key={entry.id} primary={entry.type} secondary={`${entry.recipientEmail} · ${entry.status}`} />
          ))}
          {!adminDeliveries.length ? <EmptyRow text="No deliveries logged yet." /> : null}
        </Panel>
      </div>
    </div>
  )
}
