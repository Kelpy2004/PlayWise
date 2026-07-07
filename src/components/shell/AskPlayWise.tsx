import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import type { AssistantChatMessage } from '../../types/api'

interface BotMsg {
  role: 'user' | 'bot' | 'typing'
  text?: string
}

const GREETING: BotMsg = {
  role: 'bot',
  text: "Hey! I'm your PlayWise buddy 🎮 Ask me for the cheapest price on any game, what's free this week, or who's live right now.",
}

function botFallback(q: string): string {
  q = (q || '').toLowerCase()
  if (q.includes('free')) return 'This week Fall Guys and Control are FREE on Epic 🎉 Grab them before the rotation flips!'
  if (q.includes('cyberpunk')) return 'Cyberpunk 2077 is at its lowest ever — $8.99 on Steam (−85% off $59.99). 🔥'
  if (q.includes('elden')) return 'Elden Ring is $29.99 on Steam right now (−50%). Solid time to jump in.'
  if (q.includes('baldur')) return "Baldur's Gate 3 is $35.99 on GOG (−40%) — DRM-free too."
  if (q.includes('live') || q.includes('tournament') || q.includes('esport')) return 'Valorant Champions and the CS2 Major are LIVE right now! 🏆 Peek the Tournaments rail for the bracket.'
  if (q.includes('cheap') || q.includes('deal') || q.includes('price') || q.includes('discount')) return "Top deal today: Cyberpunk 2077 at $8.99. Name a game and I'll hunt its best price across all 7 stores!"
  return "I track deals, free games, tournaments and news across 7 stores. Try 'what's free this week?' or 'cheapest Elden Ring?' 🎮"
}

export default function AskPlayWise() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<BotMsg[]>([GREETING])
  const { token } = useAuth()
  const location = useLocation()
  const msgsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const c = msgsRef.current
    if (c) c.scrollTop = c.scrollHeight
  }, [msgs, open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60)
  }, [open])

  async function send() {
    const inp = inputRef.current
    if (!inp) return
    const q = (inp.value || '').trim()
    if (!q || busy) return
    inp.value = ''
    const history = msgs
    setMsgs([...history, { role: 'user', text: q }, { role: 'typing' }])
    setBusy(true)

    let answer = ''
    try {
      const chat: AssistantChatMessage[] = history
        .filter((m) => m.role !== 'typing' && m.text)
        .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text as string }))
      chat.push({ role: 'user', content: q })
      const res = await api.askAssistant({ messages: chat, pagePath: location.pathname }, token)
      answer = res?.reply || ''
    } catch {
      answer = ''
    }
    if (!answer) answer = botFallback(q)
    setMsgs((prev) => [...prev.filter((m) => m.role !== 'typing'), { role: 'bot', text: answer }])
    setBusy(false)
  }

  return (
    <div style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 520, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14 }}>
      {open && (
        <div style={{ display: 'flex', width: 'min(370px,calc(100vw - 44px))', height: 520, maxHeight: 'calc(100vh - 120px)', background: 'var(--card,#1a1630)', border: '3px solid var(--bd,#f6f4ff)', borderRadius: 22, boxShadow: '9px 9px 0 var(--hard)', overflow: 'hidden', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 16px', borderBottom: '2.5px solid var(--line)', background: 'var(--card2,#221c3c)' }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--bg,#0b0a12)', border: '2.5px solid var(--bd,#f6f4ff)', boxShadow: '2px 2px 0 var(--vio)', display: 'grid', placeItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <defs>
                  <linearGradient id="botGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ff2e6e" />
                    <stop offset=".5" stopColor="#a24dff" />
                    <stop offset="1" stopColor="#1fd7ff" />
                  </linearGradient>
                </defs>
                <path d="M19 15 L34 24 L19 33 Z" fill="url(#botGrad)" />
              </svg>
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 800, letterSpacing: '-.01em' }}>Ask PlayWise</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx2,#aaa3c6)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--lime)', boxShadow: '0 0 7px var(--lime)' }} />Online · finds you deals
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 9, cursor: 'pointer', color: 'var(--tx,#f6f4ff)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          <div ref={msgsRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {msgs.map((m, i) => {
              if (m.role === 'user')
                return (
                  <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '85%', background: 'var(--grad)', color: '#fff', border: '2px solid var(--bd,#f6f4ff)', borderRadius: '14px 14px 4px 14px', padding: '10px 13px', fontSize: 13.5, lineHeight: 1.45, boxShadow: '2px 2px 0 var(--hard)' }}>
                    {m.text}
                  </div>
                )
              if (m.role === 'typing')
                return (
                  <div key={i} style={{ alignSelf: 'flex-start', display: 'flex', gap: 5, alignItems: 'center', background: 'var(--card2,#221c3c)', border: '2px solid var(--line2,#3a3460)', borderRadius: '14px 14px 14px 4px', padding: '12px 14px' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--tx3,#736c92)', animation: 'pw-blink 1s ease-in-out infinite' }} />
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--tx3,#736c92)', animation: 'pw-blink 1s ease-in-out .2s infinite' }} />
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--tx3,#736c92)', animation: 'pw-blink 1s ease-in-out .4s infinite' }} />
                  </div>
                )
              return (
                <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '85%', background: 'var(--card2,#221c3c)', border: '2px solid var(--line2,#3a3460)', borderRadius: '14px 14px 14px 4px', padding: '10px 13px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--tx,#f6f4ff)' }}>
                  {m.text}
                </div>
              )
            })}
          </div>

          <div style={{ padding: 12, borderTop: '2.5px solid var(--line)', display: 'flex', gap: 8, background: 'var(--card2,#221c3c)' }}>
            <input
              ref={inputRef}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder="Cheapest Elden Ring?"
              style={{ flex: 1, background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 11, padding: '10px 13px', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 14, outline: 'none' }}
            />
            <button onClick={() => void send()} className="press" aria-label="Send" style={{ width: 44, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--lime)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 11, cursor: 'pointer', color: '#0b0a12', boxShadow: '2px 2px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
            </button>
          </div>
        </div>
      )}

      {!open && (
        <button onClick={() => setOpen(true)} className="press" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--grad)', border: '3px solid var(--bd,#f6f4ff)', borderRadius: 16, padding: '13px 18px 13px 14px', cursor: 'pointer', boxShadow: '5px 5px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(11,10,18,.28)', display: 'grid', placeItems: 'center', color: '#fff' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.5-.6L3 21l1.3-3.9A8.4 8.4 0 1 1 21 11.5z" /></svg>
          </span>
          <span style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-.01em' }}>Ask PlayWise</span>
        </button>
      )}
    </div>
  )
}
