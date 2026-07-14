'use client';

import * as React from "react";
import NextLink from "next/link";
import { DeleteOutlineRounded, EditRounded } from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useSession } from "next-auth/react";

import { StarRating } from "@/components/ui/starRating";
import { api, ApiClientError } from "@/lib/api";
import { ProductComment } from "@/types/types";

interface ProductReviewsProps {
  productId: string;
  initialComments: ProductComment[];
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value)
  );

export function ProductReviews({ productId, initialComments }: ProductReviewsProps) {
  const { data: session, status } = useSession();
  const [comments, setComments] = React.useState(initialComments);
  const [rating, setRating] = React.useState(0);
  const [body, setBody] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const myComment = session?.user
    ? comments.find((c) => c.userId === session.user.id)
    : undefined;
  const isEditing = editingId !== null;

  const startEdit = () => {
    if (!myComment) return;
    setEditingId(myComment.id);
    setRating(myComment.rating ?? 0);
    setBody(myComment.body);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setRating(0);
    setBody("");
    setError(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = { body, rating: rating > 0 ? rating : null };
      if (isEditing && myComment) {
        const updated = await api.updateComment(myComment.id, payload);
        setComments((current) => current.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await api.postComment(productId, payload);
        setComments((current) => [created, ...current]);
      }
      cancelEdit();
    } catch (submitError) {
      setError(
        submitError instanceof ApiClientError
          ? submitError.message
          : "We couldn't save your review right now."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!myComment) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.deleteComment(myComment.id);
      setComments((current) => current.filter((c) => c.id !== myComment.id));
      cancelEdit();
    } catch (deleteError) {
      setError(
        deleteError instanceof ApiClientError
          ? deleteError.message
          : "We couldn't delete your review right now."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Typography variant="h4" sx={{ fontWeight: 900, color: "text.primary" }}>
        Reviews
      </Typography>

      {status === "unauthenticated" && (
        <Paper
          elevation={0}
          sx={{ p: 2.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} justifyContent="space-between">
            <Typography variant="body1" color="text.secondary">
              Sign in to write a review — reviews are limited to buyers who&apos;ve purchased and received this product.
            </Typography>
            <Button
              component={NextLink}
              href="/auth/sign-in"
              variant="contained"
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800, whiteSpace: "nowrap" }}
            >
              Sign in to review
            </Button>
          </Stack>
        </Paper>
      )}

      {status === "authenticated" && (myComment === undefined || isEditing) && (
        <Paper
          elevation={0}
          sx={{ p: 2.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}
        >
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" fontWeight={800}>
              {isEditing ? "Edit your review" : "Write a review"}
            </Typography>
            <StarRating value={rating} onChange={setRating} size={26} />
            <TextField
              multiline
              minRows={3}
              placeholder="Share what you thought about this product..."
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="contained"
                disabled={submitting || !body.trim()}
                onClick={handleSubmit}
                sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800 }}
              >
                {submitting ? "Saving..." : isEditing ? "Save changes" : "Submit review"}
              </Button>
              {isEditing ? (
                <Button
                  variant="outlined"
                  disabled={submitting}
                  onClick={cancelEdit}
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 800 }}
                >
                  Cancel
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Paper>
      )}

      {status === "authenticated" && myComment && !isEditing && (
        <Paper
          elevation={0}
          sx={{ p: 2.5, borderRadius: 2, border: "1px solid", borderColor: "primary.main" }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="primary.main" fontWeight={700}>
                Your review
              </Typography>
              {myComment.rating ? <StarRating value={myComment.rating} size={16} /> : null}
              <Typography variant="body2" color="text.secondary">
                {myComment.body}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <IconButton size="small" onClick={startEdit} aria-label="Edit your review">
                <EditRounded fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={handleDelete} disabled={submitting} aria-label="Delete your review">
                <DeleteOutlineRounded fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Paper>
      )}

      {comments.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
          No reviews yet — be the first to share your experience.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {comments
            .filter((c) => c.id !== myComment?.id)
            .map((comment) => (
              <Paper
                key={comment.id}
                elevation={0}
                sx={{ p: 2.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Avatar sx={{ width: 36, height: 36, fontSize: "0.9rem" }}>
                    {comment.authorName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2" fontWeight={700}>
                        {comment.authorName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(comment.createdAt)}
                      </Typography>
                    </Stack>
                    {comment.rating ? <StarRating value={comment.rating} size={14} /> : null}
                    <Typography variant="body2" color="text.secondary">
                      {comment.body}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
            ))}
        </Stack>
      )}
    </Stack>
  );
}
