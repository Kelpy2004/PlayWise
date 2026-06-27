import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="py-5">
      <div className="container">
        <div className="hero-panel p-5 text-center">
          <p className="eyebrow text-uppercase mb-2">404</p>
          <h1 className="h2 mb-3">Page not found</h1>
          <p className="text-secondary-emphasis mb-4">
            The page you're looking for doesn't exist or may have moved. Let's get you back to the games.
          </p>
          <Link to="/" className="btn btn-brand rounded-pill px-4">
            Back to home
          </Link>
        </div>
      </div>
    </section>
  )
}
