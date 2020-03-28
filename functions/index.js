const functions = require('firebase-functions');
const admin = require("firebase-admin");
const FirebaseAuth = require('firebaseauth')
const serviceAccount = require("./serviceAccount.json");
const bodyParser = require('body-parser')
const cors = require('cors');
const express = require('express');
const nodemailer = require('nodemailer');

const { check_admin_nisit_permission, permission_professor, permission_all, nisit_permission } = require('./permission/func')
const { sendEmail } = require('./send_email/setting')

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://mitproject-895cc.firebaseio.com"
});

const app = express();
const firebase = new FirebaseAuth("AIzaSyC3-bfM3oSxRmedmIz7wa6kbKs2byqQpq4");
const db = admin.firestore();

app.use(bodyParser.json())
app.use(cors())


app.post('/Register', async (req, res) => {

    const email = req.body.email
    const password = req.body.password
    const extras = {
        name: req.body.firstname + " " + req.body.lastname
    }

    await db.collection('users').where('id', '==', req.body.id).get()
        .then((response) => {
            let customclaims;
            if (response.empty) {
                const user_data = {
                    id: req.body.id,
                    firstname: req.body.firstname,
                    lastname: req.body.lastname,
                    email: req.body.email,
                    role: req.body.role
                }
                if (req.body.role === 'ADMIN') {
                    customclaims = {
                        admin: true
                    }
                }
                else if (req.body.role === 'PROFESSOR') {
                    customclaims = {
                        professor: true
                    }
                }
                else if (req.body.role === 'NISIT') {
                    customclaims = {
                        nisit: true
                    }
                }
                firebase.registerWithEmail(email, password, extras, function (err, data) {
                    if (err) {
                        return res.status(500).json({
                            message: err.message
                        })
                    }
                    else {
                        const user = data.user
                        const uid = user.id
                        console.log(customclaims)
                        admin.auth().setCustomUserClaims(uid, customclaims)
                            .then(async () => {
                                await db.collection('users').doc(uid).set(user_data)
                                    .then(() => {
                                        return res.status(201).json({
                                            message: "Register Success",
                                            status: {
                                                dataStatus: "SUCCESS"
                                            }
                                        })
                                    })
                            })
                            .catch(err => {
                                return res.status(500).json({
                                    message: err.message
                                })
                            })
                    }
                })
            }
            else {
                return res.status(500).json({
                    message: "ไม่สามารถเพิ่มได้ เนื่องจากมีบุคคลนี้แล้ว"
                })
            }
        })
})

app.post('/login', (req, res) => {

    const email = req.body.email;
    const password = req.body.password;
    firebase.signInWithEmail(email, password, async function (err, data) {
        if (err) {
            return res.status(500).json({
                message: err.message
            })
        }
        else {
            const user = data.user
            const uid = user.id
            await db.collection('users').doc(uid).get()
                .then(result => {
                    if (result.exists) {
                        user.role = result.data().role
                    }
                    return res.status(200).json({
                        message: "Login Success",
                        status: {
                            dataStatus: "SUCCESS"
                        },
                        data: data
                    })
                })
                .catch(err => {
                    return res.status(500).json({
                        message: err.message
                    })
                })
        }
    })
})


app.get('/ListTeacher', check_admin_nisit_permission, async (req, res) => {

    await db.collection('users').where('role', '==', 'PROFESSOR')
        .get()
        .then(async user => {
            if (user.empty) {
                return res.status(404).json({
                    message: "No Teacher Found ",
                    data: []
                })
            }
            else {
                const promise = [];
                const result = [];
                let appoint = [];
                user.forEach(row => {
                    promise.push(db.collection('appointment').where('teacher_id', '==', row.id).where('status', '==', 'APPROVE')
                        .get()
                        .then((record) => {
                            if (!record.empty) {
                                appoint = [];
                                record.forEach(row_appoint => {
                                    appoint.push({
                                        appoint_id: row_appoint.id,
                                        title: row_appoint.data().Title,
                                        detail: row_appoint.data().Detail,
                                        day: row_appoint.data().day,
                                        start_time: row_appoint.data().start_time,
                                        end_time: row_appoint.data().end_time,
                                        status: row_appoint.data().status
                                    })
                                })
                                result.push({
                                    id: row.id,
                                    firstname: row.data().firstname,
                                    lastname: row.data().lastname,
                                    appoints: appoint
                                })
                            }
                            else {
                                result.push({
                                    id: row.id,
                                    firstname: row.data().firstname,
                                    lastname: row.data().lastname,
                                    appoints: []
                                })
                            }
                        })
                    )
                })
                await Promise.all(promise);
                return res.status(200).json({
                    message: 'Get data Success',
                    status: {
                        dataStatus: "SUCCESS"
                    },
                    data: result
                })
            }
        })
})


