const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
  const finalHeaders = { ...headers }

  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
  }

  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.message
    throw new Error(message || 'Something went wrong.')
  }

  return payload
}

export const api = {
  getSession: (token) => request('/auth/session', { token }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  sendContact: (body) => request('/contact', { method: 'POST', body }),
  getHardwareCatalog: () => request('/hardware/catalog'),
  checkCompatibility: (game, hardware) =>
    request('/hardware/compatibility', { method: 'POST', body: { game, hardware } }),
  fetchComments: (slug) => request(`/comments/${slug}`),
  postComment: (slug, body, token) => request(`/comments/${slug}`, { method: 'POST', body, token }),
  fetchPrices: (slug) => request(`/games/${slug}/prices`),
  createCpu: (body, token) => request('/hardware/cpus', { method: 'POST', body, token }),
  createGpu: (body, token) => request('/hardware/gpus', { method: 'POST', body, token }),
  createLaptop: (body, token) => request('/hardware/laptops', { method: 'POST', body, token })
}
