#!/usr/bin/env node

/**
 * Serveur Web pour la gestion des projets Node.js
 * Interface Web alternative à la CLI
 */

import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import apiRouter from './api.js';
import projects from '../modules/projects.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.WEB_PORT || 3847;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', apiRouter);

// SPA fallback - toutes les routes non-API renvoient index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Démarrage du serveur
 */
async function start() {
    try {
        // Initialiser la configuration
        projects.initConfigDir();
        logger.initLogDir();

        app.listen(PORT, () => {
            console.log(`\n🌐 Interface Web démarrée sur http://localhost:${PORT}\n`);
            logger.info(`Serveur Web démarré sur le port ${PORT}`);
        });
    } catch (error) {
        console.error(`Erreur fatale: ${error.message}`);
        process.exit(1);
    }
}

start();
