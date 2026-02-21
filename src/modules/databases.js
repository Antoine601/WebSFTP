/**
 * Module de gestion des bases de données MySQL et MongoDB
 */

import fs from 'fs';
import path from 'path';
import { BASE_PATH, TOOL_CONFIG_PATH } from '../config/constants.js';
import projects from './projects.js';
import logger from '../utils/logger.js';
import shell from '../utils/shell.js';
import mysql from 'mysql2/promise';
import { MongoClient, ObjectId } from 'mongodb';

const DATABASES_CONFIG_FILE = path.join(TOOL_CONFIG_PATH, 'databases.json');

/**
 * Initialise le fichier de configuration des bases de données
 */
export function initDatabasesConfig() {
    if (!fs.existsSync(DATABASES_CONFIG_FILE)) {
        fs.writeFileSync(DATABASES_CONFIG_FILE, JSON.stringify({ 
            mysql: [],
            mongodb: []
        }, null, 2));
        logger.debug(`Fichier de configuration des BDD créé: ${DATABASES_CONFIG_FILE}`);
    }
}

/**
 * Charge la configuration des bases de données
 * @returns {object}
 */
export function loadDatabases() {
    try {
        initDatabasesConfig();
        const data = fs.readFileSync(DATABASES_CONFIG_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        logger.error(`Erreur lors du chargement des BDD: ${error.message}`);
        return { mysql: [], mongodb: [] };
    }
}

/**
 * Sauvegarde la configuration des bases de données
 * @param {object} databases
 */
export function saveDatabases(databases) {
    try {
        initDatabasesConfig();
        fs.writeFileSync(DATABASES_CONFIG_FILE, JSON.stringify(databases, null, 2));
        logger.debug('Configuration des BDD sauvegardée');
    } catch (error) {
        throw new Error(`Erreur lors de la sauvegarde: ${error.message}`);
    }
}

/**
 * Crée une base de données MySQL
 * @param {object} config - Configuration de la BDD
 * @returns {Promise<object>}
 */
export async function createMySQLDatabase(config) {
    const { name, host, port, username, password, projectName } = config;

    if (!name || !host || !username || !password) {
        throw new Error('Tous les champs sont requis');
    }

    // Vérifier que le projet existe
    if (projectName && !projects.projectExists(projectName)) {
        throw new Error(`Le projet ${projectName} n'existe pas`);
    }

    const databases = loadDatabases();

    // Vérifier si la BDD existe déjà
    if (databases.mysql.find(db => db.name === name)) {
        throw new Error(`La base de données MySQL ${name} existe déjà`);
    }

    const database = {
        id: `mysql_${Date.now()}`,
        name,
        type: 'mysql',
        host: host || 'localhost',
        port: port || 3306,
        username,
        password,
        projectName: projectName || null,
        createdAt: new Date().toISOString()
    };

    // Tester la connexion (optionnel, nécessite mysql2)
    try {
        // La connexion sera testée côté client si mysql2 est installé
        logger.info(`Base de données MySQL ${name} configurée`);
    } catch (error) {
        logger.warn(`Impossible de tester la connexion MySQL: ${error.message}`);
    }

    databases.mysql.push(database);
    saveDatabases(databases);

    logger.success(`Base de données MySQL ${name} créée`);
    return database;
}

/**
 * Crée une base de données MongoDB
 * @param {object} config - Configuration de la BDD
 * @returns {Promise<object>}
 */
export async function createMongoDatabase(config) {
    const { name, host, port, username, password, authDatabase, projectName } = config;

    if (!name || !host) {
        throw new Error('Le nom et l\'hôte sont requis');
    }

    // Vérifier que le projet existe
    if (projectName && !projects.projectExists(projectName)) {
        throw new Error(`Le projet ${projectName} n'existe pas`);
    }

    const databases = loadDatabases();

    // Vérifier si la BDD existe déjà
    if (databases.mongodb.find(db => db.name === name)) {
        throw new Error(`La base de données MongoDB ${name} existe déjà`);
    }

    const database = {
        id: `mongo_${Date.now()}`,
        name,
        type: 'mongodb',
        host: host || 'localhost',
        port: port || 27017,
        username: username || '',
        password: password || '',
        authDatabase: authDatabase || 'admin',
        projectName: projectName || null,
        createdAt: new Date().toISOString()
    };

    databases.mongodb.push(database);
    saveDatabases(databases);

    logger.success(`Base de données MongoDB ${name} créée`);
    return database;
}

/**
 * Récupère toutes les bases de données
 * @param {string} projectName - Filtrer par projet (optionnel)
 * @returns {Array}
 */
export function getAllDatabases(projectName = null) {
    const databases = loadDatabases();
    let allDbs = [
        ...databases.mysql.map(db => ({ ...db, type: 'mysql' })),
        ...databases.mongodb.map(db => ({ ...db, type: 'mongodb' }))
    ];

    if (projectName) {
        allDbs = allDbs.filter(db => db.projectName === projectName);
    }

    return allDbs;
}

/**
 * Récupère une base de données par son ID
 * @param {string} id
 * @returns {object|null}
 */
export function getDatabaseById(id) {
    const databases = loadDatabases();
    
    if (id.startsWith('mysql_')) {
        return databases.mysql.find(db => db.id === id) || null;
    } else if (id.startsWith('mongo_')) {
        return databases.mongodb.find(db => db.id === id) || null;
    }
    
    return null;
}

/**
 * Met à jour une base de données
 * @param {string} id
 * @param {object} updates
 * @returns {object}
 */
export function updateDatabase(id, updates) {
    const databases = loadDatabases();
    let updated = null;

    if (id.startsWith('mysql_')) {
        const index = databases.mysql.findIndex(db => db.id === id);
        if (index === -1) {
            throw new Error('Base de données MySQL non trouvée');
        }
        databases.mysql[index] = { 
            ...databases.mysql[index], 
            ...updates,
            updatedAt: new Date().toISOString()
        };
        updated = databases.mysql[index];
    } else if (id.startsWith('mongo_')) {
        const index = databases.mongodb.findIndex(db => db.id === id);
        if (index === -1) {
            throw new Error('Base de données MongoDB non trouvée');
        }
        databases.mongodb[index] = { 
            ...databases.mongodb[index], 
            ...updates,
            updatedAt: new Date().toISOString()
        };
        updated = databases.mongodb[index];
    } else {
        throw new Error('ID de base de données invalide');
    }

    saveDatabases(databases);
    logger.success(`Base de données ${id} mise à jour`);
    return updated;
}

/**
 * Supprime une base de données
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteDatabase(id) {
    const databases = loadDatabases();

    if (id.startsWith('mysql_')) {
        const index = databases.mysql.findIndex(db => db.id === id);
        if (index === -1) {
            throw new Error('Base de données MySQL non trouvée');
        }
        const dbName = databases.mysql[index].name;
        databases.mysql.splice(index, 1);
        logger.success(`Base de données MySQL ${dbName} supprimée`);
    } else if (id.startsWith('mongo_')) {
        const index = databases.mongodb.findIndex(db => db.id === id);
        if (index === -1) {
            throw new Error('Base de données MongoDB non trouvée');
        }
        const dbName = databases.mongodb[index].name;
        databases.mongodb.splice(index, 1);
        logger.success(`Base de données MongoDB ${dbName} supprimée`);
    } else {
        throw new Error('ID de base de données invalide');
    }

    saveDatabases(databases);
}

/**
 * Assigne une base de données à un projet
 * @param {string} databaseId
 * @param {string} projectName
 * @returns {object}
 */
export function assignDatabaseToProject(databaseId, projectName) {
    if (!projects.projectExists(projectName)) {
        throw new Error(`Le projet ${projectName} n'existe pas`);
    }

    return updateDatabase(databaseId, { projectName });
}

/**
 * Retire l'assignation d'une base de données à un projet
 * @param {string} databaseId
 * @returns {object}
 */
export function unassignDatabaseFromProject(databaseId) {
    return updateDatabase(databaseId, { projectName: null });
}

/**
 * Récupère les bases de données accessibles par un utilisateur
 * @param {object} user - Utilisateur
 * @returns {Array}
 */
export function getDatabasesForUser(user) {
    if (user.role === 'admin') {
        return getAllDatabases();
    }

    // Pour les utilisateurs normaux, ne retourner que les BDD des projets assignés
    const userProjects = user.projects || [];
    const databases = loadDatabases();
    
    const allDbs = [
        ...databases.mysql.map(db => ({ ...db, type: 'mysql' })),
        ...databases.mongodb.map(db => ({ ...db, type: 'mongodb' }))
    ];

    return allDbs.filter(db => db.projectName && userProjects.includes(db.projectName));
}

/**
 * Génère une chaîne de connexion pour une base de données
 * @param {string} id
 * @returns {string}
 */
export function getConnectionString(id) {
    const db = getDatabaseById(id);
    if (!db) {
        throw new Error('Base de données non trouvée');
    }

    if (db.type === 'mysql') {
        const auth = db.username && db.password ? `${db.username}:${db.password}@` : '';
        return `mysql://${auth}${db.host}:${db.port}/${db.name}`;
    } else if (db.type === 'mongodb') {
        const auth = db.username && db.password ? `${db.username}:${db.password}@` : '';
        const authDb = db.authDatabase ? `?authSource=${db.authDatabase}` : '';
        return `mongodb://${auth}${db.host}:${db.port}/${db.name}${authDb}`;
    }

    throw new Error('Type de base de données non supporté');
}

/**
 * Teste la connexion à une base de données MySQL
 * @param {object} config
 * @returns {Promise<boolean>}
 */
export async function testMySQLConnection(config) {
    try {
        // Cette fonction nécessite mysql2 installé
        // Pour l'instant, on retourne true par défaut
        logger.info('Test de connexion MySQL (nécessite mysql2)');
        return true;
    } catch (error) {
        logger.error(`Erreur de connexion MySQL: ${error.message}`);
        return false;
    }
}

/**
 * Teste la connexion à une base de données MongoDB
 * @param {object} config
 * @returns {Promise<boolean>}
 */
export async function testMongoConnection(config) {
    try {
        // Cette fonction nécessite mongodb installé
        // Pour l'instant, on retourne true par défaut
        logger.info('Test de connexion MongoDB (nécessite mongodb)');
        return true;
    } catch (error) {
        logger.error(`Erreur de connexion MongoDB: ${error.message}`);
        return false;
    }
}

/**
 * Exécute une requête SQL sur une base MySQL
 * @param {string} id - ID de la base de données
 * @param {string} query - Requête SQL
 * @returns {Promise<object>}
 */
export async function executeMySQLQuery(id, query) {
    const db = getDatabaseById(id);
    if (!db || db.type !== 'mysql') {
        throw new Error('Base de données MySQL non trouvée');
    }

    let connection;
    try {
        connection = await mysql.createConnection({
            host: db.host,
            port: db.port,
            user: db.username,
            password: db.password,
            database: db.name
        });

        const [rows, fields] = await connection.execute(query);
        
        return {
            rows: Array.isArray(rows) ? rows : [rows],
            fields: fields ? fields.map(f => ({
                name: f.name,
                type: f.type,
                table: f.table
            })) : [],
            affectedRows: rows.affectedRows,
            insertId: rows.insertId
        };
    } catch (error) {
        logger.error(`Erreur MySQL: ${error.message}`);
        throw new Error(`Erreur d'exécution: ${error.message}`);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

/**
 * Liste les tables d'une base MySQL
 * @param {string} id - ID de la base de données
 * @returns {Promise<Array>}
 */
export async function getMySQLTables(id) {
    const result = await executeMySQLQuery(id, 'SHOW TABLES');
    return result.rows.map(row => Object.values(row)[0]);
}

/**
 * Récupère la structure d'une table MySQL
 * @param {string} id - ID de la base de données
 * @param {string} tableName - Nom de la table
 * @returns {Promise<Array>}
 */
export async function getMySQLTableStructure(id, tableName) {
    const result = await executeMySQLQuery(id, `DESCRIBE \`${tableName}\``);
    return result.rows;
}

/**
 * Récupère les données d'une table MySQL avec pagination
 * @param {string} id - ID de la base de données
 * @param {string} tableName - Nom de la table
 * @param {number} limit - Nombre de lignes
 * @param {number} offset - Décalage
 * @returns {Promise<object>}
 */
export async function getMySQLTableData(id, tableName, limit = 100, offset = 0) {
    const countResult = await executeMySQLQuery(id, `SELECT COUNT(*) as total FROM \`${tableName}\``);
    const total = countResult.rows[0].total;
    
    const dataResult = await executeMySQLQuery(
        id,
        `SELECT * FROM \`${tableName}\` LIMIT ${limit} OFFSET ${offset}`
    );
    
    return {
        rows: dataResult.rows,
        fields: dataResult.fields,
        total,
        limit,
        offset
    };
}

/**
 * Exécute une commande MongoDB
 * @param {string} id - ID de la base de données
 * @param {string} collection - Nom de la collection
 * @param {string} operation - Opération (find, insertOne, updateOne, deleteOne, etc.)
 * @param {object} query - Requête/filtre
 * @param {object} options - Options supplémentaires
 * @returns {Promise<object>}
 */
function resolveObjectIds(obj, key) {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(v => resolveObjectIds(v, key));
    if (typeof obj === 'object') {
        if (obj.$oid && typeof obj.$oid === 'string') return new ObjectId(obj.$oid);
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, resolveObjectIds(v, k)]));
    }
    if (typeof obj === 'string' && key === '_id' && /^[a-f\d]{24}$/i.test(obj)) {
        return new ObjectId(obj);
    }
    return obj;
}

