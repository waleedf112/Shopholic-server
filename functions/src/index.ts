import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as adminKey from "../admin.json";

const serviceAccount = adminKey as admin.ServiceAccount

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://shopholic-app.firebaseio.com"
});

async function sendToUser(token: string, payload: object) {
    await admin.messaging().sendToDevice(token, payload);
}

async function getUserToken(uid: string) {
    return await admin.firestore().collection('Users').doc(uid).get().then((snapshot) => {
        return snapshot.data;
    });
}

export const NewOfferNotification = functions.region('europe-west1').firestore.document('ProductRequests/{doc}/offers/{offer}').onUpdate(async (change, _context) => {
    const newData = change.after.data()
    if (newData) {
        let token = await getUserToken(newData['traderUid']);
        console.log(token);
        let payload = {
            notification: {
                title: 'test',
                body: 'test test test',
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
            },
        };
        await sendToUser('', payload).catch((e) => console.log(e));
    }
    return null;
});