const functions = require('firebase-functions');
const admin = require('firebase-admin')
const express = require('express')
const bodyParser = require('body-parser')

const check_admin_nisit_permission = (req,res,next) => {
    if(req.headers.token === undefined){
        return res.status(401).json({
            message:"Please insert Token"
        })
    }
    else{
        const token = req.headers.token
        admin.auth().verifyIdToken(token)
        .then((claims) => {
            if(claims.admin === true || claims.nisit === true){
                next();
            }
            else{
                return res.status(403).json({
                    message:"You don't have permission"
                })
            }
        })
        .catch(err => {
            return res.status(500).json({
                message: err.message
            })
        })
    }
}

const permission_professor = (req,res,next) => {
    if(req.headers.token === undefined){
        return res.status(401).json({
            message:"Please insert Token"
        })
    }
    else{
        const token = req.headers.token
        admin.auth().verifyIdToken(token)
        .then(claim => {
            if(claim.professor === true){
                req.user_id = claim.user_id
                next()
            }
            else{
                return res.status(403).json({message:"You don't have permission"})
            }
        })
        .catch(err => {
            return res.status(500).json({
                message: err.message
            })
        })
    }
}

const permission_all = (req,res,next) => {
    if(req.headers.token === undefined){
        return res.status(401).json({
            message:"Please insert Token"
        })
    }
    else{
        const token = req.headers.token
        admin.auth().verifyIdToken(token)
        .then(claim => {
            if(claim.professor === true || claim.admin === true || claim.nisit === true){
                req.user_id = claim.user_id
                req.permission = claim
                next()
            }
            else{
                return res.status(403).json({message:"You don't have permission"})
            }
        })
        .catch(err => {
            return res.status(500).json({
                message: err.message
            })
        })
    }
}

const nisit_permission = (req,res,next) => {
    if(req.headers.token === undefined){
        return res.status(401).json({
            message:"Please insert Token"
        })
    }
    else{
        const token = req.headers.token
        admin.auth().verifyIdToken(token)
        .then(claim => {
            if(claim.nisit === true){
                req.user_id = claim.user_id
                next()
            }
            else{
                return res.status(403).json({message:"You don't have permission"})
            }
        })
        .catch(err => {
            return res.status(500).json({
                message: err.message
            })
        })
    }
}
module.exports = {
    check_admin_nisit_permission,
    permission_professor,
    permission_all,
    nisit_permission
}