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

async function getUserToken(uid: string): Promise<string> {
    let result: string;
    await admin.firestore().collection('Users').doc(uid).get().then((snapshot) => {
        result = snapshot.data().notfificationToken;
    });
    return result;
}

export const NewOfferNotification = functions.region('europe-west1').firestore.document('ProductRequests/{doc}/offers/{offer}').onUpdate(async (change, _context) => {
    const newData = change.after.data()
    if (newData) {
        let token = await getUserToken(newData.traderUid);
        let payload = {
            notification: {
                title: 'test',
                body: 'test test test',
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
            },
        };
        await sendToUser(token, payload).catch((e) => console.log(e));
    }
    return null;
});