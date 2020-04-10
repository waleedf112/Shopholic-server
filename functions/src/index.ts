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

export const NewOfferNotification = functions.firestore.document('ProductRequests/{doc}/offers/{offer}').onWrite(async (change, _context) => {
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
        await sendToUser(
            token,
            'عرض جديد',
            'عرض جديد على طلبك ' + productName,
        ).catch((e) => console.log(e));
    }
    return null;
});

export const NewOrderNotification = functions.firestore.document('Orders/{doc}').onCreate(async (change, _context) => {
    const newData = change.data()

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

export const RoleAcceptedNotification = functions.firestore.document('Users/{doc}').onUpdate(async (change, _context) => {
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

export const ChatsNotification = functions.firestore.document('Chats/{doc}').onWrite(async (change, _context) => {
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

export const UpdateTracking = functions.pubsub.schedule('every 3 minutes').onRun(async (_context) => {

    function switchStatus(status: number): number {
        var d = Math.random();
        if (status == 0) {
            if (d < 0.5) return 1;
            else return 2;
        }
        if (status == 2) {
            if (d < 0.5) return 3;
            else return 4;
        }
        if (status == 4 || status == 3) {
            if (d < 0.5) return 5;
            else return 6;
        }
        return -99;
    }

    function getStatusIcon(status: number): number {
        if (status == 0) return 0;
        if (status == 1) return 2;
        if (status == 2) return 0;
        if (status == 3) return 1;
        if (status == 4) return 0;
        if (status == 5) return 3;
        if (status == 6) return 0;
        return 99;
    }

    await admin.firestore().collection('Orders').listDocuments().then(async (snapshot) => {
        let documents = snapshot;
        for (let doc of documents) {
            let docStatus;
            let docIcon;
            let cancel: boolean = false;
            let token: string;
            let orderId: string;
            await doc.get().then(async (value) => {
                if (value.data().statusMessage != 6 && value.data().statusMessage != 5 && value.data().statusMessage != 1) {
                    token = await getUserToken(value.data().uid);
                    orderId = value.data().number;
                    docStatus = switchStatus(value.data().statusMessage);
                    docIcon = getStatusIcon(docStatus);
                } else {
                    cancel = true;
                }
            });
            if (!cancel) {
                await doc.update({
                    statusIconIndex: docIcon,
                    statusMessage: docStatus,
                }).catch((e) => console.log(e));
                await sendToUser(
                    token,
                    'تحديث على طلبك رقم ' + orderId,
                    docStatus,
                ).catch((e) => console.log(e));
            }
        }
    });
    return null;
});

export const SendGlobalNofitication = functions.https.onRequest(async (req, res) => {
    const head = req.query.head;
    const body = req.query.body;
    let payload = {
        notification: {
            title: head,
            body: body,
            sound: "default"
        },
        data: {
            click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
    };
    await admin.messaging().sendToTopic('main', payload).catch((e) => console.log(e));
    res.send(body);
    return null;
});