//AppointMent
app.post('/postAppointMent', permission_all, async (req, res) => {

    let email_to, firstname, lastname, role;
    console.log("Post AppointMent")
    console.log(req.permission)
    let data = {}
    let request_id;

    if (req.permission.nisit === true) {
        console.log("NISIT")
        data = {
            Title: req.body.Title,
            Detail: req.body.Detail,
            day: req.body.day,
            start_time: req.body.start_time,
            end_time: req.body.end_time,
            teacher_id: req.body.teacher_id,
            status: 'PENDING'
        }
        console.log(data)
        await db.collection('appointment').add(data)
            .then(async (rec) => {
                await db.collection('request_appointment')
                    .add({
                        user_id: req.user_id,
                        appoint_id: rec.id,
                        approved_status: 'PENDING'
                    })
                    .then(async (resp) => {
                        let uid = req.user_id
                        request_id = resp.id
                        await db.collection('users').doc(uid).get()
                            .then(usr => {
                                firstname = usr.data().firstname;
                                lastname = usr.data().lastname;
                                email_to = usr.data().email;
                            })
                        let emailTeacher = await getEmailTeacher(req.body.teacher_id);
                        await sendEmail(email_to, '', '', 'NISIT', request_id, data.Title, data.Detail, data.day, data.start_time, data.end_time, 'APPOINTMENT')
                        await sendEmail(emailTeacher, firstname, lastname, 'PROFESSOR', request_id, data.Title, data.Detail, data.day, data.start_time, data.end_time, 'APPOINTMENT')
                        console.log("JJJJO")
                    })
            })
            .then(() => {
                return res.status(200).json({
                    message: "Add Request Appointment Success",
                    status: {
                        dataStatus: "SUCCESS"
                    }
                })
            })
            .catch(err => {
                return res.status(500).json({
                    message: err.message
                })
            })
    }
    else if (req.permission.admin === true) {
        console.log("ADMIN")
        data = {
            Title: req.body.Title,
            Detail: req.body.Detail,
            day: req.body.day,
            start_time: req.body.start_time,
            end_time: req.body.end_time,
            teacher_id: req.body.teacher_id,
            status: 'APPROVE'
        }
        console.log(data)
        await db.collection('appointment').add(data)
            .then(async (rec) => {
                await db.collection('request_appointment')
                    .add({
                        user_id: req.user_id,
                        appoint_id: rec.id,
                        approved_status: 'APPROVE'
                    })
                    .then(async (resp) => {
                        let uid = req.user_id
                        request_id = resp.id
                        await db.collection('users').doc(uid).get()
                            .then(usr => {
                                firstname = usr.data().firstname;
                                lastname = usr.data().lastname;
                                email_to = usr.data().email;
                            })
                        let emailTeacher = await getEmailTeacher(req.body.teacher_id);
                        await sendEmail(emailTeacher, '', '', 'ADMIN', request_id, data.Title, data.Detail, data.start_time, data.end_time, 'APPOINTMENT')
                        await sendEmail(email_to, '', '', 'ADMIN', request_id, data.Title, data.Detail, data.day, data.start_time, data.end_time, 'SELF')
                    })
                return res.status(200).json({
                    message: "Add Request Appointment Success",
                    status: {
                        dataStatus: "SUCCESS"
                    }
                })
            })
            .catch(err => {
                return res.status(500).json({
                    message: err.message
                })
            })
    }
    else {
        console.log("PROFESSOR")
        await db.collection('appointment').add({
            Title: req.body.Title,
            Detail: req.body.Detail,
            day: req.body.day,
            start_time: req.body.start_time,
            end_time: req.body.end_time,
            teacher_id: req.user_id,
            status: 'APPROVE'
        })
            .then(async (rec) => {
                await db.collection('request_appointment').add({
                    user_id: req.user_id,
                    appoint_id: rec.id,
                    approved_status: 'APPROVE'
                })
                return res.status(200).json({
                    message: "Add Request Appointment Success",
                    status: {
                        dataStatus: "SUCCESS"
                    }
                })
            })
            .catch(err => {
                return res.status(500).json({
                    message: err.message
                })
            })
        console.log(data)
    }
})


