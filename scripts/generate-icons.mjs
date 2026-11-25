import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

/**
 * Génère le jeu d'icônes à partir du master `static/brand/pito-source.png`.
 * Source v1 : www/Pito.png (200×200). Si un master plus grand arrive, il suffit
 * de remplacer le fichier source et de relancer `npm run icons`.
 */

const SOURCE = 'static/brand/pito-source.png';
const OUT = 'static/icons';
const BG = '#050507';

if (!existsSync(SOURCE)) {
	console.error(`Source absente : ${SOURCE}`);
	process.exit(1);
}

await mkdir(OUT, { recursive: true });

const master = sharp(SOURCE).resize(1024, 1024, {
	fit: 'contain',
	kernel: 'lanczos3',
	background: { r: 0, g: 0, b: 0, alpha: 0 }
});

await master.clone().png({ compressionLevel: 9, quality: 88 }).toFile(`${OUT}/icon-1024.png`);
await master.clone().resize(512, 512).png({ compressionLevel: 9, quality: 88 }).toFile(`${OUT}/icon-512.png`);
await master.clone().resize(192, 192).png({ compressionLevel: 9, quality: 88 }).toFile(`${OUT}/icon-192.png`);

// Maskable : 80 % de zone de sécurité, fond opaque (Android rogne les bords).
const maskableLogo = await sharp(SOURCE)
	.resize(400, 400, { fit: 'contain', kernel: 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 } })
	.png({ compressionLevel: 9, quality: 88 })
	.toBuffer();

await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
	.composite([{ input: maskableLogo, gravity: 'center' }])
	.png({ compressionLevel: 9, quality: 88 })
	.toFile(`${OUT}/maskable-512.png`);

// iOS ne gère pas la transparence sur l'icône d'accueil.
const appleLogo = await sharp(SOURCE)
	.resize(140, 140, { fit: 'contain', kernel: 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 } })
	.png({ compressionLevel: 9, quality: 88 })
	.toBuffer();

await sharp({ create: { width: 180, height: 180, channels: 4, background: BG } })
	.composite([{ input: appleLogo, gravity: 'center' }])
	.png({ compressionLevel: 9, quality: 88 })
	.toFile(`${OUT}/apple-touch-icon-180.png`);

await sharp(SOURCE).resize(32, 32).png({ compressionLevel: 9, quality: 88 }).toFile(`${OUT}/favicon-32.png`);

// Écrans de démarrage iOS (portrait), aux dimensions les plus courantes.
const splashes = [
	{ file: 'splash-1170x2532.png', width: 1170, height: 2532 },
	{ file: 'splash-1284x2778.png', width: 1284, height: 2778 },
	{ file: 'splash-750x1334.png', width: 750, height: 1334 }
];

for (const splash of splashes) {
	const logo = await sharp(SOURCE)
		.resize(Math.round(splash.width * 0.34), Math.round(splash.width * 0.34), {
			fit: 'contain',
			kernel: 'lanczos3',
			background: { r: 0, g: 0, b: 0, alpha: 0 }
		})
		.png({ compressionLevel: 9, quality: 88 })
		.toBuffer();

	await sharp({
		create: { width: splash.width, height: splash.height, channels: 4, background: BG }
	})
		.composite([{ input: logo, gravity: 'center' }])
		.png({ compressionLevel: 9, quality: 88 })
		.toFile(`${OUT}/${splash.file}`);
}

console.log(`Icônes générées dans ${OUT}`);
