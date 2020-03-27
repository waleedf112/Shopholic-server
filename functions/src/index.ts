import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as adminKey from "../admin.json";

const serviceAccount = adminKey as admin.ServiceAccount

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://shopholic-app.firebaseio.com"
});

async function sendToUser(token: string, title: string, message: string) {
    let payload = {
        notification: {
            title: title,
            body: message,
        },
        data: {
            click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
    };
    await admin.messaging().sendToDevice(token, payload).catch((e) => console.log(e));
}

async function getUserToken(uid: string): Promise<string> {
    let result: string;
    await admin.firestore().collection('Users').doc(uid).get().then((snapshot) => {
        result = snapshot.data().notfificationToken;
    });
    return result;
}

export const NewOfferNotification = functions.region('europe-west1').firestore.document('ProductRequests/{doc}/offers/{offer}').onUpdate(async (change, _context) => {
    let { doc, offer } = _context.params;

    const newData = change.after.data()
    if (newData) {
        let uid: string;
        let productName: string;
        await admin.firestore().collection('ProductRequests').doc(doc).get().then((snapshot) => {
            uid = snapshot.data().uid;
            productName = snapshot.data().productName;
        });
        let token = await getUserToken(uid);

        console.log(token)
        await sendToUser(
            token,
            'عرض جديد',
            'عرض جديد على طلبك ' + productName,
        ).catch((e) => console.log(e));
    }
    return null;
});