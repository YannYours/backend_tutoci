const express = require('express');
const bodyParser = require('body-parser')
const path = require('path')
const nodemailer = require('nodemailer');
const compression = require('compression')
const cookieParser = require('cookie-parser')
const cors = require('cors');
const mysql = require('mysql2')

const app = express();
app.use(cors({
    origin: '*'
}))
app.use(bodyParser.urlencoded({ extended: true }));
app.use(compression())
app.use(cookieParser());
app.use(express.static('pages'));
app.use(express.json());

const transporter = nodemailer.createTransport({
    host: 'max1.ngomory.ci',
    port: 587,
    secure: false,
    auth: {
        user: 'smtp-dev@talentium.info',
        pass: 'TDBuIodzvNpQ'
    }
});

const config = { host: 'localhost', user: 'root', password: 'rootyann@12345', database: 'bd_tutoci' };
const pool = mysql.createPool({
    connectionLimit: 50,
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    connectTimeout: 10000,
    waitForConnections: true
});

let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function handleQuery(query, params, callback) {
    pool.getConnection((err, connection) => {
        if (err) {
            console.log('Erreur lors de l\'acquisition de la connexion:', err);
            return callback(err);
        }
        connection.query(query, params, (error, results) => {
            connection.release();

            if (error) {
                if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                    console.log('Connexion perdue, tentative de reconnexion...');
                    handleDisconnect();
                    return callback(error);
                } else {
                    console.log('Erreur lors de l\'exécution de la requête:', error);
                    return callback(error);
                }
            }

            return callback(null, results);
        });
    });
}

function handleDisconnect() {
    if (reconnectAttempts >= maxReconnectAttempts) {
        console.log('Maximum de tentatives de reconnexion atteint.');
        return;
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.log('Erreur lors de l\'acquisition de la connexion:', err);
            reconnectAttempts++;
            setTimeout(handleDisconnect, 2000);
        } else {
            reconnectAttempts = 0;
            connection.release();
        }
    });
}

app.post('/registering', (req, res) => {
    const { fullname, email } = req.body;

    // 1. Validation des champs
    if (!fullname || !email) {
        return res.status(400).json({
            success: false,
            message: 'Tous les champs sont requis',
            error: 'Le nom complet et l’adresse e-mail sont obligatoires.'
        });
    }

    // 2. Vérification de format d'email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Adresse e-mail invalide',
            error: 'Veuillez fournir une adresse e-mail valide.'
        });
    }

    // 3. Préparation de la requête SQL
    const query = `INSERT INTO user (user_fullname, user_email) VALUES (?, ?)`;
    const values = [fullname, email];

    handleQuery(query, values, (err, results) => {
        if (err) {
            console.error("Erreur lors de l'inscription :", err.message);
            return res.status(500).json({
                success: false,
                message: "Erreur lors de l'inscription. Veuillez réessayer plus tard.",
                error: err.message
            });
        }

        // 4. Préparation de l'email HTML
        const mailOptions = {
            from: '"TutoCI Newsletter" <smtp-dev@talentium.info>',
            to: email,
            subject: '🎉 Bienvenue sur TutoCI - Inscription Réussie !',
            text: `Bonjour ${fullname},\n\nVotre inscription à la newsletter TutoCI a bien été prise en compte.\n\nMerci et à très bientôt !`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2>🎉 Bienvenue sur <span style="color:#007BFF;">TutoCI</span> !</h2>
                    <p>Bonjour <strong>${fullname}</strong>,</p>
                    <p>Merci de vous être inscrit à notre newsletter. Vous êtes désormais inscrit(e) pour recevoir nos dernières actualités, tutoriels et astuces autour de la tech et du développement web !</p>
                    <p>📩 Si vous avez des questions ou des suggestions, n'hésitez pas à nous contacter.</p>
                    <br>
                    <p>À très bientôt,</p>
                    <p>L’équipe <strong>TutoCI</strong></p>
                    <hr>
                    <small style="color:#888;">Cet e-mail vous a été envoyé automatiquement suite à votre inscription. Si vous n’êtes pas à l’origine de cette action, veuillez l’ignorer.</small>
                </div>
            `
        };

        // 5. Envoi de l'email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Erreur lors de l'envoi de l'e-mail :", error);
                return res.status(500).json({
                    success: false,
                    message: "Inscription réussie, mais l'e-mail de confirmation n'a pas pu être envoyé.",
                    error: error.message
                });
            }

            // 6. Réponse en cas de succès complet
            return res.status(200).json({
                success: true,
                message: 'Inscription à la newsletter réussie',
                redirect: '/'
            });
        });
    });
});



app.listen(3000, () => {
    console.log('Le serveur écoute sur le port 3000');
});
