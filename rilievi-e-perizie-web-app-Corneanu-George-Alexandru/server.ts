import _http from "http";
import _url from "url";
import _fs from "fs";
import _express from "express";
import _dotenv from "dotenv";
import _cors from "cors";
import _fileUpload from "express-fileupload";
import _cloudinary, { UploadApiResponse } from 'cloudinary';
import _streamifier from "streamifier";
import _axios from "axios";
const _nodemailer = require("nodemailer");
import _bcrypt from "bcryptjs";
import _jwt from "jsonwebtoken";

// Lettura delle password e parametri fondamentali
_dotenv.config({ "path": ".env" });

// Configurazione Cloudinary
_cloudinary.v2.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key,
    api_secret: process.env.api_secret
});

// Variabili relative a MongoDB ed Express
import { MongoClient, ObjectId } from "mongodb";
const DBNAME = process.env.DBNAME;
const connectionString: string = process.env.connectionStringAtlas;
const app = _express();
const ENCRYPTION_KEY = _fs.readFileSync("./keys/encryptionKey.txt", "utf8");

// Creazione ed avvio del server
const PORT: number = parseInt(process.env.HTTP_PORT);
let paginaErrore;
const server = _http.createServer(app);
server.listen(PORT, () => {
    init();
    console.log(`Il Server è in ascolto sulla porta ${PORT}`);
});

function init() {
    _fs.readFile("./static/error.html", function (err, data) {
        if (err) {
            paginaErrore = `<h1>Risorsa non trovata</h1>`;
        }
        else {
            paginaErrore = data.toString();
        }
    });
}

//********************************************************************************************//
// Routes middleware
//********************************************************************************************//

// 1. Request log
app.use("/", (req: any, res: any, next: any) => {
    console.log(`-----> ${req.method}: ${req.originalUrl}`);
    next();
});

// 2. Gestione delle risorse statiche
app.use("/", _express.static("./static"));

// 3. Lettura dei parametri POST di req["body"] (bodyParser)
app.use("/", _express.json({ "limit": "50mb" }));
app.use("/", _express.urlencoded({ "limit": "50mb", "extended": true }));

// 4. Aggancio dei parametri del FormData e dei parametri scalari passati dentro il FormData
app.use("/", _fileUpload({ "limits": { "fileSize": (10 * 1024 * 1024) } }));

// 5. Log dei parametri GET, POST, PUT, PATCH, DELETE
app.use("/", (req: any, res: any, next: any) => {
    if (Object.keys(req["query"]).length > 0) {
        console.log(`       ${JSON.stringify(req["query"])}`);
    }
    if (Object.keys(req["body"]).length > 0) {
        console.log(`       ${JSON.stringify(req["body"])}`);
    }
    next();
});

// 6. Controllo degli accessi tramite CORS
const corsOptions = {
    origin: function (origin, callback) {
        return callback(null, true);
    },
    credentials: true
};
app.use("/", _cors(corsOptions));

// 7. Configurazione di nodemailer
const auth = {
    "user": process.env.gmailUser,
    "pass": process.env.gmailPassword,
}
const transporter = _nodemailer.createTransport({
    "service": "gmail",
    "auth": auth
});
let message = _fs.readFileSync("./message.html", "utf8");

