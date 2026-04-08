const express = require('express')
const { z } = require('zod')

const { ApiError, asyncHandler } = require('../lib/http')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { optionalAuth, requireAuth } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const { resolveGameIdentity } = require('../utils/gameResolver')
const {
  addRuntimeComment,
  getRuntimeComments,
  setRuntimeCommentReaction
} = require('../utils/runtimeStore')

const router = express.Router()

const commentSchema = z.object({
  username: z.string().trim().optional(),
  message: z.string().trim().min(1).max(600)
})

const reactionSchema = z.object({
  reaction: z.enum(['LIKE', 'DISLIKE']).nullable().optional().default(null)
})

function serializeComment(comment, userId) {
  const userReaction =
    Array.isArray(comment.reactions) && userId
      ? comment.reactions.find((reaction) => reaction.userId === userId)?.reaction || null
      : comment.userReaction || null

  return {
    id: comment.id,
    gameSlug: comment.gameSlug,
    username: comment.username,
    message: comment.message,
    userId: comment.userId || null,
    likeCount: Number(comment.likeCount) || 0,
    dislikeCount: Number(comment.dislikeCount) || 0,
    userReaction,
    createdAt:
      comment.createdAt instanceof Date ? comment.createdAt.toISOString() : String(comment.createdAt || '')
  }
}

async function getCommentById(commentId) {
  if (!isDatabaseReady()) return null
  return getPrisma().comment.findUnique({ where: { id: commentId } })
}

function sortCommentsByCreatedAtDesc(comments) {
  return [...comments].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

async function applyCommentReactionWithSql(commentId, userId, nextReaction) {
  const prisma = getPrisma()

  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.findUnique({ where: { id: commentId } })
    if (!comment) {
      throw new ApiError(404, 'Comment not found.')
    }

    const existing = await tx.commentReaction.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId
        }
      }
    })

    if (!nextReaction) {
      if (existing) {
        await tx.commentReaction.delete({
          where: {
            userId_commentId: {
              userId,
              commentId
            }
          }
        })

        await tx.comment.update({
          where: { id: commentId },
          data:
            existing.reaction === 'LIKE'
              ? { likeCount: { decrement: 1 } }
              : { dislikeCount: { decrement: 1 } }
        })
      }
    } else if (!existing) {
      await tx.commentReaction.create({
        data: {
          userId,
          commentId,
          reaction: nextReaction
        }
      })

      await tx.comment.update({
        where: { id: commentId },
        data: nextReaction === 'LIKE' ? { likeCount: { increment: 1 } } : { dislikeCount: { increment: 1 } }
      })
    } else if (existing.reaction !== nextReaction) {
      await tx.commentReaction.update({
        where: {
          userId_commentId: {
            userId,
            commentId
          }
        },
        data: { reaction: nextReaction }
      })

      await tx.comment.update({
        where: { id: commentId },
        data:
          existing.reaction === 'LIKE'
            ? {
                likeCount: { decrement: 1 },
                dislikeCount: { increment: 1 }
              }
            : {
                dislikeCount: { decrement: 1 },
                likeCount: { increment: 1 }
              }
      })
    }

    const updated = await tx.comment.findUnique({ where: { id: commentId } })

    return {
      commentId,
      likeCount: updated?.likeCount || 0,
      dislikeCount: updated?.dislikeCount || 0,
      userReaction: nextReaction
    }
  })
}

router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const identity = await resolveGameIdentity(req.params.slug)
    const aliases = identity.aliases.length ? identity.aliases : [identity.canonicalSlug]

    if (isDatabaseReady()) {
      const comments = await getPrisma().comment.findMany({
        where: { gameSlug: { in: aliases } },
        orderBy: { createdAt: 'desc' },
        include: {
          reactions: req.user
            ? {
                where: { userId: req.user.id },
                select: { userId: true, reaction: true }
              }
            : false
        }
      })

      return res.json(comments.map((comment) => serializeComment(comment, req.user?.id)))
    }

    const runtimeComments = aliases.flatMap((slug) => getRuntimeComments(slug, req.user?.id || null))
    res.json(sortCommentsByCreatedAtDesc(runtimeComments))
  })
)

router.post(
  '/:slug',
  optionalAuth,
  validateBody(commentSchema),
  asyncHandler(async (req, res) => {
    const identity = await resolveGameIdentity(req.params.slug)
    const slug = identity.canonicalSlug
    const message = req.validatedBody.message
    const username = req.user?.username || String(req.validatedBody.username || '').trim()

    if (!username) {
      throw new ApiError(400, 'Username is required for guest comments.')
    }

    const commentPayload = {
      gameSlug: slug,
      username,
      message,
      userId: req.user?.id || null
    }

    if (isDatabaseReady()) {
      const created = await getPrisma().comment.create({ data: commentPayload })
      return res.status(201).json(serializeComment(created, req.user?.id))
    }

    res
      .status(201)
      .json(serializeComment(addRuntimeComment(slug, { ...commentPayload, createdAt: new Date().toISOString() }), req.user?.id))
  })
)

router.post(
  '/:commentId/reactions',
  requireAuth,
  validateBody(reactionSchema),
  asyncHandler(async (req, res) => {
    const commentId = String(req.params.commentId || '').trim()
    const reaction = req.validatedBody.reaction

    if (isDatabaseReady()) {
      const comment = await getCommentById(commentId)
      if (!comment) {
        throw new ApiError(404, 'Comment not found.')
      }

      const summary = await applyCommentReactionWithSql(commentId, req.user.id, reaction)
      return res.json(summary)
    }

    const summary = setRuntimeCommentReaction(req.user.id, commentId, reaction)
    if (!summary) {
      throw new ApiError(404, 'Comment not found.')
    }

    res.json({ commentId, ...summary })
  })
)

module.exports = router
