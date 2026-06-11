"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import { api, ApiClientError, UpdateProductPayload } from "@/lib/api";
import { Product, UserRole } from "@/types/types";
import { formatPrice } from "@/lib/ghana";

interface ProductsTableProps {
  products: Product[];
  filter: string;
  role: UserRole;
  userId: string;
}

type FilterTab = "all" | "blacklisted" | "finished";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "blacklisted", label: "Blacklisted" },
  { value: "finished", label: "Finished (no stock)" },
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

interface ImageEntry {
  id: string;
  preview: string;
  url: string | null;
  status: "uploading" | "done" | "error";
  error?: string;
}

const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const PencilIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export function ProductsTable({ products, filter, role, userId }: ProductsTableProps) {
  const router = useRouter();
  const isAdmin = role === "admin";
  const currentFilter = (FILTER_TABS.some((t) => t.value === filter) ? filter : "all") as FilterTab;

  const visibleProducts = React.useMemo(() => {
    if (currentFilter === "blacklisted") return products.filter((p) => p.isBlacklisted);
    if (currentFilter === "finished") return products.filter((p) => p.stock === 0);
    return products;
  }, [products, currentFilter]);

  const [deleteTarget, setDeleteTarget] = React.useState<Product | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState("");

  const [blacklistTarget, setBlacklistTarget] = React.useState<Product | null>(null);
  const [blacklisting, setBlacklisting] = React.useState(false);
  const [blacklistError, setBlacklistError] = React.useState("");

  const [editTarget, setEditTarget] = React.useState<Product | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editPrice, setEditPrice] = React.useState("");
  const [editDiscount, setEditDiscount] = React.useState("");
  const [editStock, setEditStock] = React.useState("");
  const [editBadge, setEditBadge] = React.useState("");
  const [editTags, setEditTags] = React.useState("");
  const [editCategoryName, setEditCategoryName] = React.useState("");
  const [editBrandName, setEditBrandName] = React.useState("");
  const [editCollectionName, setEditCollectionName] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);
  const [editError, setEditError] = React.useState("");

  const [imagesTarget, setImagesTarget] = React.useState<Product | null>(null);
  const [imageEntries, setImageEntries] = React.useState<ImageEntry[]>([]);
  const [imagesSaving, setImagesSaving] = React.useState(false);
  const [imagesError, setImagesError] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const canManage = (p: Product) => isAdmin || p.sellerId === userId;

  const openEdit = (product: Product) => {
    setEditTarget(product);
    setEditName(product.name);
    setEditDescription(product.description);
    setEditPrice(String(product.price));
    setEditDiscount(String(product.discount));
    setEditStock(String(product.stock));
    setEditBadge(product.badge ?? "");
    setEditTags(product.tags.join(", "));
    setEditCategoryName(product.category);
    setEditBrandName(product.brand);
    setEditCollectionName(product.collection ?? "");
    setEditError("");
  };

  const openAddImages = (product: Product) => {
    setImagesTarget(product);
    setImageEntries(
      product.images.map((url) => ({
        id: url,
        preview: url,
        url,
        status: "done" as const,
      }))
    );
    setImagesError("");
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    setEditError("");
    try {
      const payload: UpdateProductPayload = {};
      if (editName.trim() !== editTarget.name) payload.name = editName.trim();
      if (editDescription.trim() !== editTarget.description) payload.description = editDescription.trim();
      if (Number(editPrice) !== editTarget.price) payload.price = Number(editPrice);
      if (Number(editDiscount) !== editTarget.discount) payload.discount = Number(editDiscount);
      if (Number(editStock) !== editTarget.stock) payload.stock = Number(editStock);
      if (editBadge.trim() !== (editTarget.badge ?? "")) payload.badge = editBadge.trim() || null;
      const newTags = editTags.split(/[\n,]+/).map((t) => t.trim()).filter(Boolean);
      if (JSON.stringify(newTags) !== JSON.stringify(editTarget.tags)) payload.tags = newTags;
      if (editCategoryName.trim() !== editTarget.category) payload.categoryName = editCategoryName.trim();
      if (editBrandName.trim() !== editTarget.brand) payload.brandName = editBrandName.trim();
      if (editCollectionName.trim() !== (editTarget.collection ?? "")) payload.collectionName = editCollectionName.trim() || undefined;
      await api.updateProduct(editTarget.id, payload);
      setEditTarget(null);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof ApiClientError ? err.message : "Failed to save changes.");
    } finally {
      setEditSaving(false);
    }
  };

  const uploadFile = React.useCallback(async (file: File) => {
    const id = crypto.randomUUID();
    const preview = URL.createObjectURL(file);
    setImageEntries((prev) => [...prev, { id, preview, url: null, status: "uploading" }]);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/products/images", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setImageEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, url: data.url, status: "done" } : e))
      );
    } catch (err) {
      const error = err instanceof Error ? err.message : "Upload failed";
      setImageEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: "error", error } : e))
      );
    }
  }, []);

  const handleImageFiles = React.useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file) => {
        if (ACCEPTED_MIME.includes(file.type) && file.size <= MAX_FILE_BYTES) uploadFile(file);
      });
    },
    [uploadFile]
  );

  const removeImage = (id: string) => {
    setImageEntries((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry && !entry.url?.startsWith("http")) URL.revokeObjectURL(entry.preview);
      return prev.filter((e) => e.id !== id);
    });
  };

  const handleImagesSave = async () => {
    if (!imagesTarget) return;
    const urls = imageEntries.filter((e) => e.status === "done" && e.url).map((e) => e.url!);
    if (!urls.length) { setImagesError("At least one image is required."); return; }
    setImagesSaving(true);
    setImagesError("");
    try {
      await api.updateProduct(imagesTarget.id, { images: urls });
      setImagesTarget(null);
      router.refresh();
    } catch (err) {
      setImagesError(err instanceof ApiClientError ? err.message : "Failed to save images.");
    } finally {
      setImagesSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteProduct(deleteTarget.id);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof ApiClientError ? err.message : "Failed to delete product.");
    } finally {
      setDeleting(false);
    }
  };

  const handleBlacklist = async () => {
    if (!blacklistTarget) return;
    setBlacklisting(true);
    setBlacklistError("");
    try {
      await api.blacklistProduct(blacklistTarget.id, !blacklistTarget.isBlacklisted);
      setBlacklistTarget(null);
      router.refresh();
    } catch (err) {
      setBlacklistError(err instanceof ApiClientError ? err.message : "Failed to update blacklist status.");
    } finally {
      setBlacklisting(false);
    }
  };

  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [menuProduct, setMenuProduct] = React.useState<Product | null>(null);

  const openActionMenu = (e: React.MouseEvent<HTMLElement>, product: Product) => {
    setMenuAnchor(e.currentTarget);
    setMenuProduct(product);
  };
  const closeActionMenu = () => {
    setMenuAnchor(null);
    setMenuProduct(null);
  };

  return (
    <>
      <Tabs
        value={currentFilter}
        sx={{ borderBottom: 1, borderColor: "divider" }}
        textColor="primary"
        indicatorColor="primary"
      >
        {FILTER_TABS.map((tab) => (
          <Tab
            key={tab.value}
            label={tab.label}
            value={tab.value}
            component={Link}
            href={`?filter=${tab.value}`}
            sx={{ textTransform: "none", fontWeight: 700 }}
          />
        ))}
      </Tabs>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Table sx={{ minWidth: 1060 }}>
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Inventory</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleProducts.map((product) => (
              <TableRow
                key={product.id}
                hover
                sx={product.isBlacklisted ? { opacity: 0.6, bgcolor: "action.hover" } : undefined}
              >
                <TableCell sx={{ minWidth: 240 }}>
                  <Stack spacing={0.75}>
                    <Typography
                      component="a"
                      href={`/products/${product.slug}`}
                      sx={{
                        color: "text.primary",
                        textDecoration: "none",
                        fontWeight: 900,
                        "&:hover": { color: "primary.main" },
                      }}
                    >
                      {product.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {product.category} · {product.brand}
                      {product.collection ? ` · ${product.collection}` : ""}
                    </Typography>
                    {product.isBlacklisted ? (
                      <Chip label="Blacklisted" color="error" size="small" sx={{ width: "fit-content" }} />
                    ) : null}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip
                      label={product.inStock ? "In stock" : "Out of stock"}
                      color={product.inStock ? "success" : "default"}
                      size="small"
                    />
                    {product.discount > 0 ? (
                      <Chip label={`${product.discount}% off`} size="small" variant="outlined" />
                    ) : null}
                    {product.badge ? (
                      <Chip label={product.badge} size="small" variant="outlined" />
                    ) : null}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={700}>{product.stock}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {product.variants.length} variant{product.variants.length === 1 ? "" : "s"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={700}>{formatPrice(product.price)}</Typography>
                  {product.originalPrice ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textDecoration: "line-through" }}>
                      {formatPrice(product.originalPrice)}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    {product.tags.length ? (
                      product.tags.slice(0, 3).map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">No tags</Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>{formatDate(product.createdAt)}</TableCell>
                <TableCell align="right">
                  {canManage(product) ? (
                    <IconButton size="small" onClick={(e) => openActionMenu(e, product)} sx={{ cursor: "pointer" }}>
                      <PencilIcon />
                    </IconButton>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {visibleProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Stack spacing={1.5} alignItems="flex-start" sx={{ py: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {currentFilter === "blacklisted"
                        ? "No blacklisted products"
                        : currentFilter === "finished"
                          ? "No out-of-stock products"
                          : "No products yet"}
                    </Typography>
                    {currentFilter === "all" ? (
                      <>
                        <Typography variant="body2" color="text.secondary">
                          Add your first product to start shaping the catalog.
                        </Typography>
                        <Button
                          href="/dashboard/products/new"
                          variant="contained"
                          sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                        >
                          Create your first product
                        </Button>
                      </>
                    ) : null}
                  </Stack>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Action menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeActionMenu}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <MenuItem onClick={() => { if (menuProduct) openEdit(menuProduct); closeActionMenu(); }}>
          Edit product
        </MenuItem>
        <MenuItem onClick={() => { if (menuProduct) openAddImages(menuProduct); closeActionMenu(); }}>
          Add more images
        </MenuItem>
        {isAdmin ? (
          menuProduct?.isBlacklisted ? (
            <MenuItem onClick={() => { setBlacklistTarget(menuProduct); closeActionMenu(); }}>
              Restore product
            </MenuItem>
          ) : (
            <MenuItem
              onClick={() => { if (menuProduct) { setBlacklistTarget(menuProduct); closeActionMenu(); } }}
              sx={{ color: "warning.main" }}
            >
              Blacklist product
            </MenuItem>
          )
        ) : null}
        <MenuItem
          onClick={() => { if (menuProduct) { setDeleteTarget(menuProduct); closeActionMenu(); } }}
          sx={{ color: "error.main" }}
        >
          Delete product
        </MenuItem>
      </Menu>

      {/* Edit dialog */}
      <Dialog open={Boolean(editTarget)} onClose={() => !editSaving && setEditTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Edit product</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {editError ? <Alert severity="error">{editError}</Alert> : null}
            <TextField label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} fullWidth required />
            <TextField label="Description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} multiline minRows={3} fullWidth />
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <TextField label="Price ($)" type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} slotProps={{ input: { inputProps: { min: 0, step: "0.01" } } }} />
              <TextField label="Discount %" type="number" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} slotProps={{ input: { inputProps: { min: 0, max: 90, step: 1 } } }} />
              <TextField label="Stock" type="number" value={editStock} onChange={(e) => setEditStock(e.target.value)} slotProps={{ input: { inputProps: { min: 0, step: 1 } } }} />
            </Box>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <TextField label="Category" value={editCategoryName} onChange={(e) => setEditCategoryName(e.target.value)} />
              <TextField label="Brand" value={editBrandName} onChange={(e) => setEditBrandName(e.target.value)} />
              <TextField label="Collection" value={editCollectionName} onChange={(e) => setEditCollectionName(e.target.value)} />
            </Box>
            <TextField label="Badge" value={editBadge} onChange={(e) => setEditBadge(e.target.value)} fullWidth />
            <TextField label="Tags (comma-separated)" value={editTags} onChange={(e) => setEditTags(e.target.value)} fullWidth helperText="e.g. featured, new, sale" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditTarget(null)} disabled={editSaving} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={editSaving || !editName.trim()} startIcon={editSaving ? <CircularProgress size={16} color="inherit" /> : null} sx={{ textTransform: "none", fontWeight: 900 }}>
            Save changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add images dialog */}
      <Dialog open={Boolean(imagesTarget)} onClose={() => !imagesSaving && setImagesTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Manage images — {imagesTarget?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {imagesError ? <Alert severity="error">{imagesError}</Alert> : null}
            <input ref={fileInputRef} type="file" accept={ACCEPTED_MIME.join(",")} multiple style={{ display: "none" }} onChange={(e) => handleImageFiles(e.target.files)} />
            <Box
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleImageFiles(e.dataTransfer.files); }}
              sx={{ border: "2px dashed", borderColor: "divider", borderRadius: 2, p: 3, textAlign: "center", cursor: "pointer", "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" } }}
            >
              <Typography variant="body2" color="text.secondary">
                Click or drag to upload images (JPEG, PNG, WebP · max 5 MB each)
              </Typography>
            </Box>
            {imageEntries.length > 0 ? (
              <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}>
                {imageEntries.map((entry) => (
                  <Box key={entry.id} sx={{ position: "relative" }}>
                    <Box component="img" src={entry.preview} alt="" sx={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 1, opacity: entry.status === "uploading" ? 0.5 : 1 }} />
                    {entry.status === "uploading" ? (
                      <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <CircularProgress size={20} />
                      </Box>
                    ) : (
                      <IconButton size="small" onClick={() => removeImage(entry.id)} sx={{ position: "absolute", top: 2, right: 2, bgcolor: "background.paper", cursor: "pointer", "&:hover": { bgcolor: "error.main", color: "common.white" } }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Box>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              {imageEntries.filter((e) => e.status === "done").length} image{imageEntries.filter((e) => e.status === "done").length === 1 ? "" : "s"} ready
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setImagesTarget(null)} disabled={imagesSaving} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={handleImagesSave} disabled={imagesSaving || imageEntries.some((e) => e.status === "uploading")} startIcon={imagesSaving ? <CircularProgress size={16} color="inherit" /> : null} sx={{ textTransform: "none", fontWeight: 900 }}>
            Save images
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Delete product?</DialogTitle>
        <DialogContent>
          {deleteError ? <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert> : null}
          <Typography><strong>{deleteTarget?.name}</strong> will be permanently removed. This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting} startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : null} sx={{ textTransform: "none", fontWeight: 900 }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Blacklist/Restore confirmation */}
      <Dialog open={Boolean(blacklistTarget)} onClose={() => !blacklisting && setBlacklistTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>
          {blacklistTarget?.isBlacklisted ? "Restore product?" : "Blacklist product?"}
        </DialogTitle>
        <DialogContent>
          {blacklistError ? <Alert severity="error" sx={{ mb: 2 }}>{blacklistError}</Alert> : null}
          <Typography>
            {blacklistTarget?.isBlacklisted
              ? `Remove the blacklist on "${blacklistTarget?.name}" and make it visible in the storefront again?`
              : `Blacklisting "${blacklistTarget?.name}" will hide it from the storefront immediately.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setBlacklistTarget(null)} disabled={blacklisting} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" color={blacklistTarget?.isBlacklisted ? "primary" : "warning"} onClick={handleBlacklist} disabled={blacklisting} startIcon={blacklisting ? <CircularProgress size={16} color="inherit" /> : null} sx={{ textTransform: "none", fontWeight: 900 }}>
            {blacklistTarget?.isBlacklisted ? "Restore" : "Blacklist"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
