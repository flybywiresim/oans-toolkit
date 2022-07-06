import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';

export default defineConfig({
    css: {
        postcss: {
            plugins: [
                tailwindcss({ config: 'tailwind.config.js' }),
            ],
        },
    },
    plugins: [
        react(),
    ],
});