// 8. Login
app.post("/api/login", async (req, res, next) => {
    let username = req["body"].username;
    let pwd = req["body"].password;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("utenti");
    let regex = new RegExp(`^${username}$`, "i");
    let rq = collection.findOne({ "username": regex }, { "projection": { "username": 1, "password": 1, "isAdmin": 1 } });
    rq.then((dbUser) => {
        if (!dbUser) {
            res.status(401).send("Username non valido");
        }
        else {
            _bcrypt.compare(pwd, dbUser.password, (err, success) => {
                if (err) {
                    res.status(500).send(`Bcrypt compare error: ${err.message}`);
                }
                else {
                    if (!success) {
                        res.status(401).send("Password non valida");
                    }
                    else {
                        if (req["body"].isAdminAccess) {
                            if (dbUser["isAdmin"] == true) {
                                let token = createToken(dbUser);
                                console.log(token);
                                res.setHeader("authorization", token);
                                res.setHeader("access-control-expose-headers", "authorization");
                                res.send({ "ris": "ok" });
                            }
                            else {
                                res.status(401).send("User non autorizzato");
                            }
                        }
                        else {
                            if (dbUser["isAdmin"] == false) {
                                let token = createToken(dbUser);
                                console.log(token);
                                res.setHeader("authorization", token);
                                res.setHeader("access-control-expose-headers", "authorization");
                                res.send({ "ris": "ok" });
                            }
                            else {
                                res.status(401).send("Accesso admin non valido");
                            }
                        }
                    }
                }
            })
        }
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

// 9. Controllo del token
app.use("/api/", (req: any, res: any, next: any) => {
    if (!req["body"].skipCheckToken) {
        if (!req.headers["authorization"]) {
            res.status(403).send("Token mancante");
        }
        else {
            let token = req.headers["authorization"];
            _jwt.verify(token, ENCRYPTION_KEY, (err, payload) => {
                if (err) {
                    res.status(403).send(`Token non valido: ${err}`);
                }
                else {
                    let newToken = createToken(payload);
                    console.log(newToken);
                    res.setHeader("authorization", newToken);
                    res.setHeader("access-control-expose-headers", "authorization");
                    req["payload"] = payload;
                    next();
                }
            });
        }
    }
    else {
        next();
    }
});

function createToken(data) {
    let currentTimeSeconds = Math.floor(new Date().getTime() / 1000);
    let payload = {
        "_id": data._id,
        "username": data.username,
        "iat": data.iat || currentTimeSeconds,
        "exp": currentTimeSeconds + parseInt(process.env.durata_token)
    }
    let token = _jwt.sign(payload, ENCRYPTION_KEY);
    return token;
}

//********************************************************************************************//
// Routes finali di risposta al client
//********************************************************************************************//

app.get("/api/getPerizie", async (req, res, next) => {
    let params = {};
    if (req["query"].codiceOperatore != "Tutti") {
        params["codiceOperatore"] = new ObjectId(req["query"].codiceOperatore)
    }
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection("perizie");
    let rq = collection.find(params).toArray();
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.patch("/api/updatePerizia", async (req, res, next) => {
    let updatedPerizia = req["body"];
    let _id = new ObjectId(updatedPerizia._id);
    updatedPerizia["codiceOperatore"] = new ObjectId(updatedPerizia.codiceOperatore);
    delete updatedPerizia["_id"];
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection("perizie");
    let rq = collection.updateOne({ "_id": _id }, { "$set": updatedPerizia });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.post("/api/insertNewPerizia", async (req, res, next) => {
    let newPerizia = req["body"];
    newPerizia["codiceOperatore"] = new ObjectId(newPerizia["codiceOperatore"]);
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection("perizie");
    let rq = collection.insertOne(newPerizia);
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.get("/api/getOperatoreById", async (req, res, next) => {
    let _id = new ObjectId(req["query"]._id);
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection("utenti");
    let rq = collection.findOne({ "_id": _id }, { "projection": { "username": 1 } });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.get("/api/getCurrentUserData", async (req, res, next) => {
    let username = req["query"].username;
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection("utenti");
    let rq = collection.findOne({ "username": username });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.get("/api/getUsers", async (req, res, next) => {
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection("utenti");
    let rq = collection.find().skip(1).toArray();
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.delete("/api/deleteUser", async (req, res, next) => {
    let _id = new ObjectId(req["body"]._id);
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection("utenti");
    let rq = collection.deleteOne({ "_id": _id });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.patch("/api/updateUser", async (req, res, next) => {
    let updatedUser = req["body"];
    let _id = new ObjectId(updatedUser._id);
    delete updatedUser["_id"];
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection("utenti");
    let rq = collection.updateOne({ "_id": _id }, { "$set": updatedUser });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.post("/api/createUser", async (req, res, next) => {
    let newUser = req["body"];
    let password = generaPassword();
    newUser["password"] = password;
    newUser["passwordInChiaro"] = password;
    newUser["isAdmin"] = false;
    _cloudinary.v2.uploader.upload(newUser.img, { "folder": "Rilievi-e-Perizie" })
        .catch((err) => {
            res.status(500).send(`Error while uploading file on Cloudinary: ${err}`);
        })
        .then(async function (response: UploadApiResponse) {
            newUser["img"] = response.secure_url;
            const client = new MongoClient(connectionString);
            await client.connect();
            let collection = client.db(DBNAME).collection("utenti");
            let rq = collection.insertOne(newUser);
            rq.then((data) => {
                res.send({
                    "username": newUser["username"],
                    "password": password
                });
            });
            rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
            rq.finally(() => client.close());
        });
});

app.patch("/api/changePassword", async (req, res, next) => {
    let aus = req["body"];
    const client = new MongoClient(connectionString);
    await client.connect();
    let collection = client.db(DBNAME).collection("utenti");
    let rq = collection.updateOne({ "username": aus.username }, { "$set": { "password": _bcrypt.hashSync(aus.nuovaPassword, 10), "passwordInChiaro": aus.nuovaPassword } });
    rq.then((data) => {
        if (data.matchedCount != 0) {
            res.send(data);
        }
        else {
            res.send("Username non trovato");
        }
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err}`));
    rq.finally(() => client.close());
});

app.post("/api/sendNewPassword", async (req, res, next) => {
    let username = req["body"].username;
    let password = req["body"].password || generaPassword();
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("utenti");
    let rq = collection.updateOne({ "username": username }, { "$set": { "password": _bcrypt.hashSync(password, 10), "passwordInChiaro": password } });
    rq.then(async (data) => {
        if (data.matchedCount != 0) {
            message = message.replace("__user", username).replace("__password", password);
            let mailOptions = {
                "from": auth.user,
                "to": auth.user,
                "subject": "Password di accesso a Rilievi e Perizie",
                "html": message,
            }
            transporter.sendMail(mailOptions, (err, info) => {
                console.log(info);
                if (err) {
                    res.status(500).send(`Errore invio mail:\n${err.message}`);
                }
                else {
                    res.send("Ok");
                }
            });
            message = message.replace(username, "__user").replace(password, "__password");
        }
        else {
            res.send("Username non trovato");
        }
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

function generaPassword() {
    let password = "";
    let caratteri = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (let i = 0; i < 8; i++) {
        password += caratteri[generaNumero(0, caratteri.length)];
    }
    return password;
}

function generaNumero(a, b) {
    return Math.floor((b - a) * Math.random()) + a;
}

//********************************************************************************************//
// Default route e gestione degli errori
//********************************************************************************************//

app.use("/", (req, res, next) => {
    res.status(404);
    if (req.originalUrl.startsWith("/api/")) {
        res.send(`Api non disponibile`);
    }
    else {
        res.send(paginaErrore);
    }
});

app.use("/", (err, req, res, next) => {
    console.log("************* SERVER ERROR ***************\n", err.stack);
    res.status(500).send(err.message);
});