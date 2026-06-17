import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config
export default defineConfig({
    plugins: [react()],
    base: './',
    // Ensure Vite processes environment variables prefixed with VITE_
    envPrefix: 'VITE_',
});
