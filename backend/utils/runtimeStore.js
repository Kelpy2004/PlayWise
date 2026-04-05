const store = {
  users: [],
  comments: new Map(),
  contacts: []
}

let demoUserCounter = 1

function getDemoUsers() {
  return store.users
}

function nextDemoUserId() {
  return `demo-user-${demoUserCounter++}`
}

function addDemoUser(user) {
  store.users.push(user)
  return user
}

function countDemoAdmins() {
  return store.users.filter((user) => user.role === 'admin').length
}

function findDemoUserByUsernameOrEmail(usernameOrEmail) {
  const needle = String(usernameOrEmail || '').trim().toLowerCase()
  return store.users.find((user) =>
    user.username.toLowerCase() === needle || user.email.toLowerCase() === needle
  ) || null
}

function addRuntimeComment(gameSlug, comment) {
  const comments = store.comments.get(gameSlug) || []
  comments.unshift(comment)
  store.comments.set(gameSlug, comments.slice(0, 50))
  return comment
}

function getRuntimeComments(gameSlug) {
  return store.comments.get(gameSlug) || []
}

function addRuntimeContact(contact) {
  store.contacts.unshift(contact)
  return contact
}

module.exports = {
  addDemoUser,
  addRuntimeComment,
  addRuntimeContact,
  countDemoAdmins,
  findDemoUserByUsernameOrEmail,
  getDemoUsers,
  getRuntimeComments,
  nextDemoUserId
}
