import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

const INITIAL_CPU = { name: '', score: '', family: '', platform: 'windows', notes: '' }
const INITIAL_GPU = { name: '', score: '', family: '', platform: 'windows', notes: '' }
const INITIAL_LAPTOP = { model: '', brand: '', cpu: '', gpu: '', ram: '', platform: 'windows', tags: '', notes: '' }

export default function AdminPage() {
  const { token } = useAuth()
  const [catalog, setCatalog] = useState({ cpus: [], gpus: [], laptops: [] })
  const [cpuForm, setCpuForm] = useState(INITIAL_CPU)
  const [gpuForm, setGpuForm] = useState(INITIAL_GPU)
  const [laptopForm, setLaptopForm] = useState(INITIAL_LAPTOP)
  const [feedback, setFeedback] = useState({ tone: 'info', message: '' })

  useEffect(() => {
    loadCatalog()
  }, [])

  async function loadCatalog() {
    try {
      const response = await api.getHardwareCatalog()
      setCatalog(response)
    } catch (error) {
      setFeedback({ tone: 'danger', message: error.message })
    }
  }

  async function handleSubmit(event, type) {
    event.preventDefault()

    try {
      if (type === 'cpu') {
        await api.createCpu({ ...cpuForm, score: Number(cpuForm.score) }, token)
        setCpuForm(INITIAL_CPU)
      }

      if (type === 'gpu') {
        await api.createGpu({ ...gpuForm, score: Number(gpuForm.score) }, token)
        setGpuForm(INITIAL_GPU)
      }

      if (type === 'laptop') {
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
      loadCatalog()
    } catch (error) {
      setFeedback({ tone: 'danger', message: error.message })
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
              The API now requires admin authentication for writes, which closes the biggest security gap from the previous
              version.
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
      </div>
    </section>
  )
}