//Ajarn get AppointMent

app.get('/ListAppointMent', permission_all, async (req, res) => {

    await db.collection('appointment').where('teacher_id', '==', req.user_id)
        .get()
        .then(async result => {
            if (result.empty) {
                return res.status(404).json({
                    message: "No List Appointment ",
                    data: []
                })
            }

            const promise = [];

            const aa = [];
            result.forEach(row => {
                promise.push(db.collection('request_appointment').where('appoint_id', '==', row.id).get()
                    .then(resp => {
                        resp.forEach(rec => {
                            aa.push({
                                request_id: rec.id,
                                appoint_id: row.id,
                                title: row.data().Title,
                                detail: row.data().Detail,
                                day: row.data().day,
                                start_time: row.data().start_time,
                                end_time: row.data().end_time,
                                user_id: rec.data().user_id,
                                status: rec.data().approved_status
                            })
                        })
                    })
                )
            })

            await Promise.all(promise)

            const data = [];

            await db.collection('users').get()
                .then(users => {
                    users.forEach(user => {
                        aa.forEach(appoint => {
                            if (user.id === appoint.user_id) {
                                data.push({
                                    request_id: appoint.request_id,
                                    appoint_id: appoint.appoint_id,
                                    title: appoint.title,
                                    detail: appoint.detail,
                                    day: appoint.day,
                                    start_time: appoint.start_time,
                                    end_time: appoint.end_time,
                                    student_name: user.data().firstname + " " + user.data().lastname,
                                    approved_status: appoint.status
                                })
                            }
                        })
                    })
                })

            return res.status(200).json({
                message: "List AppointMent Success",
                status: {
                    dataStatus: "SUCCESS"
                },
                data: data
            })
        })
})

async function getTeacherName(id) {
    let teacher_name;
    await db.collection('users').doc(id).get()
        .then(user => {
            teacher_name = user.data().firstname + " " + user.data().lastname
        })
    return teacher_name;
}

app.get('/ListStudentAppoint', nisit_permission, async (req, res) => {

    const appoint = [];
    await db.collection('request_appointment').where('user_id', '==', req.user_id)
        .get()
        .then(async resp => {

            resp.forEach(row => {
                appoint.push({
                    id: row.id,
                    user_id: row.data().user_id,
                    appoint_id: row.data().appoint_id,
                    approved_status: row.data().approved_status
                })
            })

            const promise = [];
            const people_appoint = [];
            appoint.forEach(rec => {
                promise.push(db.collection('appointment').doc(rec.appoint_id)
                    .get()
                    .then(async result => {
                        if (result.exists) {
                            let teacher_name = await getTeacherName(result.data().teacher_id)
                            people_appoint.push({
                                request_id: rec.id,
                                user_id: rec.user_id,
                                title: result.data().Title,
                                detail: result.data().Detail,
                                day: result.data().day,
                                start_time: result.data().start_time,
                                end_time: result.data().end_time,
                                approved_status: rec.approved_status,
                                teacher_id: result.data().teacher_id,
                                teacher_name: teacher_name
                            })
                        }
                    })
                    .catch(err => {
                        console.log(err.message)
                        return res.status(500).json({
                            message: err.message
                        })
                    })
                )
            })

            await Promise.all(promise);
            const appoints = [];
            await db.collection('users').doc(req.user_id).get()
                .then(async result => {
                    people_appoint.forEach(people => {
                        appoints.push({
                            request_id: people.request_id,
                            title: people.title,
                            detail: people.detail,
                            day: people.day,
                            start_time: people.start_time,
                            end_time: people.end_time,
                            approved_status: people.approved_status,
                            teacher_name: people.teacher_name
                        })
                    })
                    return res.status(200).json({
                        message: "Get Appoint By Student Success",
                        data: {
                            id: result.data().id,
                            firstname: result.data().firstname,
                            lastname: result.data().lastname,
                            appoints: appoints
                        },
                        status: {
                            dataStatus: "SUCCESS"
                        }
                    })
                })
                .catch(err => {
                    return res.status(500).json({
                        message: err.message
                    })
                })

        })
})

