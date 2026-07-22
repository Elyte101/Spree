"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "react-query";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import { InfoOutlined } from "@mui/icons-material";
import { ResponsiveDisclosurePanel } from "@/components/ui/responsiveDisclosurePanel";
import { api, ApiClientError } from "@/lib/api";
import { calcCommission } from "@/lib/pricing";
import { Brand, Category, Collection } from "@/types/types";
import { formatPrice } from "@/lib/ghana";

interface ProductCreateFormProps {
  categories: Category[];
  brands: Brand[];
  collections: Collection[];
}

interface ImageEntry {
  id: string;
  preview: string;
  url: string | null;
  status: "uploading" | "done" | "error";
  error?: string;
}

const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"];

const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Fixed, select-only option sets — colors and sizes are picked, never typed,
// so listings stay consistent and filterable instead of accumulating one-off
// spellings ("Navy" vs "navy blue" vs "Dark Blue").
const COLOR_OPTIONS = [
  "Black", "White", "Gray", "Silver", "Gold",
  "Red", "Maroon", "Pink", "Orange", "Yellow",
  "Green", "Olive", "Teal", "Turquoise", "Blue", "Navy",
  "Purple", "Lavender", "Brown", "Beige", "Cream",
  "Multicolor", "Ankara Print", "Kente Print",
];

const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
const SHOE_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];
const KIDS_AGE_SIZES = [
  "0-3 months", "3-6 months", "6-12 months",
  "1-2 years", "2-4 years", "4-6 years", "6-8 years", "8-10 years", "10-12 years",
];
// Sold-by-length goods (fabric, rope, timber, wiring…) — covers every unit
// these actually get cut/quoted in, rather than forcing one.
const LENGTH_SIZES = [
  "1 yard", "2 yards", "3 yards", "6 yards (full piece)",
  "1 meter", "2 meters", "3 meters", "5 meters", "10 meters",
  "12 inches", "24 inches", "36 inches",
  "1 foot", "3 feet", "6 feet",
];

// Keyed by main-category slug (see backend/app/db/init_db.py's
// _CATEGORY_TAXONOMY) — categories with no entry here simply show no Sizes
// field at all, since a generic size concept doesn't apply to them.
const SIZE_OPTIONS_BY_MAIN_CATEGORY_SLUG: Record<string, string[]> = {
  "fashion-apparel": CLOTHING_SIZES,
  "shoes-footwear": SHOE_SIZES,
  "baby-kids": KIDS_AGE_SIZES,
  "fabrics-textiles": LENGTH_SIZES,
  "tools-hardware": LENGTH_SIZES,
};

const splitList = (value: string) =>
  value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const buildSuggestions = (values: string[]) => values.join(", ");

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);

