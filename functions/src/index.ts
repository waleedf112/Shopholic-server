import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as adminKey from "../admin.json";

const serviceAccount = adminKey as admin.ServiceAccount

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://shopholic-app.firebaseio.com"
  });

export const NewOfferNotification = functions.region('europe-west1').firestore.document('ProductRequests/{doc}/offers/{offer}').onUpdate(async (change, _context) => {
    const newData = change.after.data()
    if (newData) {
        console.log(newData['traderUid']);
        let payload: any;
        payload = {
            notification: {
                title: 'test',
                body: 'test test test',
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
            },
        };
        await admin.messaging().sendToDevice('topic', payload);
    }
    return null;
});