app.delete('/cancel_request/:id', permission_all, async (req, res) => {

    const id = req.params.id
    if (req.permission.nisit === true) {
        await db.collection('request_appointment').doc(id).get()
            .then(async result => {
                let data = {}
                if (result.exists) {
                    await db.collection('request_appointment').doc(id).get()
                        .then((resp) => {
                            data = {
                                uid: resp.data().user_id,
                                appoint_id: resp.data().appoint_id
                            }
                            return data;
                        })
                        .then(async (data) => {
                            let title, detail, start_time, end_time, day, teacher_id, email;
                            await db.collection('appointment').doc(data.appoint_id).get()
                                .then(appoint => {
                                    title = appoint.data().Title
                                    detail = appoint.data().Detail
                                    start_time = appoint.data().start_time
                                    end_time = appoint.data().end_time
                                    day = appoint.data().day
                                    teacher_id = appoint.data().teacher_id
                                })
                            email = await getEmailTeacher(teacher_id);
                            await sendEmail(email, '', '', 'PROFESSOR', id, title, detail, day, start_time, end_time, 'CANCEL');
                        })
                    let ap_id;
                    await db.collection('request_appointment').doc(id).get()
                        .then(resp => {
                            ap_id = resp.data().appoint_id
                        })
                    await db.collection('appointment').doc(ap_id).delete()
                    await db.collection('request_appointment').doc(id).delete()
                        .then(() => {
                            return res.status(200).json({
                                message: "Cancel Request Success",
                                status: {
                                    dataStatus: "SUCCESS"
                                }
                            })
                        })
                }
                else {
                    return res.status(404).json({
                        message: "No Matching Document",
                        data: []
                    })
                }
            })
            .catch(err => {
                return res.status(500).json({
                    message: err.message
                })
            })
    }
    else if (req.permission.professor === true) {
        await db.collection('request_appointment').doc(id).get()
            .then(async result => {
                let data = {}
                if (result.exists) {
                    await db.collection('request_appointment').doc(id).get()
                        .then((resp) => {
                            data = {
                                uid: resp.data().user_id,
                                appoint_id: resp.data().appoint_id
                            }
                            return data;
                        })
                        .then(async (data) => {
                            let title, detail, start_time, end_time, day, teacher_id, email;
                            await db.collection('appointment').doc(data.appoint_id).get()
                                .then(appoint => {
                                    title = appoint.data().Title
                                    detail = appoint.data().Detail
                                    start_time = appoint.data().start_time
                                    end_time = appoint.data().end_time
                                    day = appoint.data().day
                                })
                            email = await getEmailTeacher(data.uid);
                            await sendEmail(email, '', '', 'NISIT', id, title, detail, day, start_time, end_time, 'CANCEL');
                        })
                    let ap_id;
                    await db.collection('request_appointment').doc(id).get()
                        .then(resp => {
                            ap_id = resp.data().appoint_id
                        })
                    await db.collection('appointment').doc(ap_id).delete()
                    await db.collection('request_appointment').doc(id).delete()
                        .then(() => {
                            return res.status(200).json({
                                message: "Cancel Request Success",
                                status: {
                                    dataStatus: "SUCCESS"
                                }
                            })
                        })
                }
                else {
                    return res.status(404).json({
                        message: "No Matching Document",
                        data: []
                    })
                }
            })
            .catch(err => {
                return res.status(500).json({
                    message: err.message
                })
            })
    }
    else{
        await db.collection('request_appointment').doc(id).get()
        .then(async result => {
            let data = {}
            if (result.exists) {
                await db.collection('request_appointment').doc(id).get()
                    .then((resp) => {
                        data = {
                            uid: resp.data().user_id,
                            appoint_id: resp.data().appoint_id
                        }
                        return data;
                    })
                    .then(async (data) => {
                        let title, detail, start_time, end_time, day, teacher_id, email;
                        await db.collection('appointment').doc(data.appoint_id).get()
                            .then(async (appoint) => {
                                title = appoint.data().Title
                                detail = appoint.data().Detail
                                start_time = appoint.data().start_time
                                end_time = appoint.data().end_time
                                day = appoint.data().day,
                                teacher_id = appoint.data().teacher_id
                                email = await getEmailTeacher(teacher_id);
                                await sendEmail(email, '', '', 'ADMIN', id, title, detail, day, start_time, end_time, 'CANCEL');
                            })
                    })
                let ap_id;
                await db.collection('request_appointment').doc(id).get()
                    .then(resp => {
                        ap_id = resp.data().appoint_id
                    })
                await db.collection('appointment').doc(ap_id).delete()
                await db.collection('request_appointment').doc(id).delete()
                    .then(() => {
                        return res.status(200).json({
                            message: "Cancel Request Success",
                            status: {
                                dataStatus: "SUCCESS"
                            }
                        })
                    })
            }
            else {
                return res.status(404).json({
                    message: "No Matching Document",
                    data: []
                })
            }
        })
        .catch(err => {
            return res.status(500).json({
                message: err.message
            })
        })
    }
})

