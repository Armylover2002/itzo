/**
 * BLAZE chart theme tokens.
 *
 * Mirrors the EXISTING Blaze Food/Admin brand tokens (global.css):
 *   primary  = #FF0000 (--primary / --color-orange-500)
 *   hover    = #CC0000 (--color-primary-hover)
 *   light    = #FFEDED (--secondary / --color-orange-50)
 *   success  = #2E7D32 (--color-accent-green)
 *   border   = #EDE8E0 (--border, warm paper)
 *   muted    = #5C5247 (--muted-foreground)
 * No new red is introduced — charts use the exact same brand red as the
 * rest of the Blaze Admin. This is NOT a component, only constants.
 */
export const BLAZE_CHART = {
  primary: "#FF0000",
  primaryHover: "#CC0000",
  primaryLight: "#FFEDED",
  success: "#2E7D32",
  warning: "#F59E0B",
  info: "#2563EB",
  danger: "#DC2626",
  violet: "#7C3AED",

  grid: "#EDE8E0",
  axis: "#5C5247",

  // Ordered categorical palette for multi-series charts
  series: ["#FF0000", "#2563EB", "#2E7D32", "#F59E0B", "#7C3AED", "#DC2626"],

  // Shared modern tooltip / cursor styling
  tooltip: {
    contentStyle: {
      background: "#FFFFFF",
      border: "1px solid #EDE8E0",
      borderRadius: 14,
      boxShadow: "0 12px 28px -12px rgba(16,24,40,0.18)",
      padding: "10px 12px",
    },
    labelStyle: {
      color: "#1A1A1A",
      fontWeight: 600,
      marginBottom: 4,
      fontSize: 12,
    },
    itemStyle: { color: "#1A1A1A", fontSize: 12 },
    cursor: { fill: "rgba(255,0,0,0.05)" },
    lineCursor: { stroke: "rgba(255,0,0,0.25)", strokeWidth: 1 },
  },
};

export default BLAZE_CHART;
