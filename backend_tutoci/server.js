const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();

// Liste des origines autorisées en dev et prod
const whitelist = [
  'http://localhost:5173',
  'https://frontend-tutoci.vercel.app',
  // vous pouvez ajouter ici d'autres domaines si besoin
];

const corsOptions = {
  origin(origin, callback) {
    // `origin` sera undefined pour les outils comme Postman ou CURL
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(
        new Error(`CORS: origine "${origin}" non autorisée.`),
        false
      );
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true,
};

// Applique CORS à toutes les routes
app.use(cors(corsOptions));
// Gère les pré-requêtes OPTIONS sur *toutes* les routes
app.options('*', cors(corsOptions));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(compression());
app.use(cookieParser());
app.use(express.json());

// --- Initialisation de SQLite ---
const DB_PATH = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erreur à l’ouverture de la DB SQLite :', err);
  } else {
    console.log('Base SQLite connectée:', DB_PATH);
  }
});

// Création de la table `user` si elle n’existe pas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_fullname TEXT NOT NULL,
      user_email TEXT NOT NULL UNIQUE
    )
  `, (err) => {
    if (err) console.error('Erreur création table user :', err);
  });
});

// Fonction générique pour exécuter une requête
function handleQuery(query, params, callback) {
  db.run(query, params, function(err) {
    if (err) {
      console.error('Erreur lors de l’exécution de la requête SQLite :', err);
      return callback(err);
    }
    return callback(null, { lastID: this.lastID, changes: this.changes });
  });
}

// Route d’inscription
app.post('/registering', (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email) {
    return res.status(400).json({
      success: false,
      message: 'Tous les champs sont requis',
      error: 'Le nom complet et l’adresse e-mail sont obligatoires.'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Adresse e-mail invalide',
      error: 'Veuillez fournir une adresse e-mail valide.'
    });
  }

  const query = `INSERT INTO user (user_fullname, user_email) VALUES (?, ?)`;
  const values = [fullname, email];

  handleQuery(query, values, (err, result) => {
    if (err) {
      console.error("Erreur lors de l'inscription :", err.message);
      return res.status(500).json({
        success: false,
        message: "Erreur lors de l'inscription. Veuillez réessayer plus tard.",
        error: err.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Inscription à la newsletter réussie',
      redirect: '/'
    });
  });
});

app.get('/healthcheck', (req, res) => {
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Le serveur écoute sur le port ${PORT}`);
});
