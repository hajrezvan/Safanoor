'use client';

import React, { useState, useEffect } from 'react';

import Box from '@mui/material/Box';

import { Scrollbar } from 'src/components/scrollbar';

import { UI_CONFIG } from '../global-config';

function ScreenSize({ children }) {
  const [isDesktopSize, setIsDesktopSize] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // todo: remove this for revert desktop size
  useEffect(() => {
    setHasMounted(true);
    if (typeof document !== 'undefined' && document.querySelector) {
      const bodySize = document.querySelector('body')?.getBoundingClientRect();
      setIsDesktopSize(bodySize?.width > 600);
    }
  }, []);

  if (!hasMounted) {
    // Avoid rendering layout differences until after hydration
    return null;
  }

  return (
    <Box
      sx={
        isDesktopSize && UI_CONFIG.mobileOnly
          ? {
              height: '100dvh',
              width: 500,
              maxWidth: 550,
              margin: '0 auto',
              transform: 'translateZ(0px)',
              overflow: 'hidden',
              boxShadow: '0 0 16px rgba(0,0,0,0.1)',
              bgcolor: 'background.default',
            }
          : {
              bgcolor: 'background.default',
              minHeight: '100vh',
            }
      }
    >
      <Scrollbar
        id="scroll-target"
        slotProps={{
          content: {
            minHeight: '100%',
            display: 'flex',
          },
          contentWrapper: {
            direction: 'ltr',
            textAlign: 'left',
          },
        }}
        sx={{
          position: 'relative',
          zIndex: 1,

          // background: '#fff',
          height: '100dvh',

          // overflowY: 'auto',
          // overflowX: 'hidden',
          // '::-webkit-scrollbar': {
          //   height: 6,
          //   width: 6,
          //   background: '#dcdcdc',
          // },
          //
          // '::-webkit-scrollbar-thumb': {
          //   background: '#949494',
          //   '-webkit-border-radius': '1ex',
          // },
          //
          // '::-webkit-scrollbar-corner': {
          //   background: '#d3d3d3',
          // },
        }}
      >
        {children}
      </Scrollbar>
      <Box
        id="drawer-container"
        style={{
          direction: 'rtl',
        }}
        sx={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,

          '& *': {
            direction: 'ltr',
          },
        }}
      />
      <Box
        id="drawer-left-container"
        style={{
          direction: 'rtl',
        }}
        sx={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          right: 0,

          '& *': {
            direction: 'ltr',
          },
        }}
      />
    </Box>
  );
}

export default ScreenSize;
