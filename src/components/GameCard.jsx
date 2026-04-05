import { Link } from 'react-router-dom'

function toneClass(tone) {
  if (tone === 'good') return 'text-bg-success'
  if (tone === 'warn') return 'text-bg-warning'
  if (tone === 'bad') return 'text-bg-danger'
  return 'text-bg-info'
}

export default function GameCard({ game }) {
  return (
    <article className="card game-card-modern border-0 shadow-sm h-100 overflow-hidden">
      <div
        className="game-card-cover"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(8, 17, 31, 0.06), rgba(8, 17, 31, 0.7)), url('${game.image}')`
        }}
      />
      <div className="card-body d-flex flex-column p-4">
        <div className="d-flex flex-wrap gap-2 mb-3">
          <span className="badge rounded-pill text-bg-light">{game.year}</span>
          <span className={`badge rounded-pill ${toneClass(game.demandTone || game.bugStatus?.tone || 'blue')}`}>
            {game.demandLevel || game.bugStatus?.label || (game.openSource ? 'Free' : 'Featured')}
          </span>
          {game.openSource ? <span className="badge rounded-pill text-bg-dark">Open Source</span> : null}
        </div>
        <h3 className="h5 mb-2">{game.title}</h3>
        <p className="text-secondary-emphasis mb-3 flex-grow-1">{game.heroTag}</p>
        <div className="d-flex flex-wrap gap-2 mb-4">
          {game.genre.slice(0, 3).map((genre) => (
            <span key={genre} className="badge rounded-pill text-bg-soft">
              {genre}
            </span>
          ))}
        </div>
        <div className="d-flex justify-content-between align-items-center mt-auto">
          <div>
            <small className="text-secondary-emphasis d-block">Average score</small>
            <strong>{game.averageRating ? game.averageRating.toFixed(1) : 'N/A'} / 10</strong>
          </div>
          <Link className="btn btn-sm btn-brand rounded-pill px-3" to={`/games/${game.slug}`}>
            View details
          </Link>
        </div>
      </div>
    </article>
  )
}
