const nodemailer = require('nodemailer');

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'cpekukps10@gmail.com', // your email
        pass: 'Cpe_ku_kps10' // your email password
    }
})

async function sendEmail(email_to, firstname, lastname, role, request_id, title, detail,day, start_time, end_time, action) {

    let mailoptions;
    if (role === 'PROFESSOR') {
        if (action === 'APPROVE') {
            mailoptions = {
                from: `cpekukps10@gmail.com`,
                to: `${email_to}`,
                subject: `หมายเลขการนัดพบ #${request_id}`,
                html: `หมายเลขการนัดพบ ${request_id} ของคุณ ได้รับการยืนยันเรียบร้อยแล้ว`
            }
        }
        else if(action === 'REJECT'){
            mailoptions = {
                from: `cpekukps10@gmail.com`,
                to: `${email_to}`,
                subject: `หมายเลขการนัดพบ #${request_id}`,
                html: `หมายเลขการนัดพบ ${request_id} ของคุณ ได้ถูกปฎิเสธ`
            }
        }
        else if(action === 'APPOINTMENT'){
            mailoptions = {
                from: `cpekukps10@gmail.com`,
                to: `${email_to}`,
                subject: `หมายเลขการนัดพบ #${request_id}`,
                html: `คุณ ${firstname} ${lastname} นัดพบคุณ เรื่อง ${title}
                  รายละเอียด ${detail} ${day} เวลา ${start_time} - ${end_time}`
            }
        }
        else if(action === 'CANCEL'){
            mailoptions = {
                from: `cpekukps10@gmail.com`,
                to: `${email_to}`,
                subject: `หมายเลขการนัดพบ #${request_id}`,
                html: `หมายเลขการนัดพบ #${request_id} เรื่อง ${title} รายละเอียด ${detail} ${day} เวลา ${start_time} - ${end_time} นิสิตได้ยกเลิกแล้ว`
            }
        }
    }
    else if(role === 'NISIT'){
        if(action === 'APPOINTMENT'){
            mailoptions = {
                from: `cpekukps10@gmail.com`,
                to: `${email_to}`,
                subject: `หมายเลขการนัดพบ #${request_id}`,
                html: `คุณได้ทำการนัดพบอาจารย์เรียบร้อยแล้ว ${title} ${detail} ${day} เวลา ${start_time} - ${end_time} กรุณารออาจารย์อนุมัติการนัดพบ`
            }
        }
        if(action === 'CANCEL'){
            mailoptions = {
                from: `cpekukps10@gmail.com`,
                to: `${email_to}`,
                subject: `หมายเลขการนัดพบ #${request_id}`,
                html: `อาจารย์ได้ทำการยกเลิกนัด #${request_id} ${title} ${detail} ${day} ${start_time} - ${end_time} ของนิสิตแล้ว`
            }
        }
    }
    else if(role === 'ADMIN'){
        if(action === 'APPOINTMENT'){
            mailoptions = {
                from: `cpekukps10@gmail.com`,
                to: `${email_to}`,
                subject: `หมายเลขการนัดพบ #${request_id}`,
                html: `ผู้ดูแลระบบได้เพิ่มการนัดหมาย เรื่อง ${title} รายละเอียด ${detail} เวลา ${start_time} - ${end_time} ให้คุณแล้ว`
            }
        }
        else if(action === 'SELF'){
            mailoptions = {
                from: `cpekukps10@gmail.com`,
                to: `${email_to}`,
                subject: `หมายเลขการนัดพบ #${request_id}`,
                html: `คุณได้เพิ่มการนัดพบให้อาจารย์เรียบร้อยแล้ว ${title} ${detail} ${day} เวลา ${start_time} - ${end_time} `
            }
        }
        else if(action === 'CANCEL'){
            mailoptions = {
                from: `cpekukps10@gmail.com`,
                to: `${email_to}`,
                subject: `หมายเลขการนัดพบ #${request_id}`,
                html: `หมายเลขการนัดพบ #${request_id} เรื่อง ${title} รายละเอียด ${detail} ${day} เวลา ${start_time} - ${end_time} ผู้ดูแลระบบได้ยกเลิกแล้ว`
            }
        }
    }

    return transporter.sendMail(mailoptions, (err, info) => {
        if (err) {
            console.log("Error : ", err.toString())
        }
        console.log('send')
    });
}

module.exports = {
    sendEmail
}