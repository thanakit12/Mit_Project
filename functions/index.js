const functions = require('firebase-functions');
const admin = require("firebase-admin");
const FirebaseAuth = require('firebaseauth')
const serviceAccount = require("./serviceAccount.json");
const bodyParser = require('body-parser')
const cors =require('cors');
const express = require('express');

const { check_admin_nisit_permission,permission_professor,permission_all,nisit_permission } = require('./permission/func')

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://mitproject-895cc.firebaseio.com"
  });
  
const app = express();
const firebase = new FirebaseAuth("AIzaSyC3-bfM3oSxRmedmIz7wa6kbKs2byqQpq4");
const db = admin.firestore();

app.use(bodyParser.json())
app.use(cors())

app.post('/Register',async(req,res) => {

    const email = req.body.email
    const password = req.body.password
    const extras = {
        name : req.body.firstname + " " + req.body.lastname
    }

    await db.collection('users').where('id','==',req.body.id).get()
    .then((response) => {
        let customclaims;
        if(response.empty){
            const user_data = {
                id: req.body.id,
                firstname: req.body.firstname,
                lastname : req.body.lastname,
                email : req.body.email,
                role : req.body.role
            }
            if(req.body.role === 'ADMIN'){
                customclaims = {
                    admin:true
                }
            }
            else if(req.body.role === 'PROFESSOR'){
                customclaims = {
                    professor:true
                }
            }
            else if(req.body.role === 'NISIT'){
                customclaims = {
                    nisit : true
                }
            }
           firebase.registerWithEmail(email,password,extras,function(err,data){
            if(err){
                return res.status(500).json({
                    message:err.message
                })
            }
             else{
                 const user = data.user
                 const uid = user.id
                 console.log(customclaims)
                 admin.auth().setCustomUserClaims(uid,customclaims)
                 .then(async () => {
                    await db.collection('users').doc(uid).set(user_data)
                    .then(() => {
                        return res.status(201).json({
                            message:"Register Success",
                            status:{
                                dataStatus:"SUCCESS"
                            }
                        })
                    })
                 })
                 .catch(err => {
                     return res.status(500).json({
                         message:err.message
                     })
                 })
             }
           })
        }
        else{
            return res.status(500).json({
                message:"ไม่สามารถเพิ่มได้ เนื่องจากมีบุคคลนี้แล้ว"
            })
        }
    })
})

app.post('/login',(req,res) => {

    const email = req.body.email;
    const password = req.body.password;
    firebase.signInWithEmail(email,password,async function(err,data){
        if(err){
            return res.status(500).json({
                message: err.message
            })
        }
        else{
            const user = data.user
            const uid = user.id
            await db.collection('users').doc(uid).get()
            .then(result => {
                if(result.exists){
                    user.role = result.data().role
                }
               return res.status(200).json({
                   message:"Login Success",
                   status:{
                       dataStatus:"SUCCESS"
                   },
                   data: data
               })
            })
            .catch(err => {
                return res.status(500).json({
                    message:err.message
                })
            })
        }
    })
})


app.get('/ListTeacher',check_admin_nisit_permission,async (req,res) => {

    await db.collection('users').where('role','==','PROFESSOR')
    .get()
    .then(user => {
        if(user.empty){
            return res.status(404).json({
                message:"No Teacher Found "
            })
        }
        else{
            const result = [];
            user.forEach(row => {
                result.push({
                    id:row.id,
                    firstname : row.data().firstname,
                    lastname : row.data().lastname,
                    profess_id : row.data().id,
                    email : row.data().email
                })
            })
            return res.status(200).json({
                message: "Get List Teacher Success",
                status:{
                    dataStatus:"SUCCESS"
                },
                data : result
            })
        }
    })
})


//AppointMent
app.post('/postAppointMent',permission_all,async (req,res) => {

    const data = {
        Title : req.body.Title,
        Detail: req.body.Detail,
        day : req.body.day,
        start_time : req.body.start_time,
        end_time : req.body.end_time,
        teacher_id : req.body.teacher_id,
        approved_status : 'PENDING'
    }

    await db.collection('appointment').add(data)
    .then(async (rec) => {
        await db.collection('request_appointment').add({
            user_id : req.user_id,
            appoint_id : rec.id,
            approved_status:'PENDING'
        })

        return res.status(201).json({
            message:"Post Appoint Ment Success",
            status:{
                dataStatus:"SUCCESS"
            }
        })
    })
    .catch(err => {
        return res.status(500).json({
            message: err.message
        })
    })
})


//Ajarn get AppointMent

app.get('/ListAppointMent',permission_professor ,async (req,res) => {

    await db.collection('appointment').where('teacher_id','==',req.user_id)
    .get()
    .then(async result => {
        if(result.empty){
            return res.status(404).json({
                message:"No List Appointment "
            })
        }

        const promise = [];

        const aa = [];
        result.forEach(row => {
            promise.push(db.collection('request_appointment').where('appoint_id','==',row.id).get()
            .then(resp => {
                resp.forEach(rec => {
                    aa.push({
                        id:row.id,
                        title : row.data().Title,
                        detail : row.data().Detail,
                        day : row.data().day,
                        start_time : row.data().start_time,
                        end_time : row.data().end_time,
                        user_id : rec.data().user_id,
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
                    if(user.id === appoint.user_id){
                        data.push({
                            id:appoint.id,
                            title :appoint.title,
                            detail :appoint.detail,
                            day : appoint.day,
                            start_time : appoint.start_time,
                            end_time : appoint.end_time,
                            student_name : user.data().firstname,
                            approved_status : appoint.status
                        })
                    }
                })
            })
        })
      
         return res.status(200).json({
            message:"List AppointMent Success",
            status:{
                dataStatus:"SUCCESS"
            },
            data : data
        })
    })
})

async function getTeacherName(id){
    let teacher_name;
    await db.collection('users').doc(id).get()
    .then(user => {
        teacher_name = user.data().firstname + " " + user.data().lastname
    })
    return teacher_name;
}

app.get('/ListStudentAppoint',nisit_permission,async (req,res) => {

    const appoint = [];
    await db.collection('request_appointment').where('user_id','==',req.user_id)
    .get()
    .then(async resp => {
        resp.forEach(row => {
            appoint.push({
                id: row.id,
                user_id : row.data().user_id,
                appoint_id : row.data().appoint_id,
                approved_status : row.data().approved_status
            })
        })

        const promise = [];
        const people_appoint = [];
        appoint.forEach(rec => {
            promise.push(db.collection('appointment').doc(rec.appoint_id)
            .get()
            .then(async result => {
                let teacher_name = await getTeacherName(result.data().teacher_id)
                 people_appoint.push({
                    request_id : rec.id,
                    user_id : rec.user_id,
                    title :result.data().Title,
                    detail: result.data().Detail,
                    day: result.data().day,
                    start_time : result.data().start_time,
                    end_time : result.data().end_time,
                    approved_status : rec.approved_status,
                    teacher_id : result.data().teacher_id,
                    teacher_name: teacher_name
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
                    title :people.title,
                    detail: people.detail,
                    day: people.day,
                    start_time : people.start_time,
                    end_time : people.end_time,
                    approved_status : people.approved_status,
                    teacher_name: people.teacher_name
                })
            })
            return res.status(200).json({
                message:"Get Appoint By Student Success",
                data:{
                    id:result.data().id,
                    firstname : result.data().firstname,
                    lastname: result.data().lastname,
                    appoints: appoints
                }
            })
        })

    })
})



exports.api = functions.https.onRequest(app);
