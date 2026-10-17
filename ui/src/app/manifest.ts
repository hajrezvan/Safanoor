import type { MetadataRoute } from 'next';

import { fa } from 'src/locales/fa';
import { tokens } from 'src/theme/tokens';

export default function manifest():MetadataRoute.Manifest {return {name:fa.brand,short_name:fa.brand,description:fa.tagline,start_url:'/',display:'standalone',lang:'fa',dir:'rtl',background_color:tokens.palette.light.bg,theme_color:tokens.palette.light.brand,icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]};}
