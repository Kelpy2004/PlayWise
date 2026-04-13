import { useEffect, useState, type FormEvent } from 'react'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { trackEvent } from '../lib/telemetry'
import type {
  HardwareCatalog,
  NewsletterSubscriberRecord,
  NotificationAdminOverview,
  NotificationDeliveryRecord,
  PriceAlertRecord,
  TournamentSubscriptionRecord
} from '../types/api'

const INITIAL_CPU = { name: '', score: '', family: '', platform: 'windows', notes: '' }
const INITIAL_GPU = { name: '', score: '', family: '', platform: 'windows', notes: '' }
const INITIAL_LAPTOP = { model: '', brand: '', cpu: '', gpu: '', ram: '', platform: 'windows', tags: '', notes: '' }

export default function AdminPage() {
  const { token } = useAuth()
  const [catalog, setCatalog] = useState<HardwareCatalog>({ cpus: [], gpus: [], laptops: [], ramOptions: [] })
  const [notificationOverview, setNotificationOverview] = useState<NotificationAdminOverview | null>(null)
  const [adminPriceAlerts, setAdminPriceAlerts] = useState<PriceAlertRecord[]>([])
  const [adminNewsletterSubscribers, setAdminNewsletterSubscribers] = useState<NewsletterSubscriberRecord[]>([])
  const [adminTournamentSubscribers, setAdminTournamentSubscribers] = useState<TournamentSubscriptionRecord[]>([])
  const [adminDeliveries, setAdminDeliveries] = useState<NotificationDeliveryRecord[]>([])
  const [cpuForm, setCpuForm] = useState(INITIAL_CPU)
  const [gpuForm, setGpuForm] = useState(INITIAL_GPU)
  const [laptopForm, setLaptopForm] = useState(INITIAL_LAPTOP)
  const [feedback, setFeedback] = useState({ tone: 'info', message: '' })

  useEffect(() => {
    void loadCatalog()
    void loadNotificationData()
  }, [])

  async function loadCatalog() {
    try {
      const response = await api.getHardwareCatalog()
      setCatalog(response)
    } catch (error) {
      setFeedback({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Could not load hardware catalog.'
      })
    }
  }

  async function loadNotificationData() {
    if (!token) return
    try {
      const [overview, alerts, subscribers, tournamentSubs, deliveries] = await Promise.all([
        api.fetchAdminNotificationOverview(token),
        api.fetchAdminPriceAlerts(token),
        api.fetchAdminNewsletterSubscribers(token),
        api.fetchAdminTournamentSubscribers(token),
        api.fetchAdminNotificationDeliveries(token)
      ])

      setNotificationOverview(overview)
      setAdminPriceAlerts(alerts || [])
      setAdminNewsletterSubscribers(subscribers || [])
      setAdminTournamentSubscribers(tournamentSubs || [])
      setAdminDeliveries(deliveries || [])
    } catch (error) {
      setFeedback({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Could not load notification admin data.'
      })
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>, type: 'cpu' | 'gpu' | 'laptop') {
    event.preventDefault()

    try {
      if (type === 'cpu' && token) {
        await api.createCpu({ ...cpuForm, score: Number(cpuForm.score) }, token)
        setCpuForm(INITIAL_CPU)
      }

      if (type === 'gpu' && token) {
        await api.createGpu({ ...gpuForm, score: Number(gpuForm.score) }, token)
        setGpuForm(INITIAL_GPU)
      }

      if (type === 'laptop' && token) {
        await api.createLaptop(
          {
            ...laptopForm,
            ram: Number(laptopForm.ram),
            tags: laptopForm.tags
              .split(',')
              .map((entry) => entry.trim())
              .filter(Boolean)
          },
          token
        )
        setLaptopForm(INITIAL_LAPTOP)
      }

      setFeedback({ tone: 'success', message: 'Hardware catalog updated successfully.' })
      void trackEvent({ category: 'admin', action: 'hardware_saved', label: type }, token)
      await loadCatalog()
    } catch (error) {
      setFeedback({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Could not update hardware.'
      })
    }
  }

  return (
    <section className="py-5">
      <div className="container">
        <div className="section-banner mb-4">
          <div>
            <p className="eyebrow text-uppercase mb-2">Hardware admin</p>
            <h1 className="h2 mb-2">Maintain CPUs, GPUs, and laptop presets from one place.</h1>
            <p className="text-secondary-emphasis mb-0">
              The backend now sits on a SQL-ready architecture with validation and structured request logging for safer admin updates.
            </p>
          </div>
          {feedback.message ? (
            <div className={`alert alert-${feedback.tone} mb-0 rounded-4`}>{feedback.message}</div>
          ) : null}
        </div>

        <div className="row g-4">
          <div className="col-xl-4">
            <div className="feature-card h-100">
              <h2 className="h4 mb-3">Add CPU</h2>
              <form className="d-flex flex-column gap-3" onSubmit={(event) => handleSubmit(event, 'cpu')}>
                <input className="form-control rounded-4" placeholder="CPU name" value={cpuForm.name} onChange={(event) => setCpuForm((current) => ({ ...current, name: event.target.value }))} required />
                <input type="number" className="form-control rounded-4" placeholder="Score" value={cpuForm.score} onChange={(event) => setCpuForm((current) => ({ ...current, score: event.target.value }))} required />
                <input className="form-control rounded-4" placeholder="Family" value={cpuForm.family} onChange={(event) => setCpuForm((current) => ({ ...current, family: event.target.value }))} />
                <input className="form-control rounded-4" placeholder="Platform" value={cpuForm.platform} onChange={(event) => setCpuForm((current) => ({ ...current, platform: event.target.value }))} />
                <button type="submit" className="btn btn-brand rounded-pill">Save CPU</button>
              </form>
              <ul className="catalog-list mt-4">
                {catalog.cpus.slice(0, 10).map((cpu) => (
                  <li key={cpu.name}>
                    <strong>{cpu.name}</strong>
                    <span>{cpu.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="feature-card h-100">
              <h2 className="h4 mb-3">Add GPU</h2>
              <form className="d-flex flex-column gap-3" onSubmit={(event) => handleSubmit(event, 'gpu')}>
                <input className="form-control rounded-4" placeholder="GPU name" value={gpuForm.name} onChange={(event) => setGpuForm((current) => ({ ...current, name: event.target.value }))} required />
                <input type="number" className="form-control rounded-4" placeholder="Score" value={gpuForm.score} onChange={(event) => setGpuForm((current) => ({ ...current, score: event.target.value }))} required />
                <input className="form-control rounded-4" placeholder="Family" value={gpuForm.family} onChange={(event) => setGpuForm((current) => ({ ...current, family: event.target.value }))} />
                <input className="form-control rounded-4" placeholder="Platform" value={gpuForm.platform} onChange={(event) => setGpuForm((current) => ({ ...current, platform: event.target.value }))} />
                <button type="submit" className="btn btn-brand rounded-pill">Save GPU</button>
              </form>
              <ul className="catalog-list mt-4">
                {catalog.gpus.slice(0, 10).map((gpu) => (
                  <li key={gpu.name}>
                    <strong>{gpu.name}</strong>
                    <span>{gpu.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="col-xl-4">
            <div className="feature-card h-100">
              <h2 className="h4 mb-3">Add laptop preset</h2>
              <form className="d-flex flex-column gap-3" onSubmit={(event) => handleSubmit(event, 'laptop')}>
                <input className="form-control rounded-4" placeholder="Model" value={laptopForm.model} onChange={(event) => setLaptopForm((current) => ({ ...current, model: event.target.value }))} required />
                <input className="form-control rounded-4" placeholder="Brand" value={laptopForm.brand} onChange={(event) => setLaptopForm((current) => ({ ...current, brand: event.target.value }))} required />
                <input className="form-control rounded-4" placeholder="CPU" value={laptopForm.cpu} onChange={(event) => setLaptopForm((current) => ({ ...current, cpu: event.target.value }))} required />
                <input className="form-control rounded-4" placeholder="GPU" value={laptopForm.gpu} onChange={(event) => setLaptopForm((current) => ({ ...current, gpu: event.target.value }))} required />
                <input type="number" className="form-control rounded-4" placeholder="RAM" value={laptopForm.ram} onChange={(event) => setLaptopForm((current) => ({ ...current, ram: event.target.value }))} required />
                <input className="form-control rounded-4" placeholder="Platform" value={laptopForm.platform} onChange={(event) => setLaptopForm((current) => ({ ...current, platform: event.target.value }))} />
                <input className="form-control rounded-4" placeholder="Tags (comma-separated)" value={laptopForm.tags} onChange={(event) => setLaptopForm((current) => ({ ...current, tags: event.target.value }))} />
                <button type="submit" className="btn btn-brand rounded-pill">Save laptop</button>
              </form>
              <ul className="catalog-list mt-4">
                {catalog.laptops.slice(0, 10).map((laptop) => (
                  <li key={laptop.model}>
                    <strong>{laptop.model}</strong>
                    <span>{laptop.cpu} / {laptop.gpu} / {laptop.ram} GB</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="section-banner mb-4">
            <div>
              <p className="eyebrow text-uppercase mb-2">Notification admin</p>
              <h2 className="h4 mb-1">Subscriptions and deliveries</h2>
              <p className="text-secondary-emphasis mb-0">Visibility into alerts, subscribers, and recent notification sends.</p>
            </div>
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
      </div>
    </section>
  )
}
