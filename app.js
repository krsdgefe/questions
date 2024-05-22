const WebSocket = require('ws');
const admin = require('firebase-admin');
require('dotenv').config();
//const serviceAccount = require('./ashb.json');

//admin.initializeApp({
//    credential: admin.credential.cert(serviceAccount)
//});


admin.initializeApp({
    credential: admin.credential.cert({
        "type": process.env.TYPE,
        "project_id": process.env.PROJECT_ID,
        "private_key_id": process.env.PRIVATE_KEY_ID,
        "private_key": process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
        "client_email": process.env.CLIENT_EMAIL,
        "client_id": process.env.CLIENT_ID,
        "auth_uri": process.env.AUTH_URI,
        "token_uri": process.env.TOKEN_URI,
        "auth_provider_x509_cert_url": process.env.AUTH_PROVIDER_X509_CERT_URL,
        "client_x509_cert_url": process.env.CLIENT_X509_CERT_URL
    })
});

const db = admin.firestore();
const wss = new WebSocket.Server({ port: 8080 });

const clients = new Set();

wss.on('connection', async (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ message: 'Welcome new client!' }));

    const snapshot = await db.collection('questions').orderBy('timestamp').get();
    let allMessages = snapshot.docs.map(doc => doc.data());
    allMessages = allMessages.sort((a, b) => a.time - b.time);

    ws.send(JSON.stringify(allMessages));




    ws.on('message', async (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            console.log(`Received: ${message}`);

            // Mesajı Firestore'a kaydet
            await db.collection('questions').add({
                answer: parsedMessage.answer,
                time: parsedMessage.time,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('Message stored successfully');

            // Firestore'daki tüm mesajları al
            const snapshot = await db.collection('questions').orderBy('timestamp').get();
            const allMessages = snapshot.docs.map(doc => doc.data());

            // Tüm bağlı istemcilere tüm mesajları gönder
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(allMessages));
                }
            });
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client has disconnected');
        clients.delete(ws);
    });
});

console.log('WebSocket server is running on ws://localhost:8080');
