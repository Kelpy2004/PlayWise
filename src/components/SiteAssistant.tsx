import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type { AssistantChatMessage } from '../types/api'

const DEFAULT_GREETING =
  'Ask me about PlayWise, this page, current price signals, or what a feature means. On game pages I can also explain the timing verdict in simpler words.'

function extractGameSlug(pathname: string): string | undefined {
  const match = pathname.match(/^\/games\/([^/]+)/)
  return match?.[1]
}

export default function SiteAssistant() {
  const location = useLocation()
  const { token } = useAuth()
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    { role: 'assistant', content: DEFAULT_GREETING }
  ])

  const gameSlug = useMemo(() => extractGameSlug(location.pathname), [location.pathname])
  const suggestions = useMemo(
    () =>
      gameSlug
        ? ['Explain this price graph', 'Should I buy this right now?', 'What does the timing model mean?']
        : ['What can PlayWise do?', 'How does compatibility checking work?', 'How should I use price tracking?'],
    [gameSlug]
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [isOpen, isSending, messages])

  async function handleSend(rawText: string) {
    const text = rawText.trim()
    if (!text || isSending) return

    const nextMessages = [...messages, { role: 'user' as const, content: text }]
    setMessages(nextMessages)
    setInput('')
    setIsOpen(true)
    setIsSending(true)

    try {
      const response = await api.askAssistant(
        {
          messages: nextMessages,
          pagePath: `${location.pathname}${location.search}${location.hash}`,
          gameSlug
        },
        token
      )

      setMessages((current) => [...current, { role: 'assistant', content: response.reply }])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            error instanceof Error
              ? error.message
              : 'The PlayWise assistant could not answer right now.'
        }
      ])
    } finally {
      setIsSending(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void handleSend(input)
  }

  return (
    <div className={`site-assistant ${isOpen ? 'open' : ''}`} aria-live="polite">
      <button
        type="button"
        className="site-assistant-trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="playwise-assistant-panel"
      >
        <span className="site-assistant-trigger-icon">AI</span>
        <span className="site-assistant-trigger-label">Ask PlayWise</span>
      </button>

      <section id="playwise-assistant-panel" className="site-assistant-panel" aria-hidden={!isOpen}>
        <header className="site-assistant-header">
          <div>
            <strong className="d-block">PlayWise assistant</strong>
            <small className="text-secondary-emphasis">
              {gameSlug ? 'Page-aware help for this game and its price signal.' : 'Site help and quick decision guidance.'}
            </small>
          </div>
          <button
            type="button"
            className="site-assistant-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close assistant"
          >
            ×
          </button>
        </header>

        <div className="site-assistant-body">
          <div className="site-assistant-messages">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}-${message.content.slice(0, 20)}`}
                className={`site-assistant-bubble ${message.role === 'user' ? 'user' : 'assistant'}`}
              >
                {message.content}
              </div>
            ))}
            {isSending ? <div className="site-assistant-bubble assistant muted">Thinking…</div> : null}
            <div ref={messagesEndRef} />
          </div>

          <div className="site-assistant-suggestions">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="site-assistant-suggestion"
                onClick={() => void handleSend(suggestion)}
                disabled={isSending}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <form className="site-assistant-form" onSubmit={handleSubmit}>
            <textarea
              rows={2}
              className="form-control rounded-4"
              placeholder="Ask about this site, a game, pricing, or what a verdict means…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="submit" className="btn btn-brand rounded-pill px-4" disabled={isSending || !input.trim()}>
              {isSending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
