import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

app.post('/api/gemini', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
        }
        const ai = new GoogleGenAI({ apiKey });
        const { contents, config } = req.body;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config,
        });
        res.json(response);
    } catch (error) {
        console.error('AI Error:', error);
        res.status(500).json({ error: 'Failed to generate content' });
    }
});

async function startServer() {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
        // Serve built static files in production
        const distPath = path.join(__dirname, 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    } else {
        // Mount Vite in development
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa'
        });
        app.use(vite.middlewares);
    }
    
    const port = isProduction ? (process.env.PORT || 3000) : 3000;
    app.listen(Number(port), '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${port}`);
    });
}

startServer();

