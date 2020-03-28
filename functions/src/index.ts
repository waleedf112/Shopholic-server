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
        await sendToUser(
            token,
            'عرض جديد',
            'عرض جديد على طلبك ' + productName,
        ).catch((e) => console.log(e));
    }
    return null;
});

export const NewOrderNotification = functions.region('europe-west1').firestore.document('Orders/{doc}').onCreate(async (change, _context) => {
    let { doc } = _context.params;
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

export const UpdateTracking = functions.region('europe-west1').pubsub.schedule('every 10 minutes').onRun(async (_context) => {
    function switchStatus(status: string): string {
        var d = Math.random();

        if (status == 'تم اضافة الطلب') {
            if (d < 0.5) return 'تم الغاء الطلب';
            else return 'تم شحن طلبك';
        }
        if (status == 'تم شحن طلبك') {
            if (d < 0.5) return 'طلبك متأخر عن الموعد المعتاد!';
            else return 'الشحنة في طريقها اليك!';
        }
        if (status == 'الشحنة في طريقها اليك!' || status == 'طلبك متأخر عن الموعد المعتاد!') {
            if (d < 0.5) return 'تم ارجاع شحنتك';
            else return 'تم توصيل الطلب';
        }
        return '';
    }
    function getStatusIcon(status: string): number {
        if (status == 'تم اضافة الطلب') return 0;
        if (status == 'تم الغاء الطلب') return 2;
        if (status == 'تم شحن طلبك') return 0;
        if (status == 'طلبك متأخر عن الموعد المعتاد!') return 1;
        if (status == 'الشحنة في طريقها اليك!') return 0;
        if (status == 'تم ارجاع شحنتك') return 3;
        if (status == 'تم توصيل الطلب') return 2;
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
                if (value.data().statusMessage !== 'تم توصيل الطلب' && value.data().statusMessage !== 'تم ارجاع شحنتك' && value.data().statusMessage !== 'تم الغاء الطلب') {
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