app.put('/approveRequest/:id', permission_professor, async (req, res) => {

    const id = req.params.id
    let uid, email;
    await db.collection('request_appointment').doc(id).update({
        approved_status: "APPROVE"
    })
        .then(async () => {
            await db.collection('request_appointment').doc(id).get()
                .then(appoint => {
                    uid = appoint.data().user_id;
                    return uid;
                })
                .then(async (user_id) => {
                    await db.collection('users').doc(user_id).get()
                        .then(user => {
                            email = user.data().email
                        })
                    await sendEmail(email, '', '', 'PROFESSOR', id, '', '', '', '', '', 'APPROVE')
                })
                .then(async () => {
                    let appoint_id;
                    await db.collection('request_appointment').doc(id).get()
                        .then(appt => {
                            appoint_id = appt.data().appoint_id
                        })
                    await db.collection('appointment').doc(appoint_id).update({
                        status: 'APPROVE'
                    })
                })
                .then(() => {
                    return res.status(200).json({
                        message: "Approve Request Success",
                        status: {
                            dataStatus: "SUCCESS"
                        }
                    })
                })

        })
        .catch(err => {
            return res.status(500).json({
                message: err.message
            })
        })
})

app.delete('/rejectRequest/:id', permission_professor, async (req, res) => {

    const id = req.params.id
    let uid, email;

    await db.collection('request_appointment').doc(id).get()
        .then(async result => {
            let appoint_id;
            if (result.exists) {
                await db.collection('request_appointment').doc(id).get()
                    .then((resp) => {
                        uid = resp.data().user_id;
                        return uid;
                    })
                    .then(async (uid) => {
                        await db.collection('users').doc(uid).get()
                            .then((usr) => {
                                email = usr.data().email;
                            })
                        await sendEmail(email, '', '', 'PROFESSOR', id, '', '', '', '', '', 'REJECT')
                    })

                await db.collection('request_appointment').doc(id).get()
                    .then(appt => {
                        appoint_id = appt.data().appoint_id;
                    })
                await db.collection('appointment').doc(appoint_id).delete();
                await db.collection('request_appointment').doc(id).delete()
                    .then(() => {
                        return res.status(200).json({
                            message: "Reject Request Success",
                            status: {
                                dataStatus: "SUCCESS"
                            }
                        })
                    })
            }
            else {
                return res.status(404).json({
                    message: "No Matching Document",
                    status: {
                        dataStatus: "SUCCESS"
                    },
                    data: []
                })
            }
        })
        .catch(err => {
            return res.status(500).json({
                message: err.message
            })
        })
})

