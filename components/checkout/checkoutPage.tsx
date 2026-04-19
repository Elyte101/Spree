'use client';

import * as React from "react";
import Link from "next/link";
import {
  CreditCardRounded,
  LockOutlined,
  LocalShippingRounded,
} from "@mui/icons-material";
import {
  Alert,
  alpha,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCart } from "@/components/providers/cartProvider";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

export function CheckoutPage() {
  const { cart } = useCart();
  const [shippingMethod, setShippingMethod] = React.useState("standard");
  const [paymentMethod, setPaymentMethod] = React.useState("card");
  const standardShipping = cart.standardShipping ?? cart.shipping;

  const shipping = cart.items.length === 0 ? 0 : shippingMethod === "express" ? 18 : cart.shipping;
  const total = Number((cart.subtotal + shipping + cart.tax).toFixed(2));

  return (
    <Box
      sx={(theme) => ({
        minHeight: "1500px",
        px: { xs: 1.5, sm: 3, md: 5 },
        py: { xs: 3, md: 5 },
        background: `radial-gradient(circle at top left, ${alpha(
          theme.palette.primary.main,
          theme.palette.mode === "dark" ? 0.16 : 0.08
        )}, transparent 24%), linear-gradient(180deg, ${
          theme.palette.background.default
        } 0%, ${theme.palette.background.paper} 100%)`,
      })}
    >
      <Stack spacing={4}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 4,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Chip
            icon={<LockOutlined />}
            label="Secure Checkout"
            color="primary"
            sx={{ mb: 1.5, borderRadius: 999 }}
          />
          <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
            Finish your purchase.
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Review your delivery details, confirm shipping, and move through the purchase flow with a live order summary.
          </Typography>
        </Paper>

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 360px" },
            alignItems: "start",
          }}
        >
          <Stack spacing={2.5}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2}>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  Contact details
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <TextField label="First name" defaultValue="Lyte" />
                  <TextField label="Last name" defaultValue="Storefront" />
                  <TextField label="Email" defaultValue="lyte@example.com" />
                  <TextField label="Phone" defaultValue="+1 555 202 1199" />
                  <TextField label="Address" defaultValue="1424 Market Street" sx={{ gridColumn: { md: "1 / -1" } }} />
                  <TextField label="City" defaultValue="San Francisco" />
                  <TextField label="Postal code" defaultValue="94103" />
                  <TextField select label="Country" defaultValue="US">
                    <MenuItem value="US">United States</MenuItem>
                    <MenuItem value="CA">Canada</MenuItem>
                    <MenuItem value="GB">United Kingdom</MenuItem>
                  </TextField>
                  <TextField select label="State" defaultValue="CA">
                    <MenuItem value="CA">California</MenuItem>
                    <MenuItem value="NY">New York</MenuItem>
                    <MenuItem value="TX">Texas</MenuItem>
                  </TextField>
                </Box>
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2}>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  Delivery method
                </Typography>
                <RadioGroup
                  value={shippingMethod}
                  onChange={(event) => setShippingMethod(event.target.value)}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      mb: 1,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: shippingMethod === "standard" ? "primary.main" : "divider",
                    }}
                  >
                    <FormControlLabel
                      value="standard"
                      control={<Radio />}
                      label={
                        <Stack>
                          <Typography fontWeight={700}>Standard shipping</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Arrives in 3-5 business days · {formatPrice(standardShipping)}
                          </Typography>
                        </Stack>
                      }
                    />
                  </Paper>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: shippingMethod === "express" ? "primary.main" : "divider",
                    }}
                  >
                    <FormControlLabel
                      value="express"
                      control={<Radio />}
                      label={
                        <Stack>
                          <Typography fontWeight={700}>Express shipping</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Arrives in 1-2 business days · {formatPrice(18)}
                          </Typography>
                        </Stack>
                      }
                    />
                  </Paper>
                </RadioGroup>
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 4,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2}>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  Payment method
                </Typography>
                <RadioGroup
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <FormControlLabel value="card" control={<Radio />} label="Credit or debit card" />
                  <FormControlLabel value="paypal" control={<Radio />} label="PayPal" />
                  <FormControlLabel value="wallet" control={<Radio />} label="Mobile wallet" />
                </RadioGroup>
                {paymentMethod === "card" ? (
                  <Box
                    sx={{
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                    }}
                  >
                    <TextField label="Card number" defaultValue="4242 4242 4242 4242" sx={{ gridColumn: { md: "1 / -1" } }} />
                    <TextField label="Expiry" defaultValue="08/29" />
                    <TextField label="CVC" defaultValue="424" />
                    <TextField label="Name on card" defaultValue="Lyte Storefront" sx={{ gridColumn: { md: "1 / -1" } }} />
                  </Box>
                ) : (
                  <Alert severity="info">
                    Payment processing is not connected yet, but the checkout structure is ready for a production payment integration.
                  </Alert>
                )}
                <FormControlLabel control={<Checkbox defaultChecked />} label="Save details for next time" />
              </Stack>
            </Paper>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: 4,
              border: "1px solid",
              borderColor: "divider",
              position: { xl: "sticky" },
              top: { xl: 96 },
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <LocalShippingRounded color="primary" />
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  Order summary
                </Typography>
              </Stack>

              {cart.items.length ? (
                cart.items.map((item) => (
                  <Stack
                    key={item.id}
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    spacing={0.5}
                  >
                    <Box>
                      <Typography fontWeight={700}>{item.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Qty {item.quantity}
                      </Typography>
                    </Box>
                    <Typography fontWeight={700}>
                      {formatPrice(item.price * item.quantity)}
                    </Typography>
                  </Stack>
                ))
              ) : (
                <Alert severity="info">
                  Your cart is empty. Add a product before completing checkout.
                </Alert>
              )}

              <Divider />

              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Subtotal</Typography>
                  <Typography fontWeight={700}>{formatPrice(cart.subtotal)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Shipping</Typography>
                  <Typography fontWeight={700}>{formatPrice(shipping)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Tax</Typography>
                  <Typography fontWeight={700}>{formatPrice(cart.tax)}</Typography>
                </Stack>
              </Stack>

              <Divider />

              <Stack direction="row" justifyContent="space-between">
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Total
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  {formatPrice(total)}
                </Typography>
              </Stack>

              <Button
                component={Link}
                href="/checkout/success"
                variant="contained"
                endIcon={<CreditCardRounded />}
                disabled={cart.items.length === 0}
                sx={{ borderRadius: 999, py: 1.4, textTransform: "none", fontWeight: 800 }}
              >
                Place order
              </Button>
              <Button
                component={Link}
                href="/cart"
                variant="outlined"
                sx={{ borderRadius: 999, py: 1.2, textTransform: "none", fontWeight: 800 }}
              >
                Back to cart
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Stack>
    </Box>
  );
}
