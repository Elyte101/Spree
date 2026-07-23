'use client';

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AutoAwesome,
  CategoryRounded,
  CloseRounded,
  Inventory2Outlined,
  SearchRounded,
  TuneRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Chip,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputBase,
  InputLabel,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Pagination,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Tooltip,
  Typography,
  MenuItem,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import { ProductCard } from "@/components/product/productCard";
import { CategoryMarquee } from "@/components/ui/categoryMarquee";
import { ScrollableChipRow } from "@/components/ui/scrollableChipRow";
import { useCatalogQuery } from "@/lib/hooks/useStorefrontQueries";
import { useCatalogFiltersStore } from "@/lib/stores/catalogFiltersStore";
import { ProductGridSkeleton } from "@/components/skeletons/productGridSkeleton";
import {
  Brand,
  CatalogResponse,
  CatalogSort,
  Collection,
  HomeFeed,
  SellerLocation,
} from "@/types/types";
import { formatPrice } from "@/lib/ghana";

interface ProductListingPageProps {
  initialCatalog: CatalogResponse;
  homeFeed: HomeFeed;
  brands: Brand[];
  collections: Collection[];
  sellerLocations: SellerLocation[];
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
  sellerLocations,
  initialSearch,
}: ProductListingPageProps) {
  const selectedBrand = useCatalogFiltersStore((state) => state.brand);
  const sellerCountry = useCatalogFiltersStore((state) => state.sellerCountry);
  const sellerRegion = useCatalogFiltersStore((state) => state.sellerRegion);
  const sort = useCatalogFiltersStore((state) => state.sort);
  const page = useCatalogFiltersStore((state) => state.page);
  const inStockOnly = useCatalogFiltersStore((state) => state.inStockOnly);
  const minPrice = useCatalogFiltersStore((state) => state.minPrice);
  const maxPrice = useCatalogFiltersStore((state) => state.maxPrice);
  const search = useCatalogFiltersStore((state) => state.search);
  const setSelectedBrand = useCatalogFiltersStore((state) => state.setBrand);
  const setSellerCountry = useCatalogFiltersStore((state) => state.setSellerCountry);
  const setSellerRegion = useCatalogFiltersStore((state) => state.setSellerRegion);
  const setSort = useCatalogFiltersStore((state) => state.setSort);
  const setPage = useCatalogFiltersStore((state) => state.setPage);
  const setInStockOnly = useCatalogFiltersStore((state) => state.setInStockOnly);
  const setMinPrice = useCatalogFiltersStore((state) => state.setMinPrice);
  const setMaxPrice = useCatalogFiltersStore((state) => state.setMaxPrice);
  const setSearch = useCatalogFiltersStore((state) => state.setSearch);
  const resetCatalogFilters = useCatalogFiltersStore((state) => state.reset);

  // category/collection have exactly ONE source of truth: the URL. No
  // Zustand state, no seed-on-mount, no reactive sync effect — chip
  // highlighting, the API params, and the address bar all derive from this
  // same read on every render, so they can never disagree with each other.
  // (Root cause of the "one click behind" bug: the previous design kept
  // category in a separate Zustand field, synced to the URL via a
  // useEffect. That effect's dependency-triggered re-run is itself a
  // scheduling hop *after* the state update it's reacting to — on a slow
  // connection or a rapid second click, the URL update, the store update,
  // and the react-query fetch could each be one step out of phase with the
  // others, since three independent state copies were involved instead of one.)
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Validated against the real lists (already available as props) so a
  // garbage/stale ?category= value falls back to "All" instead of silently
  // filtering to zero results with no chip highlighted.
  const rawCategory = searchParams.get("category") ?? "";
  const activeCategory = homeFeed.categories.some((c) => c.name === rawCategory) ? rawCategory : "";
  const rawCollection = searchParams.get("collection") ?? "";
  const activeCollection = collections.some((c) => c.slug === rawCollection) ? rawCollection : "";

  // Clicked value is used directly — never read back from activeCategory/
  // activeCollection within the same handler tick. searchParams itself is
  // safe to clone here (unlike the old effect) because it's read fresh from
  // this render's closure at the moment of the click, not from a ref or an
  // effect that fires on a later, possibly-stale render.
  const applyCategory = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("category", next);
    else params.delete("category");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setPage(1);
  };
  const applyCollection = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("collection", next);
    else params.delete("collection");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setPage(1);
  };

  // Seed the store from ?search= on first render so the header search bar
  // navigates correctly to /products?search=term.
  const initialSearchRef = React.useRef(initialSearch ?? "");
  React.useEffect(() => {
    if (initialSearchRef.current) {
      setSearch(initialSearchRef.current);
      setSearchInput(initialSearchRef.current);
    }
  // setSearch is a stable Zustand action — running once on mount is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ?search= in the URL in sync too, preserving whatever category/
  // collection are currently active. Skips the very first run (the mount
  // seed above). category/collection are read fresh from searchParams, not
  // from a stale snapshot, so this can't reapply an old filter either.
  const hasSkippedInitialSearchSync = React.useRef(false);
  React.useEffect(() => {
    if (!hasSkippedInitialSearchSync.current) {
      hasSkippedInitialSearchSync.current = true;
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set("search", search);
    else params.delete("search");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  // searchParams intentionally excluded: this effect only reacts to `search`
  // changing (from the debounced input below); including searchParams would
  // make our own router.replace() re-trigger it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, pathname, router]);

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
      category: activeCategory || undefined,
      brand: selectedBrand || undefined,
      collection: activeCollection || undefined,
      sellerCountry: sellerCountry || undefined,
      sellerRegion: sellerRegion || undefined,
      inStock: inStockOnly ? true : undefined,
      minPrice,
      maxPrice,
    }),
    [
      activeCategory, activeCollection, inStockOnly, maxPrice, minPrice, page, search,
      selectedBrand, sellerCountry, sellerRegion, sort,
    ]
  );

  const filtersMatchInitialCatalog =
    !search &&
    !activeCategory &&
    !selectedBrand &&
    !activeCollection &&
    !sellerCountry &&
    !sellerRegion &&
    !inStockOnly &&
    minPrice === undefined &&
    maxPrice === undefined &&
    sort === initialCatalog.sort &&
    page === initialCatalog.page;
  // Seed react-query with initialCatalog only on the render(s) before the
  // user has ever navigated away from the default filter state — not every
  // time the filters happen to match it again later. react-query v3's
  // keepPreviousData doesn't correctly hand off to a key that resolves via
  // initialData/cache instead of an actual fetch: reselecting "All" after
  // "Tech" issued zero network requests and stayed stuck showing Tech's
  // data forever, because there was no fetch promise for keepPreviousData
  // to resolve into. Once real fetches are involved on both sides of the
  // transition, keepPreviousData behaves correctly.
  const hasLeftDefaultFiltersRef = React.useRef(false);
  if (!filtersMatchInitialCatalog) {
    hasLeftDefaultFiltersRef.current = true;
  }
  const useInitialCatalog = filtersMatchInitialCatalog && !hasLeftDefaultFiltersRef.current;

  // Prefer backend-supplied price range; fall back to computing from the
  // first-page items when the backend returns the 0/0 placeholder default.
  const rawBoundsMin = initialCatalog.filters.priceRange.min;
  const rawBoundsMax = initialCatalog.filters.priceRange.max;
  const [boundsMin, boundsMax] = (() => {
    if (rawBoundsMin < rawBoundsMax) return [rawBoundsMin, rawBoundsMax];
    const prices = initialCatalog.items.map((p) => parseFloat(String(p.price))).filter((p) => p > 0);
    if (!prices.length) return [0, 0];
    return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))];
  })();
  const hasPriceBounds = boundsMax > boundsMin;
  const [localPriceRange, setLocalPriceRange] = React.useState<[number, number]>([
    minPrice ?? boundsMin,
    maxPrice ?? boundsMax,
  ]);

  React.useEffect(() => {
    if (minPrice === undefined && maxPrice === undefined) {
      setLocalPriceRange([boundsMin, boundsMax]);
    }
  }, [minPrice, maxPrice, boundsMin, boundsMax]);

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
      ? "Use search and filters to find what feels right for you."
      : "We're filling the shop with new items. Please check back soon.");

  React.useEffect(() => {
    if (catalog.totalPages > 0 && page > catalog.totalPages) {
      setPage(catalog.totalPages);
    }
  }, [catalog.totalPages, page, setPage]);

  const resetFilters = () => {
    resetCatalogFilters();
    setSearchInput("");
    // category/collection live only in the URL now, so clearing them means
    // clearing the URL directly — resetCatalogFilters() (Zustand) can't
    // touch them.
    router.replace(pathname, { scroll: false });
  };

  const suggestions = React.useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (q.length < 2) return [];
    const categoryMatches = homeFeed.categories
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((c) => ({ type: "category" as const, label: c.name, id: String(c.id) }));
    const productMatches = catalog.items
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((p) => ({ type: "product" as const, label: p.name, id: String(p.id) }));
    return [...categoryMatches, ...productMatches].slice(0, 7);
  }, [searchInput, catalog.items, homeFeed.categories]);

  const [filterDrawerOpen, setFilterDrawerOpen] = React.useState(false);
  const [searchFocused, setSearchFocused] = React.useState(false);
  // Blur-delay ref: onBlur sets a 200ms timeout before hiding suggestions.
  // onFocus and onMouseDown on a suggestion both cancel it, so clicking a
  // suggestion always fires before the dropdown disappears.
  const suggBlurTimer = React.useRef<number | null>(null);
  const hasActiveFilters = Boolean(
    activeCategory || selectedBrand || activeCollection || inStockOnly || sort !== "featured"
    || minPrice !== undefined || maxPrice !== undefined || sellerCountry || sellerRegion
  );
  const activeFilterCount = [
    activeCategory,
    selectedBrand,
    activeCollection,
    inStockOnly ? "stock" : "",
    sort !== "featured" ? "sort" : "",
    minPrice !== undefined || maxPrice !== undefined ? "price" : "",
    sellerCountry || sellerRegion ? "location" : "",
  ].filter(Boolean).length;
  const sellerCountries = React.useMemo(
    () => Array.from(new Set(sellerLocations.map((loc) => loc.country))).sort(),
    [sellerLocations]
  );
  const sellerRegionsForCountry = React.useMemo(
    () =>
      sellerLocations
        .filter((loc) => loc.country === sellerCountry)
        .map((loc) => loc.region)
        .sort(),
    [sellerLocations, sellerCountry]
  );

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
      })}
    >
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 3, md: 4 } }}>
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={(theme) => ({
            position: "relative",
            overflow: "hidden",
            borderRadius: 2,
            p: { xs: 1.75, md: 2.5 },
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
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            justifyContent="space-between"
            sx={{ position: "relative" }}
          >
            <Stack spacing={2} sx={{ minWidth: 0 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
                spacing={1.5}
                sx={{ width: "100%" }}
              >
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
              </Stack>
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
                <CategoryMarquee durationSeconds={32} gap={12} sx={{ maxWidth: "100%" }}>
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
                </CategoryMarquee>
              ) : null}
            </Stack>
            {/*<Paper
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
            </Paper>*/}
          </Stack>
        </Paper>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Tooltip title={hasActiveFilters ? `Filters (${activeFilterCount} active)` : "Filters"}>
            <IconButton
              onClick={() => setFilterDrawerOpen(true)}
              aria-label={hasActiveFilters ? `open filters, ${activeFilterCount} active` : "open filters"}
              sx={(theme) => ({
                border: "1.5px solid",
                borderColor: hasActiveFilters ? theme.palette.primary.main : theme.palette.divider,
                borderRadius: 2,
                width: 48,
                height: 48,
                color: hasActiveFilters ? "primary.main" : "text.secondary",
                bgcolor: hasActiveFilters
                  ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.08)
                  : theme.palette.background.paper,
                flexShrink: 0,
                transition: "border-color 0.18s ease, background-color 0.18s ease",
              })}
            >
              <TuneRounded />
            </IconButton>
          </Tooltip>

          <Box sx={{ flex: 1, position: "relative" }}>
            <Paper
              elevation={0}
              component="form"
              onSubmit={(e: React.BaseSyntheticEvent) => e.preventDefault()}
              sx={(theme) => ({
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 2,
                py: 0.75,
                borderRadius: 999,
                border: "1.5px solid",
                borderColor: theme.palette.divider,
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? alpha(theme.palette.common.white, 0.04)
                    : theme.palette.background.paper,
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                "&:focus-within": {
                  borderColor: "primary.main",
                  boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.1)}`,
                },
              })}
            >
              <SearchRounded sx={{ color: "text.secondary", flexShrink: 0 }} />
              <InputBase
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                onFocus={() => {
                  if (suggBlurTimer.current) window.clearTimeout(suggBlurTimer.current);
                  setSearchFocused(true);
                }}
                onBlur={() => {
                  suggBlurTimer.current = window.setTimeout(() => setSearchFocused(false), 200);
                }}
                placeholder="Search products, brands, tags…"
                fullWidth
                inputProps={{ "aria-label": "search products" }}
                sx={{ fontSize: "0.9375rem", py: 0.5 }}
              />
              {searchInput ? (
                <IconButton
                  size="small"
                  aria-label="clear search"
                  onClick={() => {
                    setSearchInput("");
                    setPage(1);
                  }}
                  sx={{ flexShrink: 0 }}
                >
                  <CloseRounded fontSize="small" />
                </IconButton>
              ) : null}
            </Paper>
            {searchFocused && suggestions.length > 0 ? (
              <Paper
                elevation={8}
                sx={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  zIndex: 1300,
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <List disablePadding>
                  {suggestions.map((s) => (
                    <ListItemButton
                      key={`${s.type}-${s.id}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (suggBlurTimer.current !== null) window.clearTimeout(suggBlurTimer.current);
                        if (s.type === "category") {
                          setSearchInput("");
                          applyCategory(s.label);
                        } else {
                          setSearchInput(s.label);
                        }
                        setSearchFocused(false);
                        setPage(1);
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {s.type === "category"
                          ? <CategoryRounded fontSize="small" color="primary" />
                          : <SearchRounded fontSize="small" sx={{ color: "text.secondary" }} />
                        }
                      </ListItemIcon>
                      <ListItemText
                        primary={s.label}
                        secondary={s.type === "category" ? "Category" : undefined}
                        slotProps={{
                          primary: { variant: "body2" },
                          secondary: { variant: "caption" },
                        }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            ) : null}
          </Box>
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
                  <ScrollableChipRow gap={8}>
                    <Chip
                      label="All"
                      clickable
                      color={activeCategory === ALL_FILTER_VALUE ? "primary" : "default"}
                      variant={activeCategory === ALL_FILTER_VALUE ? "filled" : "outlined"}
                      onClick={() => applyCategory(ALL_FILTER_VALUE)}
                    />
                    {homeFeed.categories.map((category) => (
                      <Chip
                        key={category.id}
                        label={category.name}
                        clickable
                        color={activeCategory === category.name ? "primary" : "default"}
                        variant={activeCategory === category.name ? "filled" : "outlined"}
                        onClick={() => applyCategory(category.name)}
                      />
                    ))}
                  </ScrollableChipRow>
                ) : null}

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {minPrice !== undefined || maxPrice !== undefined ? (
                    <Chip
                      label={`Price: ${formatPrice(minPrice ?? boundsMin)} – ${formatPrice(maxPrice ?? boundsMax)}`}
                      color="primary"
                      onDelete={() => { setMinPrice(undefined); setMaxPrice(undefined); }}
                    />
                  ) : null}
                  {search ? <Chip label={`Search: ${search}`} color="primary" /> : null}
                  {inStockOnly ? <Chip label="In stock only" color="success" /> : null}
                  {sellerCountry ? (
                    <Chip
                      label={`Location: ${sellerCountry}${sellerRegion ? `, ${sellerRegion}` : ""}`}
                      color="primary"
                      onDelete={() => setSellerCountry("")}
                    />
                  ) : null}
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
                  <ProductGridSkeleton count={PRODUCTS_PER_PAGE} dense />
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
                      {hasActiveFilters
                        ? "No products matched those filters"
                        : "More products are coming soon"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {hasActiveFilters
                        ? "Try widening your search or clearing a few filters."
                        : "Please check back soon for new arrivals."}
                    </Typography>
                    <Chip
                      label={hasActiveFilters ? "Reset filters" : "Go home"}
                      clickable
                      color="primary"
                      onClick={() => {
                        if (hasActiveFilters) {
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
                      gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    }}
                  >
                    {catalog.items.map((product) => (
                      <ProductCard key={product.id} product={product} size="micro" />
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

        <Drawer
          anchor="left"
          open={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          slotProps={{
            paper: {
              sx: { width: "min(86vw, 320px)", p: 2.5, boxSizing: "border-box" },
            },
          }}
        >
          <Stack spacing={2.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h6" sx={{ fontWeight: 900 }}>Filters</Typography>
              <IconButton size="small" onClick={() => setFilterDrawerOpen(false)} aria-label="close filters">
                <CloseRounded fontSize="small" />
              </IconButton>
            </Stack>

            <Chip label={`${catalog.total} items`} size="small" sx={{ borderRadius: 999, width: "fit-content" }} />

            <FormControl size="small" fullWidth>
              <InputLabel id="filter-sort-label">Sort by</InputLabel>
              <Select
                labelId="filter-sort-label"
                value={sort}
                label="Sort by"
                onChange={(event) => { setSort(event.target.value as CatalogSort); setPage(1); }}
              >
                {sortOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1.5, py: 1, borderRadius: 2, backgroundColor: "action.hover" }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Inventory2Outlined fontSize="small" />
                <Typography variant="body2">In stock only</Typography>
              </Stack>
              <Switch checked={inStockOnly} onChange={(event) => { setInStockOnly(event.target.checked); setPage(1); }} />
            </Stack>

            {hasPriceBounds ? (
              <Box sx={{ px: 0.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
                  <Typography variant="subtitle2">Price range</Typography>
                  {minPrice !== undefined || maxPrice !== undefined ? (
                    <Chip
                      size="small"
                      label="Reset"
                      onClick={() => { setMinPrice(undefined); setMaxPrice(undefined); }}
                      clickable
                      sx={{ borderRadius: 999, height: 22, fontSize: "0.7rem" }}
                    />
                  ) : null}
                </Stack>
                <Box sx={{ px: 1 }}>
                  <Slider
                    value={localPriceRange}
                    min={boundsMin}
                    max={boundsMax}
                    onChange={(_, value) => setLocalPriceRange(value as [number, number])}
                    onChangeCommitted={(_, value) => {
                      const [lo, hi] = value as [number, number];
                      setMinPrice(lo === boundsMin ? undefined : lo);
                      setMaxPrice(hi === boundsMax ? undefined : hi);
                    }}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => formatPrice(v)}
                    disableSwap
                  />
                </Box>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">{formatPrice(localPriceRange[0])}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatPrice(localPriceRange[1])}</Typography>
                </Stack>
              </Box>
            ) : null}

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.25 }}>Collections</Typography>
              {collections.length ? (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip label="All" clickable color={activeCollection === ALL_FILTER_VALUE ? "primary" : "default"} variant={activeCollection === ALL_FILTER_VALUE ? "filled" : "outlined"} onClick={() => applyCollection(ALL_FILTER_VALUE)} />
                  {collections.map((collection) => (
                    <Chip key={collection.id} label={collection.name} clickable color={activeCollection === collection.slug ? "primary" : "default"} variant={activeCollection === collection.slug ? "filled" : "outlined"} onClick={() => applyCollection(collection.slug)} />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No collections are available yet.</Typography>
              )}
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.25 }}>Brands</Typography>
              {brands.length ? (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip label="All" clickable color={selectedBrand === ALL_FILTER_VALUE ? "primary" : "default"} variant={selectedBrand === ALL_FILTER_VALUE ? "filled" : "outlined"} onClick={() => { setSelectedBrand(ALL_FILTER_VALUE); setPage(1); }} />
                  {brands.map((brand) => (
                    <Chip key={brand.id} label={brand.name} clickable color={selectedBrand === brand.name ? "primary" : "default"} variant={selectedBrand === brand.name ? "filled" : "outlined"} onClick={() => { setSelectedBrand(brand.name); setPage(1); }} />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No brands are available yet.</Typography>
              )}
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.25 }}>Seller location</Typography>
              {sellerCountries.length ? (
                <Stack spacing={1.5}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="filter-country-label">Country</InputLabel>
                    <Select
                      labelId="filter-country-label"
                      value={sellerCountry}
                      label="Country"
                      displayEmpty
                      onChange={(event) => setSellerCountry(event.target.value)}
                    >
                      <MenuItem value="">All countries</MenuItem>
                      {sellerCountries.map((country) => (
                        <MenuItem key={country} value={country}>{country}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {sellerCountry && sellerRegionsForCountry.length ? (
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip
                        label="All regions"
                        clickable
                        color={sellerRegion === ALL_FILTER_VALUE ? "primary" : "default"}
                        variant={sellerRegion === ALL_FILTER_VALUE ? "filled" : "outlined"}
                        onClick={() => setSellerRegion(ALL_FILTER_VALUE)}
                      />
                      {sellerRegionsForCountry.map((region) => (
                        <Chip
                          key={region}
                          label={region}
                          clickable
                          color={sellerRegion === region ? "primary" : "default"}
                          variant={sellerRegion === region ? "filled" : "outlined"}
                          onClick={() => setSellerRegion(region)}
                        />
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No seller locations are available yet.</Typography>
              )}
            </Box>

            <Chip label="Reset all filters" onClick={resetFilters} clickable variant="outlined" sx={{ width: "fit-content", borderRadius: 999 }} />
          </Stack>
        </Drawer>
      </Stack>
    </Box>
    </Box>
  );
}