app.get('/getAppointMent/:id', permission_all, async (req, res) => {

    const appoint_id = req.params.id;
    const std = [];
    await db.collection('appointment').doc(appoint_id).get()
        .then(async (resp) => {

            await db.collection('request_appointment').where('appoint_id', '==', appoint_id)
                .get()
                .then(result => {
                    let uid;
                    if (result.empty) {
                        return res.status(404).json({
                            message: "No AppointMent Found",
                            status: {
                                dataStatus: "SUCCESS"
                            },
                            data: []
                        })
                    }
                    result.forEach(row => {
                        uid = row.data().user_id;
                    })
                    return uid
                })
                .then(async (user_id) => {
                    const teacher_name = await getTeacherName(resp.data().teacher_id)
                    const Requestor_name = await getRequestorName(user_id);
                    return res.status(200).json({
                        message: "Get AppointMent Success",
                        status: {
                            dataStatus: "SUCCESS"
                        },
                        data: {
                            id: resp.id,
                            detail: resp.data().Detail,
                            title: resp.data().Title,
                            day: resp.data().day,
                            start_time: resp.data().start_time,
                            end_time: resp.data().end_time,
                            teacher_name: teacher_name,
                            student_name: Requestor_name
                        }
                    })
                })

        })
})

async function getRequestorName(id) {
    let name = '';
    await db.collection('users').doc(id).get()
        .then(user => {
            name = user.data().firstname + " " + user.data().lastname
        })
        .catch(err => {
            return res.status(500).json({
                message: err.mes
            })
        })
    return name;
}

app.get('/ListAppointMentTeacher', permission_professor, async (req, res) => {

    const appoints = [];
    const promise = [];
    const final = [];
    await db.collection('appointment').where('teacher_id', '==', req.user_id)
        .get()
        .then(async resp => {
            resp.forEach(row => {
                console.log(row.id)
                promise.push(db.collection('request_appointment').where('appoint_id', '==', row.id)
                    .where('approved_status', '==', 'APPROVE').get()
                    .then(async (result) => {
                        const teacher_name = await getTeacherName(row.data().teacher_id)
                        result.forEach(record => {
                            final.push({
                                appoint_id: row.id,
                                request_id: record.id,
                                title: row.data().Title,
                                detail: row.data().Detail,
                                day: row.data().day,
                                start_time: row.data().start_time,
                                end_time: row.data().end_time,
                                uid: record.data().user_id,
                                teacher_name: teacher_name,
                                approved_status: record.data().approved_status
                            })
                        })
                    }))
            })
            await Promise.all(promise);
            console.log(final)
            const data = [];
            await db.collection('users').get()
                .then(users => {
                    users.forEach(user => {
                        final.forEach(appoint => {
                            if (user.id === appoint.uid) {
                                data.push({
                                    appoint_id: appoint.appoint_id,
                                    request_id: appoint.request_id,
                                    title: appoint.title,
                                    detail: appoint.detail,
                                    day: appoint.day,
                                    start_time: appoint.start_time,
                                    end_time: appoint.end_time,
                                    student_name: user.data().firstname + " " + user.data().lastname,
                                    teacher_name: appoint.teacher_name,
                                    approved_status: appoint.approved_status
                                })
                            }
                        })
                    })

                })
            return res.status(200).json({
                message: "Get AppointMent By Teacher Success",
                status: {
                    dataStatus: "SUCCESS"
                },
                data: data
            })
        })
        .catch(err => {
            return res.status(500).json({
                message: err.message,
                status: {
                    dataStatus: "FAILURE"
                }
            })
        })

})

async function getEmailTeacher(id) {
    let email;
    await db.collection('users').doc(id).get()
        .then(user => {
            email = user.data().email;
        })
    return email;
}
exports.api = functions.https.onRequest(app);
