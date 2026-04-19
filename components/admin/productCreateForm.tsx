"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

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

export function ProductCreateForm({
  categories,
  brands,
  collections,
}: ProductCreateFormProps) {
  const router = useRouter();
  const [name, setName] = React.useState("");
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

  const categorySuggestions = buildSuggestions(categories.map((category) => category.name));
  const brandSuggestions = buildSuggestions(brands.map((brand) => brand.name));
  const collectionSuggestions = buildSuggestions(
    collections.map((collection) => collection.name)
  );

  const createProductMutation = useMutation(api.createProduct, {
    onSuccess: (product) => {
      router.push(`/products/${product.slug}`);
      router.refresh();
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await createProductMutation.mutateAsync({
      name,
      description,
      price: Number(price),
      discount: Number(discount),
      images: splitList(images),
      categoryName: categoryName.trim(),
      brandName: brandName.trim(),
      collectionName: collectionName.trim() || undefined,
      stock: Number(stock),
      rating: Number(rating),
      reviewsCount: Number(reviewsCount),
      variants: [],
      colors: splitList(colors),
      sizes: splitList(sizes),
      badge: badge.trim() || undefined,
      tags: splitList(tags),
    });
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 3, md: 4 },
        borderRadius: 4,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack spacing={3}>
        <Box>
          <Chip label="Product details" color="primary" sx={{ mb: 1.5, borderRadius: 999 }} />
          <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1 }}>
            Create a product
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Add a new item to your shop and group it by category, brand, or collection.
          </Typography>
        </Box>

        {createProductMutation.error ? (
          <Alert severity="error">
            {createProductMutation.error instanceof ApiClientError
              ? createProductMutation.error.message
              : "We couldn’t create that product."}
          </Alert>
        ) : null}

        <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
          <TextField
            label="Product name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />

          <TextField
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={4}
            required
          />

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

          <TextField
            label="Images"
            helperText="Add image links separated by commas or new lines"
            value={images}
            onChange={(event) => setImages(event.target.value)}
            multiline
            minRows={3}
            required
          />

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            }}
          >
            <TextField
              label="Colors"
              helperText="Comma-separated"
              value={colors}
              onChange={(event) => setColors(event.target.value)}
            />
            <TextField
              label="Sizes"
              helperText="Comma-separated"
              value={sizes}
              onChange={(event) => setSizes(event.target.value)}
            />
          </Box>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
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
            <TextField
              label="Badge"
              value={badge}
              onChange={(event) => setBadge(event.target.value)}
            />
          </Box>

          <TextField
            label="Tags"
            helperText="Use tags such as featured, new, or sale"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />

          <Stack direction="row" spacing={1.5}>
            <Button
              type="submit"
              variant="contained"
              disabled={createProductMutation.isLoading}
              sx={{ borderRadius: 999, px: 3, textTransform: "none", fontWeight: 800 }}
            >
              {createProductMutation.isLoading ? "Creating..." : "Create product"}
            </Button>
            <Button
              type="button"
              variant="outlined"
              onClick={() => router.push("/dashboard")}
              sx={{ borderRadius: 999, px: 3, textTransform: "none", fontWeight: 800 }}
            >
              Back to dashboard
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
