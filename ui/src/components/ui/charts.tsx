'use client';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled, useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';

import { tokens } from 'src/theme/tokens';

const ChartCard = styled(Stack)(({ theme }) => ({
  gap: tokens.space.lg,
  minWidth: 0,
  borderRadius: tokens.radius.card,
  padding: tokens.space.xl,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: tokens.shadow[theme.palette.mode],
  backgroundColor: theme.palette.background.paper,
  overflow: 'hidden',
}));

const ChartEmpty = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  textAlign: 'center',
  gap: tokens.space.sm,
  padding: tokens.space.xl,
  color: theme.palette.text.secondary,
  minHeight: 160,
  justifyContent: 'center',
}));

function ChartTitle({ children }: { children: string }) {
  return (
    <Typography
      component="h3"
      sx={{
        fontSize: tokens.type.subtitle,
        fontWeight: 650,
        lineHeight: tokens.type.line,
        fontFamily: tokens.type.font,
      }}
    >
      {children}
    </Typography>
  );
}

export function BarSeriesChart({
  title,
  labels,
  values,
  emptyTitle,
  emptyHint,
  height = 240,
}: {
  title: string;
  labels: string[];
  values: number[];
  emptyTitle?: string;
  emptyHint?: string;
  height?: number;
}) {
  const theme = useTheme();
  const hasData = values.some((value) => value > 0);
  return (
    <ChartCard>
      <ChartTitle>{title}</ChartTitle>
      {!hasData ? (
        <ChartEmpty>
          <Typography variant="subtitle2">{emptyTitle}</Typography>
          {emptyHint && (
            <Typography variant="body2" color="text.secondary">
              {emptyHint}
            </Typography>
          )}
        </ChartEmpty>
      ) : (
        <BarChart
          height={height}
          borderRadius={tokens.radius.button / 2}
          hideLegend
          xAxis={[
            {
              data: labels,
              scaleType: 'band',
              tickLabelStyle: {
                fontFamily: tokens.type.font,
                fontSize: tokens.type.caption,
                fill: theme.palette.text.secondary,
              },
            },
          ]}
          yAxis={[
            {
              tickLabelStyle: {
                fontFamily: tokens.type.font,
                fontSize: tokens.type.caption,
                fill: theme.palette.text.secondary,
              },
            },
          ]}
          series={[
            {
              data: values,
              color: theme.palette.primary.main,
              valueFormatter: (value) =>
                new Intl.NumberFormat('fa-IR').format(value ?? 0),
            },
          ]}
          margin={{ top: 16, right: 8, bottom: 40, left: 44 }}
          sx={{
            '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': {
              stroke: theme.palette.divider,
            },
            '& .MuiChartsGrid-line': { stroke: theme.palette.divider },
          }}
        />
      )}
    </ChartCard>
  );
}

export function DonutChart({
  title,
  items,
  emptyTitle,
  emptyHint,
  height = 260,
}: {
  title: string;
  items: { id: string; label: string; value: number }[];
  emptyTitle?: string;
  emptyHint?: string;
  height?: number;
}) {
  const theme = useTheme();
  const colors = [
    theme.palette.primary.main,
    theme.palette.warning.main,
    theme.palette.secondary.main,
  ];
  const data = items
    .filter((item) => item.value > 0)
    .map((item, index) => ({
      id: item.id,
      label: item.label,
      value: item.value,
      color: colors[index % colors.length],
    }));
  return (
    <ChartCard>
      <ChartTitle>{title}</ChartTitle>
      {!data.length ? (
        <ChartEmpty>
          <Typography variant="subtitle2">{emptyTitle}</Typography>
          {emptyHint && (
            <Typography variant="body2" color="text.secondary">
              {emptyHint}
            </Typography>
          )}
        </ChartEmpty>
      ) : (
        <PieChart
          height={height}
          series={[
            {
              data,
              innerRadius: 55,
              outerRadius: 90,
              paddingAngle: 2,
              cornerRadius: 6,
              highlightScope: { fade: 'global', highlight: 'item' },
              valueFormatter: ({ value }) =>
                new Intl.NumberFormat('fa-IR').format(value),
            },
          ]}
          margin={{ top: 8, bottom: 48, left: 8, right: 8 }}
          slotProps={{
            legend: {
              direction: 'horizontal',
              position: { vertical: 'bottom', horizontal: 'center' },
              sx: {
                fontFamily: tokens.type.font,
                fontSize: tokens.type.caption,
                color: theme.palette.text.secondary,
              },
            },
          }}
        />
      )}
    </ChartCard>
  );
}
