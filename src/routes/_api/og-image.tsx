import { createFileRoute } from '@tanstack/react-router'
import { Resvg } from '@resvg/resvg-js'

export const Route = createFileRoute('/_api/og-image')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const title = url.searchParams.get('title') || 'Infinite Minesweeper'
        const subtitle =
          url.searchParams.get('subtitle') || 'Explore an endless minefield'

        // Generate SVG-based OG image matching website design
        const svg = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1c1917"/>
      <stop offset="100%" style="stop-color:#292524"/>
    </linearGradient>
    <linearGradient id="amber" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#f59e0b"/>
      <stop offset="100%" style="stop-color:#d97706"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Grid pattern overlay -->
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#44403c" stroke-width="0.5" opacity="0.3"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#grid)"/>
  
  <!-- Decorative mine cells -->
  <g opacity="0.15">
    <!-- Top left cluster -->
    <rect x="60" y="80" width="36" height="36" rx="4" fill="#78716c"/>
    <rect x="100" y="80" width="36" height="36" rx="4" fill="#57534e"/>
    <rect x="60" y="120" width="36" height="36" rx="4" fill="#57534e"/>
    <rect x="100" y="120" width="36" height="36" rx="4" fill="#78716c"/>
    
    <!-- Top right cluster -->
    <rect x="1064" y="80" width="36" height="36" rx="4" fill="#57534e"/>
    <rect x="1104" y="80" width="36" height="36" rx="4" fill="#78716c"/>
    <rect x="1064" y="120" width="36" height="36" rx="4" fill="#78716c"/>
    <rect x="1104" y="120" width="36" height="36" rx="4" fill="#57534e"/>
    
    <!-- Bottom left cluster -->
    <rect x="60" y="474" width="36" height="36" rx="4" fill="#78716c"/>
    <rect x="100" y="474" width="36" height="36" rx="4" fill="#57534e"/>
    <rect x="60" y="514" width="36" height="36" rx="4" fill="#57534e"/>
    <rect x="100" y="514" width="36" height="36" rx="4" fill="#78716c"/>
    
    <!-- Bottom right cluster -->
    <rect x="1064" y="474" width="36" height="36" rx="4" fill="#57534e"/>
    <rect x="1104" y="474" width="36" height="36" rx="4" fill="#78716c"/>
    <rect x="1064" y="514" width="36" height="36" rx="4" fill="#78716c"/>
    <rect x="1104" y="514" width="36" height="36" rx="4" fill="#57534e"/>
  </g>
  
  <!-- Mine icon in center top -->
  <g transform="translate(600, 180)" filter="url(#glow)">
    <circle cx="0" cy="0" r="45" fill="#f59e0b"/>
    <circle cx="0" cy="0" r="35" fill="#1c1917"/>
    <circle cx="0" cy="0" r="12" fill="#f59e0b"/>
    <!-- Spikes -->
    <rect x="-4" y="-50" width="8" height="20" rx="2" fill="#f59e0b"/>
    <rect x="-4" y="30" width="8" height="20" rx="2" fill="#f59e0b"/>
    <rect x="-50" y="-4" width="20" height="8" rx="2" fill="#f59e0b"/>
    <rect x="30" y="-4" width="20" height="8" rx="2" fill="#f59e0b"/>
    <!-- Diagonal spikes -->
    <rect x="25" y="-35" width="8" height="18" rx="2" fill="#f59e0b" transform="rotate(45 29 -26)"/>
    <rect x="-33" y="17" width="8" height="18" rx="2" fill="#f59e0b" transform="rotate(45 -29 26)"/>
    <rect x="-33" y="-35" width="8" height="18" rx="2" fill="#f59e0b" transform="rotate(-45 -29 -26)"/>
    <rect x="25" y="17" width="8" height="18" rx="2" fill="#f59e0b" transform="rotate(-45 29 26)"/>
  </g>
  
  <!-- Title -->
  <text x="600" y="320" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#fafaf9" text-anchor="middle">
    ${escapeXml(title.includes('Minesweeper') ? 'Infinite' : title)}
  </text>
  ${
    title.includes('Minesweeper')
      ? `
  <text x="600" y="400" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="url(#amber)" text-anchor="middle">
    Minesweeper
  </text>
  `
      : ''
  }
  
  <!-- Subtitle -->
  <text x="600" y="${title.includes('Minesweeper') ? '470' : '390'}" font-family="Arial, sans-serif" font-size="28" fill="#a8a29e" text-anchor="middle">
    ${escapeXml(subtitle)}
  </text>
  
  <!-- Bottom tagline -->
  <text x="600" y="580" font-family="Arial, sans-serif" font-size="20" fill="#78716c" text-anchor="middle">
    No boundaries. No limits. Just mines.
  </text>
</svg>
                `.trim()

        // Convert SVG to PNG using resvg
        const resvg = new Resvg(svg, {
          fitTo: {
            mode: 'width',
            value: 1200,
          },
        })
        const pngData = resvg.render()
        const pngBuffer = pngData.asPng()

        return new Response(new Uint8Array(pngBuffer), {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      },
    },
  },
})

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