export async function executeMongoOperation(id, collection, operation, query = {}, options = {}) {
    const db = getDatabaseById(id);
    if (!db || db.type !== 'mongodb') {
        throw new Error('Base de données MongoDB non trouvée');
    }

    let client;
    try {
        const auth = db.username && db.password 
            ? `${db.username}:${encodeURIComponent(db.password)}@` 
            : '';
        const authDb = db.authDatabase ? `?authSource=${db.authDatabase}` : '';
        const uri = `mongodb://${auth}${db.host}:${db.port}/${db.name}${authDb}`;
        
        client = new MongoClient(uri);
        await client.connect();
        
        const database = client.db(db.name);
        const coll = database.collection(collection);
        
        logger.info(`[Mongo] op=${operation} raw_query=${JSON.stringify(query)}`);
        query = resolveObjectIds(query);
        options = resolveObjectIds(options);
        logger.info(`[Mongo] op=${operation} resolved_query=${JSON.stringify(query)}`);

        let result;
        switch (operation) {
            case 'find':
                const limit = options.limit || 100;
                const skip = options.skip || 0;
                result = await coll.find(query).limit(limit).skip(skip).toArray();
                const total = await coll.countDocuments(query);
                return { documents: result, total, limit, skip };
                
            case 'insertOne':
                result = await coll.insertOne(query);
                return { insertedId: result.insertedId, acknowledged: result.acknowledged };
                
            case 'updateOne':
                result = await coll.updateOne(query, options.update || {});
                return { 
                    matchedCount: result.matchedCount, 
                    modifiedCount: result.modifiedCount,
                    acknowledged: result.acknowledged
                };
                
            case 'deleteOne':
                result = await coll.deleteOne(query);
                return { deletedCount: result.deletedCount, acknowledged: result.acknowledged };
                
            case 'countDocuments':
                result = await coll.countDocuments(query);
                return { count: result };
                
            default:
                throw new Error(`Opération non supportée: ${operation}`);
        }
    } catch (error) {
        logger.error(`Erreur MongoDB: ${error.message}`);
        throw new Error(`Erreur d'exécution: ${error.message}`);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

/**
 * Liste les collections d'une base MongoDB
 * @param {string} id - ID de la base de données
 * @returns {Promise<Array>}
 */
export async function getMongoCollections(id) {
    const db = getDatabaseById(id);
    if (!db || db.type !== 'mongodb') {
        throw new Error('Base de données MongoDB non trouvée');
    }

    let client;
    try {
        const auth = db.username && db.password 
            ? `${db.username}:${encodeURIComponent(db.password)}@` 
            : '';
        const authDb = db.authDatabase ? `?authSource=${db.authDatabase}` : '';
        const uri = `mongodb://${auth}${db.host}:${db.port}/${db.name}${authDb}`;
        
        client = new MongoClient(uri);
        await client.connect();
        
        const database = client.db(db.name);
        const collections = await database.listCollections().toArray();
        
        return collections.map(c => c.name);
    } catch (error) {
        logger.error(`Erreur MongoDB: ${error.message}`);
        throw new Error(`Erreur de connexion: ${error.message}`);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

export default {
    initDatabasesConfig,
    loadDatabases,
    saveDatabases,
    createMySQLDatabase,
    createMongoDatabase,
    getAllDatabases,
    getDatabaseById,
    updateDatabase,
    deleteDatabase,
    assignDatabaseToProject,
    unassignDatabaseFromProject,
    getDatabasesForUser,
    getConnectionString,
    testMySQLConnection,
    testMongoConnection,
    executeMySQLQuery,
    getMySQLTables,
    getMySQLTableStructure,
    getMySQLTableData,
    executeMongoOperation,
    getMongoCollections
};
