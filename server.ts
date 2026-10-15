import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

app.post('/api/gemini', async (req, res) => {
    try {
        const { contents, config } = req.body;
        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
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
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
    });
    
    app.use(vite.middlewares);
    
    app.listen(3000, () => {
        console.log('Server running on http://localhost:3000');
    });
}

startServer();
