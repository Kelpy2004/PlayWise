import { Helmet } from 'react-helmet-async'

type SeoProps = {
  title: string
  description?: string
  image?: string | null
  url?: string | null
  type?: string
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>
  noIndex?: boolean
}

function normalizeUrl(value?: string | null): string | undefined {
  if (!value) return undefined
  try {
    return new URL(value).toString()
  } catch {
    return undefined
  }
}

export default function Seo({
  title,
  description,
  image,
  url,
  type = 'website',
  jsonLd,
  noIndex = false
}: SeoProps) {
  const normalizedUrl = normalizeUrl(url)
  const normalizedImage = normalizeUrl(image || undefined)
  const safeDescription = description?.trim() || 'PlayWise helps you decide what to play with smarter game insights.'

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={safeDescription} />
      {noIndex ? <meta name="robots" content="noindex,nofollow" /> : null}
      {normalizedUrl ? <link rel="canonical" href={normalizedUrl} /> : null}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={safeDescription} />
      <meta property="og:type" content={type} />
      {normalizedUrl ? <meta property="og:url" content={normalizedUrl} /> : null}
      {normalizedImage ? <meta property="og:image" content={normalizedImage} /> : null}
      <meta name="twitter:card" content={normalizedImage ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={safeDescription} />
      {normalizedImage ? <meta name="twitter:image" content={normalizedImage} /> : null}
      {jsonLd ? (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      ) : null}
    </Helmet>
  )
}
