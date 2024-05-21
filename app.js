const WebSocket = require('ws');
const admin = require('firebase-admin');
const serviceAccount = require('./ashb.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
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
