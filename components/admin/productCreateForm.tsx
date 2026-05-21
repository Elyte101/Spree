"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import { ResponsiveDisclosurePanel } from "@/components/ui/responsiveDisclosurePanel";
import { api, ApiClientError } from "@/lib/api";
import { Brand, Category, Collection } from "@/types/types";

interface ProductCreateFormProps {
  categories: Category[];
  brands: Brand[];
  collections: Collection[];
}

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
  const [rating, setRating] = React.useState("0");
  const [reviewsCount, setReviewsCount] = React.useState("0");
  const [categoryName, setCategoryName] = React.useState("");
  const [brandName, setBrandName] = React.useState("");
  const [collectionName, setCollectionName] = React.useState("");
  const [badge, setBadge] = React.useState("");
  const [images, setImages] = React.useState("");
  const [colors, setColors] = React.useState("");
  const [sizes, setSizes] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [featureOnHomepage, setFeatureOnHomepage] = React.useState(false);
  const [markAsNewArrival, setMarkAsNewArrival] = React.useState(false);

  const categorySuggestions = buildSuggestions(categories.map((category) => category.name));
  const brandSuggestions = buildSuggestions(brands.map((brand) => brand.name));
  const collectionSuggestions = buildSuggestions(
    collections.map((collection) => collection.name)
  );
  const mediaEntries = splitList(images);
  const colorOptions = splitList(colors);
  const sizeOptions = splitList(sizes);
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
      categoryName.trim() &&
      brandName.trim() &&
      mediaEntries.length
  );

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
      images: mediaEntries,
      categoryName: categoryName.trim(),
      brandName: brandName.trim(),
      collectionName: collectionName.trim() || undefined,
      stock: Number(stock),
      rating: Number(rating),
      reviewsCount: Number(reviewsCount),
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
                    Add one or more image URLs. The first image becomes the lead visual across the shop.
                  </Typography>
                </Box>
                <TextField
                  label="Images"
                  helperText="Add image links separated by commas or new lines"
                  value={images}
                  onChange={(event) => setImages(event.target.value)}
                  multiline
                  minRows={4}
                  required
                />
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
                    label="Price"
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
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <TextField
                    label="Rating"
                    type="number"
                    value={rating}
                    onChange={(event) => setRating(event.target.value)}
                    inputProps={{ min: 0, max: 5, step: 0.1 }}
                  />
                  <TextField
                    label="Number of reviews"
                    type="number"
                    value={reviewsCount}
                    onChange={(event) => setReviewsCount(event.target.value)}
                    inputProps={{ min: 0, step: 1 }}
                  />
                </Box>
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
                    gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                  }}
                >
                  <TextField
                    label="Category"
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    inputProps={{ list: "category-suggestions" }}
                    helperText={
                      categorySuggestions
                        ? `Try one of these categories: ${categorySuggestions}`
                        : "No categories yet. Your first entry will create one."
                    }
                    required
                  />
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
                    helperText="Optional short label such as Best Seller or Limited"
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
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <TextField
                    label="Colors"
                    helperText="Comma-separated or one per line"
                    value={colors}
                    onChange={(event) => setColors(event.target.value)}
                  />
                  <TextField
                    label="Sizes"
                    helperText="Comma-separated or one per line"
                    value={sizes}
                    onChange={(event) => setSizes(event.target.value)}
                  />
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

            <datalist id="category-suggestions">
              {categories.map((category) => (
                <option key={category.id} value={category.name} />
              ))}
            </datalist>
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
                      Price
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                      {previewPrice > 0 ? `$${previewPrice.toFixed(2)}` : "Not set yet"}
                    </Typography>
                    {compareAtPrice ? (
                      <Typography variant="body2" color="text.secondary">
                        Compare at ${compareAtPrice.toFixed(2)}
                      </Typography>
                    ) : null}
                  </Box>

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
                      {mediaEntries.length} asset{mediaEntries.length === 1 ? "" : "s"}
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
