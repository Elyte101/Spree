'use client';

import React from "react";
import Badge from '@mui/material/Badge';
import { Button, IconButton } from "@mui/material";

interface BadgerProps {
  onClick?: () => void;
  value?: number;
  icon: React.ReactElement;
}

interface ButtonProps {
  label: string;
  onClick?: () => void;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  fontWeight?: number | string;
}

const baseButtonStyles = {
  color: "white",
  border: "2px solid white",
  borderRadius: "50px",
  textTransform: "none",
  transition: "transform 0.1s ease-in-out",
  "&:hover": {
    transform: "scale(1.05)",
  },
};

export const NormalButton: React.FC<ButtonProps> = ({ label, onClick, startIcon, endIcon, fontWeight }) => (
  <Button
    onClick={onClick}
    startIcon={startIcon}
    endIcon={endIcon}
    sx={{
      ...(fontWeight !== undefined ? { fontWeight } : {}),
      backgroundColor: "primary.main",
      px: 2,
      ...baseButtonStyles,
      "&:hover": { ...baseButtonStyles["&:hover"], backgroundColor: "primary.main" },
    }}
  >
    {label}
  </Button>
);

export const LongButton: React.FC<ButtonProps> = ({ label, onClick, startIcon, endIcon, fontWeight }) => (
  <Button
    onClick={onClick}
    startIcon={startIcon}
    endIcon={endIcon}
    sx={{
      ...(fontWeight !== undefined ? { fontWeight } : {}),
      width: 180,
      backgroundColor: "primary.main",
      ...baseButtonStyles,
      "&:hover": { ...baseButtonStyles["&:hover"], backgroundColor: "primary.main" },
    }}
  >
    {label}
  </Button>
);

export const OutlinedButton: React.FC<ButtonProps> = ({ label, onClick, startIcon, endIcon, fontWeight }) => (
  <Button
    variant="outlined"
    onClick={onClick}
    startIcon={startIcon}
    endIcon={endIcon}
    sx={{
      ...(fontWeight !== undefined ? { fontWeight } : {}),
      ...baseButtonStyles,
      color: "text.primary",
      borderColor: "text.primary",
      "&:hover": { ...baseButtonStyles["&:hover"], borderColor: "primary.main", color: "primary.main" },
    }}
  >
    {label}
  </Button>
);

export const TextButton: React.FC<ButtonProps> = ({ label, onClick, startIcon, endIcon, fontWeight }) => (
  <Button
    variant="text"
    onClick={onClick}
    startIcon={startIcon}
    endIcon={endIcon}
    sx={{
      ...(fontWeight !== undefined ? { fontWeight } : {}),
      color: "text.primary",
      textTransform: "none",
      transition: "transform 0.1s ease-in-out",
      "&:hover": {
        transform: "scale(1.05)",
        color: "primary.main",
      },
    }}
  >
    {label}
  </Button>
);

export const Badger: React.FC<BadgerProps> = ({ value, icon, onClick }) => {
  return (
    <IconButton onClick={onClick}>
      <Badge
        badgeContent={value}
        color="primary"
        overlap="circular"
        sx={{
          "& .MuiBadge-badge": {
            right: 2,
            top: 2,
          },
        }}
      >
        {icon}
      </Badge>
    </IconButton>
  );
};
