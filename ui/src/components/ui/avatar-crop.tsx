'use client';

import type { ReactNode } from 'react';
import type { Area } from 'react-easy-crop';

import { useState } from 'react';
import Cropper from 'react-easy-crop';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import { styled } from '@mui/material/styles';

import { tokens } from 'src/theme/tokens';
import { useFa } from 'src/locales/fa-provider';

const OUTPUT_SIZE = 512;
const WEBP_QUALITY = 0.9;

const CropFrame = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: 280,
  borderRadius: tokens.radius.card,
  overflow: 'hidden',
  backgroundColor: theme.palette.action.hover,
  touchAction: 'none',
  [theme.breakpoints.up('md')]: {
    height: 360,
  },
}));

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('image-load-failed')));
    image.decoding = 'async';
    image.src = src;
  });
}

/** Export a square crop as WebP (JPEG fallback) for the avatar upload API. */
export async function cropAvatarFile(
  imageSrc: string,
  area: Area,
  fileName = 'avatar.webp',
): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    const toBlob = (type: string, quality?: number) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else if (type === 'image/webp') toBlob('image/jpeg', 0.92);
          else reject(new Error('crop-export-failed'));
        },
        type,
        quality,
      );
    };
    toBlob('image/webp', WEBP_QUALITY);
  });

  const type = blob.type || 'image/webp';
  const name = type === 'image/jpeg' ? fileName.replace(/\.webp$/i, '.jpg') : fileName;
  return new File([blob], name, { type, lastModified: Date.now() });
}

/** Cropper + zoom + action slot; parent wraps with ui Dialog or BottomSheet. */
export function AvatarCropPanel({
  imageSrc,
  busy = false,
  actions,
  onConfirm,
}: {
  imageSrc: string;
  busy?: boolean;
  actions: (props: {
    disabled: boolean;
    confirmDisabled: boolean;
    onConfirm: () => void;
  }) => ReactNode;
  onConfirm: (file: File) => void;
}) {
  const t = useFa();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [exporting, setExporting] = useState(false);
  const disabled = exporting || busy;

  const confirm = async () => {
    if (!area || disabled) return;
    setExporting(true);
    try {
      onConfirm(await cropAvatarFile(imageSrc, area));
    } catch {
      setExporting(false);
    }
  };

  return (
    <Stack sx={{ gap: tokens.space.lg }}>
      <CropFrame>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          objectFit="contain"
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setArea(pixels)}
        />
      </CropFrame>
      <Box sx={{ px: tokens.space.sm }}>
        <Box
          component="label"
          htmlFor="avatar-crop-zoom"
          sx={{
            display: 'block',
            mb: 0.5,
            fontSize: tokens.type.caption,
            color: 'text.secondary',
          }}
        >
          {t('avatarCropZoom')}
        </Box>
        <Slider
          id="avatar-crop-zoom"
          value={zoom}
          min={1}
          max={3}
          step={0.05}
          aria-label={t('avatarCropZoom')}
          onChange={(_, value) => setZoom(typeof value === 'number' ? value : value[0] ?? 1)}
          disabled={disabled}
          sx={{
            direction: 'ltr',
            minHeight: tokens.layout.touch,
            '& .MuiSlider-thumb': { width: 20, height: 20 },
          }}
        />
      </Box>
      {actions({
        disabled,
        confirmDisabled: !area || disabled,
        onConfirm: () => void confirm(),
      })}
    </Stack>
  );
}