export function ProductCreateForm({
  categories,
  brands,
  collections,
}: ProductCreateFormProps) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [discount, setDiscount] = React.useState("0");
  const [stock, setStock] = React.useState("");
  const [mainCategoryId, setMainCategoryId] = React.useState("");
  const [subcategoryId, setSubcategoryId] = React.useState("");
  const [brandName, setBrandName] = React.useState("");
  const [collectionName, setCollectionName] = React.useState("");
  const [badge, setBadge] = React.useState("");
  const [imageEntries, setImageEntries] = React.useState<ImageEntry[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [colorOptions, setColorOptions] = React.useState<string[]>([]);
  const [sizeOptions, setSizeOptions] = React.useState<string[]>([]);
  const [tags, setTags] = React.useState("");
  const [featureOnHomepage, setFeatureOnHomepage] = React.useState(false);
  const [markAsNewArrival, setMarkAsNewArrival] = React.useState(false);

  const mainCategories = categories.filter((c) => !c.parentId);
  const subcategories = categories.filter((c) => c.parentId === mainCategoryId);
  const selectedMainCategory = mainCategories.find((c) => c.id === mainCategoryId);
  const availableSizeOptions = selectedMainCategory
    ? SIZE_OPTIONS_BY_MAIN_CATEGORY_SLUG[selectedMainCategory.slug] ?? []
    : [];

  const brandSuggestions = buildSuggestions(brands.map((brand) => brand.name));
  const collectionSuggestions = buildSuggestions(
    collections.map((collection) => collection.name)
  );
  const uploadedImages = imageEntries.filter((e) => e.status === "done" && e.url).map((e) => e.url!);
  const customTags = splitList(tags);
  const computedTags = Array.from(
    new Set([
      ...customTags,
      ...(featureOnHomepage ? ["featured"] : []),
      ...(markAsNewArrival ? ["new"] : []),
    ])
  );
  const previewSlug = slugify(slug || name) || "product-handle";
  const previewPrice = Number(price) || 0;
  const previewDiscount = Number(discount) || 0;
  const { commission: commissionAmount, effectiveRate: commissionRate, customerPays: buyerPrice } =
    calcCommission(previewPrice);
  const compareAtPrice =
    previewDiscount > 0 && previewDiscount < 100
      ? previewPrice / (1 - previewDiscount / 100)
      : null;
  const estimatedVariantCount =
    colorOptions.length && sizeOptions.length
      ? colorOptions.length * sizeOptions.length
      : Math.max(colorOptions.length, sizeOptions.length, 1);
  const hasRequiredFields = Boolean(
    name.trim() &&
      description.trim() &&
      Number(price) > 0 &&
      stock.trim() !== "" &&
      subcategoryId &&
      brandName.trim() &&
      uploadedImages.length
  );

  // Keep a ref so the uploadFile callback always reads the latest name
  // without needing to be recreated on every keystroke.
  const nameRef = React.useRef(name);
  nameRef.current = name;

  const uploadFile = React.useCallback(async (file: File) => {
    const id = crypto.randomUUID();
    const preview = URL.createObjectURL(file);
    setImageEntries((prev) => [...prev, { id, preview, url: null, status: "uploading" }]);
    try {
      const body = new FormData();
      body.append("file", file);
      if (nameRef.current.trim()) body.append("productName", nameRef.current.trim());
      const res = await fetch("/api/products/images", { method: "POST", body });
      const data: { url?: string; error?: string; issues?: string[] } = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          data.issues?.length
            ? `${data.error ?? "Image rejected"}: ${data.issues.join(" · ")}`
            : (data.error ?? "Upload failed");
        throw new Error(message);
      }
      setImageEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, url: data.url!, status: "done" } : e))
      );
    } catch (err) {
      const error = err instanceof Error ? err.message : "Upload failed";
      setImageEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: "error", error } : e))
      );
    }
  }, []);

  const handleFiles = React.useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file) => {
        if (ACCEPTED_MIME.includes(file.type) && file.size <= MAX_FILE_BYTES) {
          uploadFile(file);
        }
      });
    },
    [uploadFile]
  );

  const removeImage = React.useCallback((id: string) => {
    setImageEntries((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry) URL.revokeObjectURL(entry.preview);
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const createProductMutation = useMutation(api.createProduct, {
    onSuccess: () => {
      router.push("/dashboard/products");
      router.refresh();
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await createProductMutation.mutateAsync({
      slug: slug.trim() || undefined,
      name,
      description,
      price: Number(price),
      discount: Number(discount),
      images: uploadedImages,
      categoryId: subcategoryId,
      brandName: brandName.trim(),
      collectionName: collectionName.trim() || undefined,
      stock: Number(stock),
      variants: [],
      colors: colorOptions,
      sizes: sizeOptions,
      badge: badge.trim() || undefined,
      tags: computedTags,
    });
  };

  const cardSx = {
    p: { xs: 2.5, md: 3 },
    borderRadius: 2,
    border: "1px solid",
    borderColor: "divider",
  } as const;

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={cardSx}>
        <Box>
          <Chip label="Product editor" color="primary" sx={{ mb: 1.5, borderRadius: 999 }} />
          <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1 }}>
            Create a product
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Build the core product details, merchandising setup, and discovery signals in one pass.
          </Typography>
        </Box>
      </Paper>

      {createProductMutation.error ? (
        <Alert severity="error">
          {createProductMutation.error instanceof ApiClientError
            ? createProductMutation.error.message
            : "We couldn’t create that product."}
        </Alert>
      ) : null}

      <Stack component="form" spacing={3} onSubmit={handleSubmit}>
        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.35fr) 340px" },
            alignItems: "start",
          }}
        >
          <Stack spacing={3}>
            <Paper elevation={0} sx={cardSx}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Basics
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Start with the title, handle, and description your storefront will show first.
                  </Typography>
                </Box>
                <TextField
                  label="Product name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
                <TextField
                  label="Handle / slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  helperText={`Preview URL: /products/${previewSlug}`}
                />
                <TextField
                  label="Description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  multiline
                  minRows={5}
                  required
                />
              </Stack>
            </Paper>

            <Paper elevation={0} sx={cardSx}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Media
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add one or more photos. The first image becomes the lead visual across the shop.
                  </Typography>
                </Box>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => handleFiles(e.target.files)}
                />

                {/* Drop zone */}
                <Box
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
                  sx={{
                    border: "2px dashed",
                    borderColor: isDragging ? "primary.main" : "divider",
                    borderRadius: 2,
                    p: 4,
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "border-color 150ms, background-color 150ms",
                    bgcolor: isDragging ? "action.hover" : "transparent",
                    "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
                  }}
                >
                  <Box sx={{ mb: 1.5, color: "text.disabled" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Click to browse or drag and drop
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    JPEG · PNG · WebP · max 5 MB per file
                  </Typography>
                </Box>

                {/* Thumbnail grid */}
                {imageEntries.length > 0 && (
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
                    }}
                  >
                    {imageEntries.map((entry, index) => (
                      <Box
                        key={entry.id}
                        sx={{
                          position: "relative",
                          aspectRatio: "1",
                          borderRadius: 1.5,
                          overflow: "hidden",
                          border: "1px solid",
                          borderColor:
                            entry.status === "error" ? "error.main" : "divider",
                        }}
                      >
                        <Box
                          component="img"
                          src={entry.preview}
                          alt={`Product image ${index + 1}`}
                          sx={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                            opacity: entry.status === "uploading" ? 0.4 : 1,
                            transition: "opacity 200ms",
                          }}
                        />
                        {entry.status === "uploading" && (
                          <Box
                            sx={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <CircularProgress size={20} />
                          </Box>
                        )}
                        {entry.status === "error" && (
                          <Box
                            sx={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              bgcolor: "rgba(0,0,0,0.5)",
                            }}
                          >
                            <Typography variant="caption" sx={{ color: "error.light", textAlign: "center", px: 0.5 }}>
                              {entry.error ?? "Failed"}
                            </Typography>
                          </Box>
                        )}
                        {index === 0 && entry.status === "done" && (
                          <Chip
                            label="Lead"
                            size="small"
                            color="primary"
                            sx={{
                              position: "absolute",
                              bottom: 4,
                              left: 4,
                              height: 18,
                              fontSize: 10,
                              borderRadius: 999,
                              "& .MuiChip-label": { px: 0.75 },
                            }}
                          />
                        )}
                        <IconButton
                          size="small"
                          onClick={() => removeImage(entry.id)}
                          aria-label="Remove image"
                          sx={{
                            position: "absolute",
                            top: 2,
                            right: 2,
                            width: 20,
                            height: 20,
                            bgcolor: "rgba(0,0,0,0.55)",
                            color: "common.white",
                            "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
              </Stack>
            </Paper>

            <Paper elevation={0} sx={cardSx}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Pricing and inventory
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Set the main selling price, promotional discount, and available stock.
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                  }}
                >
                  <TextField
                    label="Price (your payout)"
                    type="number"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    inputProps={{ min: 0, step: 0.01 }}
                    required
                  />
                  <TextField
                    label="Discount %"
                    type="number"
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                    inputProps={{ min: 0, max: 90, step: 0.01 }}
                    required
                  />
                  <TextField
                    label="Stock"
                    type="number"
                    value={stock}
                    onChange={(event) => setStock(event.target.value)}
                    inputProps={{ min: 0, step: 1 }}
                    required
                  />
                </Box>

                {previewPrice > 0 && (
                  <Box
                    sx={(theme) => ({
                      p: 2,
                      borderRadius: 2,
                      bgcolor: theme.palette.mode === "dark"
                        ? "rgba(101,90,255,0.08)"
                        : "rgba(101,90,255,0.05)",
                      border: "1px solid",
                      borderColor: "rgba(101,90,255,0.2)",
                    })}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.75} mb={1.5}>
                      <InfoOutlined sx={{ fontSize: 16, color: "primary.main" }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.main" }}>
                        Pricing breakdown
                      </Typography>
                    </Stack>
                    <Stack spacing={0.75}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Your payout</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatPrice(previewPrice)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Spree commission ({(commissionRate * 100).toFixed(1)}%)
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          + {formatPrice(commissionAmount)}
                        </Typography>
                      </Stack>
                      <Divider sx={{ my: 0.25 }} />
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" sx={{ fontWeight: 900 }}>
                          Customer pays
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 900, color: "primary.main" }}>
                          {formatPrice(buyerPrice)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Paper>

            <Paper elevation={0} sx={cardSx}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Organization
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Place the product into the right category, brand, and collection so it stays easy to find.
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <FormControl required>
                    <InputLabel id="create-main-category-label">Category</InputLabel>
                    <Select
                      labelId="create-main-category-label"
                      value={mainCategoryId}
                      label="Category"
                      onChange={(event) => {
                        setMainCategoryId(event.target.value);
                        setSubcategoryId("");
                        setSizeOptions([]);
                      }}
                    >
                      {mainCategories.map((category) => (
                        <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl required disabled={!mainCategoryId}>
                    <InputLabel id="create-subcategory-label">Subcategory</InputLabel>
                    <Select
                      labelId="create-subcategory-label"
                      value={subcategoryId}
                      label="Subcategory"
                      onChange={(event) => setSubcategoryId(event.target.value)}
                    >
                      {subcategories.map((category) => (
                        <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <TextField
                    label="Brand"
                    value={brandName}
                    onChange={(event) => setBrandName(event.target.value)}
                    inputProps={{ list: "brand-suggestions" }}
                    helperText={
                      brandSuggestions
                        ? `Try one of these brands: ${brandSuggestions}`
                        : "No brands yet. Your first entry will create one."
                    }
                    required
                  />
                  <TextField
                    label="Collection"
                    value={collectionName}
                    onChange={(event) => setCollectionName(event.target.value)}
                    inputProps={{ list: "collection-suggestions" }}
                    helperText={
                      collectionSuggestions
                        ? `Try one of these collections: ${collectionSuggestions}`
                        : "Optional. Leave this blank or add a new collection name."
                    }
                  />
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <TextField
                    label="Badge"
                    value={badge}
                    onChange={(event) => setBadge(event.target.value)}
                    helperText="Optional short label such as Best vendor or Limited"
                  />
                  <TextField
                    label="Tags"
                    helperText="Use commas or new lines for search and merchandising tags"
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                  />
                </Box>
              </Stack>
            </Paper>

            <Paper elevation={0} sx={cardSx}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Options and merchandising
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Define option values and decide if this item should be featured or presented as a new arrival.
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: availableSizeOptions.length
                      ? { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }
                      : "1fr",
                  }}
                >
                  <Autocomplete
                    multiple
                    options={COLOR_OPTIONS}
                    value={colorOptions}
                    onChange={(_event, value) => setColorOptions(value)}
                    renderInput={(params) => (
                      <TextField {...params} label="Colors" helperText="Pick every color this item comes in" />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => {
                        const { key, ...tagProps } = getTagProps({ index });
                        return <Chip key={key} label={option} size="small" {...tagProps} />;
                      })
                    }
                  />
                  {availableSizeOptions.length ? (
                    <Autocomplete
                      multiple
                      options={availableSizeOptions}
                      value={sizeOptions}
                      onChange={(_event, value) => setSizeOptions(value)}
                      renderInput={(params) => (
                        <TextField {...params} label="Sizes" helperText="Pick every size this item comes in" />
                      )}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => {
                          const { key, ...tagProps } = getTagProps({ index });
                          return <Chip key={key} label={option} size="small" {...tagProps} />;
                        })
                      }
                    />
                  ) : null}
                </Box>
                <Divider />
                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={featureOnHomepage}
                        onChange={(event) => setFeatureOnHomepage(event.target.checked)}
                      />
                    }
                    label="Feature on storefront"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={markAsNewArrival}
                        onChange={(event) => setMarkAsNewArrival(event.target.checked)}
                      />
                    }
                    label="Mark as new arrival"
                  />
                </Stack>
              </Stack>
            </Paper>

            <datalist id="brand-suggestions">
              {brands.map((brand) => (
                <option key={brand.id} value={brand.name} />
              ))}
            </datalist>
            <datalist id="collection-suggestions">
              {collections.map((collection) => (
                <option key={collection.id} value={collection.name} />
              ))}
            </datalist>
          </Stack>

          <Stack spacing={3}>
            <ResponsiveDisclosurePanel
              title="Product summary"
              collapseBelow="xl"
              paperSx={cardSx}
              action={
                <Chip
                  label={hasRequiredFields ? "Ready" : "Needs details"}
                  color={hasRequiredFields ? "success" : "warning"}
                  size="small"
                  sx={{ borderRadius: 999 }}
                />
              }
            >
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  A quick read on how the item is shaping up before you save it.
                </Typography>

                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip
                      label={hasRequiredFields ? "Ready to save" : "Needs more details"}
                      color={hasRequiredFields ? "success" : "warning"}
                      sx={{ mt: 0.75, borderRadius: 999 }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Handle
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                      {previewSlug}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Your payout
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                      {previewPrice > 0 ? formatPrice(previewPrice) : "Not set yet"}
                    </Typography>
                    {compareAtPrice ? (
                      <Typography variant="body2" color="text.secondary">
                        Compare at {formatPrice(compareAtPrice)}
                      </Typography>
                    ) : null}
                  </Box>

                  {previewPrice > 0 && (
                    <Box
                      sx={(theme) => ({
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: theme.palette.mode === "dark"
                          ? "rgba(101,90,255,0.08)"
                          : "rgba(101,90,255,0.05)",
                        border: "1px solid",
                        borderColor: "rgba(101,90,255,0.2)",
                      })}
                    >
                      <Stack spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">
                            Commission ({(commissionRate * 100).toFixed(1)}%)
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            +{formatPrice(commissionAmount)}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Customer pays
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.main" }}>
                            {formatPrice(buyerPrice)}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  )}

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Inventory
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                      {stock.trim() !== "" ? `${stock} units` : "Not set yet"}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Media
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                      {uploadedImages.length} image{uploadedImages.length === 1 ? "" : "s"}
                      {imageEntries.some((e) => e.status === "uploading") ? " (uploading…)" : ""}
                    </Typography>
                  </Box>
                </Stack>
              </Stack>
            </ResponsiveDisclosurePanel>

            <ResponsiveDisclosurePanel
              title="Merchandising signals"
              collapseBelow="xl"
              paperSx={cardSx}
            >
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  These option values and tags influence how the product is grouped and surfaced.
                </Typography>

                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Estimated variants
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                      {estimatedVariantCount}
                    </Typography>
                  </Box>

                  {colorOptions.length ? (
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                        Colors
                      </Typography>
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                        {colorOptions.map((color) => (
                          <Chip key={color} label={color} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </Box>
                  ) : null}

                  {sizeOptions.length ? (
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                        Sizes
                      </Typography>
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                        {sizeOptions.map((size) => (
                          <Chip key={size} label={size} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </Box>
                  ) : null}

                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                      Tags
                    </Typography>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      {computedTags.length ? (
                        computedTags.map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No tags yet
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Stack>
            </ResponsiveDisclosurePanel>

            <ResponsiveDisclosurePanel
              title="Publishing tips"
              collapseBelow="xl"
              paperSx={cardSx}
            >
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  Strong product pages usually have a clear title, multiple images, a clean category assignment, and a small tag set that means something.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Use `featured` for hero placement and `new` for fresh arrivals. Both switches above add those tags automatically.
                </Typography>
              </Stack>
            </ResponsiveDisclosurePanel>
          </Stack>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button
            type="submit"
            variant="contained"
            disabled={createProductMutation.isLoading}
            sx={{ borderRadius: 999, px: 3, textTransform: "none", fontWeight: 900 }}
          >
            {createProductMutation.isLoading ? "Saving product..." : "Save product"}
          </Button>
          <Button
            type="button"
            variant="outlined"
            onClick={() => router.push("/dashboard/products")}
            sx={{ borderRadius: 999, px: 3, textTransform: "none", fontWeight: 900 }}
          >
            Back to products
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
