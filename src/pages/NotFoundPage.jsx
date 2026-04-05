import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="py-5">
      <div className="container">
        <div className="hero-panel p-5 text-center">
          <p className="eyebrow text-uppercase mb-2">404</p>
          <h1 className="h2 mb-3">This page does not exist in the new PlayWise app.</h1>
          <p className="text-secondary-emphasis mb-4">
            The frontend has been consolidated into a React SPA, so older direct file paths now route back into the main app.
          </p>
          <Link to="/" className="btn btn-brand rounded-pill px-4">
            Back to home
          </Link>
        </div>
      </div>
    </section>
  )
}
