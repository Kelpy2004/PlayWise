import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type {
  NewsletterSubscriberRecord,
  NotificationAdminOverview,
  NotificationDeliveryRecord,
  PriceAlertRecord,
  TournamentSubscriptionRecord
} from '../types/api'

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
          setFeedback({
            tone: 'danger',
            message: error instanceof Error ? error.message : 'Could not load notification admin data.'
          })
        }
      }
    })()
    return () => { ignore = true }
  }, [token])

  return (
    <section className="py-5">
      <div className="container">
        <div className="section-banner mb-4">
          <div>
            <p className="eyebrow text-uppercase mb-2">Notification admin</p>
            <h1 className="h2 mb-1">Subscriptions and deliveries</h1>
            <p className="text-secondary-emphasis mb-0">Visibility into alerts, subscribers, and recent notification sends.</p>
          </div>
          {feedback.message ? (
            <div className={`alert alert-${feedback.tone} mb-0 rounded-4`}>{feedback.message}</div>
          ) : null}
        </div>

        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="feature-card h-100">
              <small className="text-secondary-emphasis">Active price alerts</small>
              <h3 className="h2 mb-0">{notificationOverview?.activePriceAlerts ?? 0}</h3>
            </div>
          </div>
          <div className="col-md-3">
            <div className="feature-card h-100">
              <small className="text-secondary-emphasis">Newsletter subscribers</small>
              <h3 className="h2 mb-0">{notificationOverview?.subscribedNewsletters ?? 0}</h3>
            </div>
          </div>
          <div className="col-md-3">
            <div className="feature-card h-100">
              <small className="text-secondary-emphasis">Tournament subs</small>
              <h3 className="h2 mb-0">{notificationOverview?.activeTournamentSubs ?? 0}</h3>
            </div>
          </div>
          <div className="col-md-3">
            <div className="feature-card h-100">
              <small className="text-secondary-emphasis">Recent sends (24h)</small>
              <h3 className="h2 mb-0">{notificationOverview?.recentDeliveries ?? 0}</h3>
            </div>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-xl-6">
            <div className="feature-card h-100">
              <h3 className="h5 mb-3">Recent price alerts</h3>
              <ul className="catalog-list">
                {adminPriceAlerts.slice(0, 12).map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.gameSlug}</strong>
                    <span>{entry.email} / {entry.isActive ? 'active' : 'off'}</span>
                  </li>
                ))}
                {!adminPriceAlerts.length ? <li><span>No alerts yet.</span></li> : null}
              </ul>
            </div>
          </div>
          <div className="col-xl-6">
            <div className="feature-card h-100">
              <h3 className="h5 mb-3">Newsletter subscribers</h3>
              <ul className="catalog-list">
                {adminNewsletterSubscribers.slice(0, 12).map((entry) => (
                  <li key={entry.id || entry.email}>
                    <strong>{entry.email}</strong>
                    <span>{entry.isSubscribed ? 'subscribed' : 'unsubscribed'}</span>
                  </li>
                ))}
                {!adminNewsletterSubscribers.length ? <li><span>No subscribers yet.</span></li> : null}
              </ul>
            </div>
          </div>
          <div className="col-xl-6">
            <div className="feature-card h-100">
              <h3 className="h5 mb-3">Tournament subscriptions</h3>
              <ul className="catalog-list">
                {adminTournamentSubscribers.slice(0, 12).map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.email}</strong>
                    <span>{entry.scope}{entry.gameSlug ? ` / ${entry.gameSlug}` : ''}</span>
                  </li>
                ))}
                {!adminTournamentSubscribers.length ? <li><span>No tournament subscriptions yet.</span></li> : null}
              </ul>
            </div>
          </div>
          <div className="col-xl-6">
            <div className="feature-card h-100">
              <h3 className="h5 mb-3">Recent deliveries</h3>
              <ul className="catalog-list">
                {adminDeliveries.slice(0, 12).map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.type}</strong>
                    <span>{entry.recipientEmail} / {entry.status}</span>
                  </li>
                ))}
                {!adminDeliveries.length ? <li><span>No deliveries logged yet.</span></li> : null}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
