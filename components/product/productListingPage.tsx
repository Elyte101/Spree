'use client';

import * as React from "react";
import {
  AutoAwesome,
  Inventory2Outlined,
  SearchRounded,
  TuneRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Chip,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  LinearProgress,
  Pagination,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  MenuItem,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import { ProductCard } from "@/components/product/productCard";
import { ResponsiveDisclosurePanel } from "@/components/ui/responsiveDisclosurePanel";
import { useCatalogQuery } from "@/lib/hooks/useStorefrontQueries";
import { useCatalogFiltersStore } from "@/lib/stores/catalogFiltersStore";
import { ProductGridSkeleton } from "@/components/skeletons/productGridSkeleton";
import {
  Brand,
  CatalogResponse,
  CatalogSort,
  Collection,
  HomeFeed,
} from "@/types/types";
import { formatPrice } from "@/lib/ghana";

interface ProductListingPageProps {
  initialCatalog: CatalogResponse;
  homeFeed: HomeFeed;
  brands: Brand[];
  collections: Collection[];
  initialSearch?: string;
}

const sortOptions: Array<{ value: CatalogSort; label: string }> = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Top Rated" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

const PRODUCTS_PER_PAGE = 12;
const ALL_FILTER_VALUE = "";

export function ProductListingPage({
  initialCatalog,
  homeFeed,
  brands,
  collections,
  initialSearch,
}: ProductListingPageProps) {
  const selectedCategory = useCatalogFiltersStore((state) => state.category);
  const selectedBrand = useCatalogFiltersStore((state) => state.brand);
  const selectedCollection = useCatalogFiltersStore((state) => state.collection);
  const sort = useCatalogFiltersStore((state) => state.sort);
  const page = useCatalogFiltersStore((state) => state.page);
  const inStockOnly = useCatalogFiltersStore((state) => state.inStockOnly);
  const search = useCatalogFiltersStore((state) => state.search);
  const setSelectedCategory = useCatalogFiltersStore((state) => state.setCategory);
  const setSelectedBrand = useCatalogFiltersStore((state) => state.setBrand);
  const setSelectedCollection = useCatalogFiltersStore((state) => state.setCollection);
  const setSort = useCatalogFiltersStore((state) => state.setSort);
  const setPage = useCatalogFiltersStore((state) => state.setPage);
  const setInStockOnly = useCatalogFiltersStore((state) => state.setInStockOnly);
  const setSearch = useCatalogFiltersStore((state) => state.setSearch);
  const resetCatalogFilters = useCatalogFiltersStore((state) => state.reset);
  // Seed the store from a URL ?search= param on first render so the header
  // search bar navigates correctly to /products?search=term.
  const initialSearchRef = React.useRef(initialSearch ?? "");
  React.useEffect(() => {
    if (initialSearchRef.current) {
      setSearch(initialSearchRef.current);
      setSearchInput(initialSearchRef.current);
    }
  // setSearch is a stable Zustand action — running once on mount is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [searchInput, setSearchInput] = React.useState(initialSearch ?? search);
  const deferredSearch = React.useDeferredValue(searchInput.trim());

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchInput(search);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [search]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      React.startTransition(() => {
        setSearch(deferredSearch);
      });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [deferredSearch, setSearch]);

  const params = React.useMemo(
    () => ({
      page,
      limit: PRODUCTS_PER_PAGE,
      sort,
      search: search || undefined,
      category: selectedCategory || undefined,
      brand: selectedBrand || undefined,
      collection: selectedCollection || undefined,
      inStock: inStockOnly ? true : undefined,
    }),
    [inStockOnly, page, search, selectedBrand, selectedCategory, selectedCollection, sort]
  );

  const useInitialCatalog =
    !search &&
    !selectedCategory &&
    !selectedBrand &&
    !selectedCollection &&
    !inStockOnly &&
    sort === initialCatalog.sort &&
    page === initialCatalog.page;

  const catalogQuery = useCatalogQuery(
    params,
    useInitialCatalog ? initialCatalog : undefined
  );
  const catalog = catalogQuery.data ?? initialCatalog;
  const loading = catalogQuery.isLoading && !catalogQuery.data;
  const isFetching = catalogQuery.isFetching;
  const hasError = Boolean(catalogQuery.error);
  const hasProducts = catalog.total > 0;
  const heroTitle =
    homeFeed.hero?.title ??
    (hasProducts ? "Find your next favorite." : "More products are on the way.");
  const heroSubtitle =
    homeFeed.hero?.subtitle ??
    (hasProducts
      ? "Use search, filters, and sorting to narrow in on what feels right for you."
      : "We're filling the shop with new items. Please check back soon.");

  React.useEffect(() => {
    if (catalog.totalPages > 0 && page > catalog.totalPages) {
      setPage(catalog.totalPages);
    }
  }, [catalog.totalPages, page, setPage]);

  const resetFilters = () => {
    resetCatalogFilters();
    setSearchInput("");
  };

  return (
    <Box
      component="main"
      sx={(theme) => ({
        minHeight: "100vh",
        background: `radial-gradient(circle at top left, ${alpha(
          theme.palette.primary.main,
          theme.palette.mode === "dark" ? 0.22 : 0.12
        )}, transparent 30%), linear-gradient(180deg, ${
          theme.palette.background.default
        } 0%, ${theme.palette.background.paper} 100%)`,
        px: { xs: 1.5, sm: 3, md: 5 },
        py: { xs: 3, md: 5 },
      })}
    >
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={(theme) => ({
            position: "relative",
            overflow: "hidden",
            borderRadius: 2,
            p: { xs: 2.5, md: 4 },
            background: `linear-gradient(135deg, rgba(26, 26, 26, 0.96) 0%, ${alpha(
              theme.palette.primary.main,
              0.92
            )} 55%, ${alpha(theme.palette.secondary.main, 0.78)} 100%)`,
            color: theme.palette.common.white,
          })}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              opacity: 0.22,
              background:
                "radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0) 18%), radial-gradient(circle at 85% 20%, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 20%)",
            }}
          />
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={3}
            justifyContent="space-between"
            sx={{ position: "relative" }}
          >
            <Stack spacing={2} sx={{ maxWidth: 720 }}>
              <Chip
                icon={<AutoAwesome />}
                label={hasProducts ? "Shop the collection" : "More to come"}
                sx={(theme) => ({
                  width: "fit-content",
                  color: theme.palette.common.white,
                  backgroundColor: alpha(theme.palette.common.white, 0.14),
                  borderRadius: 999,
                })}
              />
              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
                {heroTitle}
              </Typography>
              <Typography
                variant="h6"
                sx={(theme) => ({
                  color: alpha(theme.palette.common.white, 0.84),
                  maxWidth: 560,
                })}
              >
                {heroSubtitle}
              </Typography>
              {homeFeed.categories.length ? (
                <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap">
                  {homeFeed.categories.map((category) => (
                    <Chip
                      key={category.id}
                      label={`${category.name} · ${category.itemCount}`}
                      variant="outlined"
                      sx={(theme) => ({
                        color: theme.palette.common.white,
                        borderColor: alpha(theme.palette.common.white, 0.28),
                      })}
                    />
                  ))}
                </Stack>
              ) : null}
            </Stack>
            <Paper
              elevation={0}
              sx={(theme) => ({
                minWidth: { sm: 220 },
                width: { xs: "100%", sm: "auto" },
                height: "10%",
                p: 2,
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.common.white, 0.12),
                color: theme.palette.common.white,
                backdropFilter: "blur(14px)",
              })}
            >
              <Typography
                variant="body2"
                sx={(theme) => ({
                  color: alpha(theme.palette.common.white, 0.72),
                })}
              >
                Available now
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                {catalog.total}
              </Typography>
              <Typography variant="body2">
                {hasProducts ? "products ready for browsing" : "products currently available"}
              </Typography>
            </Paper>
          </Stack>
        </Paper>

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", lg: "300px minmax(0, 1fr)" },
            alignItems: "start",
          }}
        >
          <Stack spacing={2.5}>
            <ResponsiveDisclosurePanel
              title="Filters"
              icon={<TuneRounded fontSize="small" />}
              action={<Chip label={`${catalog.total} items`} size="small" sx={{ borderRadius: 999 }} />}
              collapseBelow="lg"
              paperSx={{ borderRadius: 2 }}
            >
              <Stack spacing={2}>
                <TextField
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search products, brands, tags..."
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRounded fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                <FormControl size="small" fullWidth>
                  <InputLabel id="sort-products-label">Sort by</InputLabel>
                  <Select
                    labelId="sort-products-label"
                    value={sort}
                    label="Sort by"
                    onChange={(event) => {
                      setSort(event.target.value as CatalogSort);
                      setPage(1);
                    }}
                  >
                    {sortOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    backgroundColor: "action.hover",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Inventory2Outlined fontSize="small" />
                    <Typography variant="body2">In stock only</Typography>
                  </Stack>
                  <Switch
                    checked={inStockOnly}
                    onChange={(event) => {
                      setInStockOnly(event.target.checked);
                      setPage(1);
                    }}
                  />
                </Stack>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1.25 }}>
                    Collections
                  </Typography>
                  {collections.length ? (
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip
                        label="All"
                        clickable
                        color={selectedCollection === ALL_FILTER_VALUE ? "primary" : "default"}
                        variant={selectedCollection === ALL_FILTER_VALUE ? "filled" : "outlined"}
                        onClick={() => {
                          setSelectedCollection(ALL_FILTER_VALUE);
                          setPage(1);
                        }}
                      />
                      {collections.map((collection) => (
                        <Chip
                          key={collection.id}
                          label={collection.name}
                          clickable
                          color={selectedCollection === collection.slug ? "primary" : "default"}
                          variant={selectedCollection === collection.slug ? "filled" : "outlined"}
                          onClick={() => {
                            setSelectedCollection(collection.slug);
                            setPage(1);
                          }}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No collections are available yet.
                    </Typography>
                  )}
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1.25 }}>
                    Brands
                  </Typography>
                  {brands.length ? (
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip
                        label="All"
                        clickable
                        color={selectedBrand === ALL_FILTER_VALUE ? "primary" : "default"}
                        variant={selectedBrand === ALL_FILTER_VALUE ? "filled" : "outlined"}
                        onClick={() => {
                          setSelectedBrand(ALL_FILTER_VALUE);
                          setPage(1);
                        }}
                      />
                      {brands.map((brand) => (
                        <Chip
                          key={brand.id}
                          label={brand.name}
                          clickable
                          color={selectedBrand === brand.name ? "primary" : "default"}
                          variant={selectedBrand === brand.name ? "filled" : "outlined"}
                          onClick={() => {
                            setSelectedBrand(brand.name);
                            setPage(1);
                          }}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No brands are available yet.
                    </Typography>
                  )}
                </Box>

                <Chip
                  label="Reset all filters"
                  onClick={resetFilters}
                  clickable
                  variant="outlined"
                  sx={{ width: "fit-content", borderRadius: 999 }}
                />
              </Stack>
            </ResponsiveDisclosurePanel>

            <ResponsiveDisclosurePanel
              title="Shop by category"
              collapseBelow="lg"
              paperSx={{ borderRadius: 2 }}
            >
              {homeFeed.categories.length ? (
                <Stack spacing={1.5}>
                  {homeFeed.categories.map((category) => (
                    <Box
                      key={category.id}
                      onClick={() => {
                        setSelectedCategory(category.name);
                        setPage(1);
                      }}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor:
                          selectedCategory === category.name ? "primary.main" : "divider",
                        backgroundColor:
                          selectedCategory === category.name ? "action.selected" : "transparent",
                      }}
                    >
                      <Typography variant="subtitle2">{category.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {category.itemCount} items
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Categories will appear here as more items arrive.
                </Typography>
              )}
            </ResponsiveDisclosurePanel>
          </Stack>

          <Stack spacing={2.5}>
            <Paper
              elevation={0}
              sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3, border: "1px solid", borderColor: "divider" }}
            >
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  spacing={1.5}
                >
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                      Shop All Products
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Browse the latest items in the shop.
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Page {catalog.page} of {Math.max(catalog.totalPages, 1)}
                  </Typography>
                </Stack>

                {homeFeed.categories.length ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ display: { xs: "none", sm: "flex" } }}
                  >
                    <Chip
                      label="All"
                      clickable
                      color={selectedCategory === ALL_FILTER_VALUE ? "primary" : "default"}
                      variant={selectedCategory === ALL_FILTER_VALUE ? "filled" : "outlined"}
                      onClick={() => {
                        setSelectedCategory(ALL_FILTER_VALUE);
                        setPage(1);
                      }}
                    />
                    {homeFeed.categories.map((category) => (
                      <Chip
                        key={category.id}
                        label={category.name}
                        clickable
                        color={selectedCategory === category.name ? "primary" : "default"}
                        variant={selectedCategory === category.name ? "filled" : "outlined"}
                        onClick={() => {
                          setSelectedCategory(category.name);
                          setPage(1);
                        }}
                      />
                    ))}
                  </Stack>
                ) : null}

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    label={`Price range ${formatPrice(catalog.filters.priceRange.min)} - ${formatPrice(
                      catalog.filters.priceRange.max
                    )}`}
                    variant="outlined"
                  />
                  {search ? <Chip label={`Search: ${search}`} color="primary" /> : null}
                  {inStockOnly ? <Chip label="In stock only" color="success" /> : null}
                </Stack>
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
              {isFetching ? <LinearProgress /> : null}
              <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                {hasError ? (
                  <Alert
                    severity="error"
                    sx={{ mb: 2 }}
                    action={
                      <Chip
                        label="Retry"
                        clickable
                        color="error"
                        onClick={() => {
                          void catalogQuery.refetch();
                        }}
                      />
                    }
                  >
                    We couldn&apos;t refresh the products right now.
                  </Alert>
                ) : null}

                {loading ? (
                  <ProductGridSkeleton count={PRODUCTS_PER_PAGE} />
                ) : catalog.items.length === 0 ? (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 5,
                      textAlign: "center",
                      borderRadius: 2,
                      backgroundColor: "action.hover",
                    }}
                  >
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {search || selectedCategory || selectedBrand || selectedCollection || inStockOnly
                        ? "No products matched those filters"
                        : "More products are coming soon"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {search || selectedCategory || selectedBrand || selectedCollection || inStockOnly
                        ? "Try widening your search or clearing a few filters."
                        : "Please check back soon for new arrivals."}
                    </Typography>
                    <Chip
                      label={search || selectedCategory || selectedBrand || selectedCollection || inStockOnly ? "Reset filters" : "Go home"}
                      clickable
                      color="primary"
                      onClick={() => {
                        if (search || selectedCategory || selectedBrand || selectedCollection || inStockOnly) {
                          resetFilters();
                        } else {
                          window.location.href = "/";
                        }
                      }}
                    />
                  </Paper>
                ) : (
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
                    }}
                  >
                    {catalog.items.map((product) => (
                      <ProductCard key={product.id} product={product} size="compact" />
                    ))}
                  </Box>
                )}
              </Box>
            </Paper>

            {catalog.totalPages > 1 ? (
              <Stack alignItems="center" sx={{ pb: 2 }}>
                <Pagination
                  color="primary"
                  count={catalog.totalPages}
                  page={catalog.page}
                  onChange={(_, value) => setPage(value)}
                  shape="rounded"
                  sx={{
                    "& .MuiPagination-ul": {
                      flexWrap: "wrap",
                      justifyContent: "center",
                      rowGap: 0.5,
                    },
                  }}
                />
              </Stack>
            ) : null}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
