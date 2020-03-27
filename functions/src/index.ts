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
            sound: "default"
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

export const NewOfferNotification = functions.region('europe-west1').firestore.document('ProductRequests/{doc}/offers/{offer}').onWrite(async (change, _context) => {
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

export const NewOrderNotification = functions.region('europe-west1').firestore.document('Orders/{doc}').onWrite(async (change, _context) => {
    let { doc } = _context.params;
    const newData = change.after.data()

    if (newData) {
        let products = newData.products;
        for (let p of products) {
            let token = await getUserToken(p.sellerUid);
            let productName: string = p.productName;
            await sendToUser(
                token,
                'فاتورة مبيعات جديدة',
                'تم بيع المنتج ' + productName,
            ).catch((e) => console.log(e));
        }


    }
    return null;
});

export const RoleAcceptedNotification = functions.region('europe-west1').firestore.document('Users/{doc}').onUpdate(async (change, _context) => {
    let { doc } = _context.params;
    const newData = change.after.data()
    const oldData = change.before.data()

    if (newData && oldData && oldData.role.pending && !newData.role.pending) {
        if (oldData.role.requestedRole === newData.role.currentRole) {
            let roleText: string;
            if (newData.role.currentRole == 0) roleText = 'مشرف';
            if (newData.role.currentRole == 1) roleText = 'متسوق شخصي';
            if (newData.role.currentRole == 2) roleText = 'زبون';
            await sendToUser(
                newData.notfificationToken,
                'تم قبول الترقية',
                'تم قبول ترقية حسابك الى ' + roleText,
            ).catch((e) => console.log(e));
        }
    }
    return null;
});

export const ChatsNotification = functions.region('europe-west1').firestore.document('Chats/{doc}').onWrite(async (change, _context) => {
    let { doc } = _context.params;
    const newData = change.after.data()

    if (newData) {
        let message = newData.messages[newData.messages.length - 1];
        let person0: string = newData.participantsUids[0];
        let person0Name: string = newData.participantsNames[0];
        let person1Name: string = newData.participantsNames[1];
        let person0Token: string = await getUserToken(newData.participantsUids[0]);
        let person1Token: string = await getUserToken(newData.participantsUids[1]);
        if (message.sender == person0) {
            await sendToUser(
                person1Token,
                'رساله من ' + person0Name,
                message.message,
            ).catch((e) => console.log(e));
        } else {
            await sendToUser(
                person0Token,
                'رساله من ' + person1Name,
                message.message,
            ).catch((e) => console.log(e));
        }
    }
    return null;
});