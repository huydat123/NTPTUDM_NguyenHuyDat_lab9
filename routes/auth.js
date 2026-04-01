var express = require("express");
var router = express.Router();
let userController = require('../controllers/users');
let bcrypt = require('bcrypt');
let jwt = require('jsonwebtoken');
let crypto = require('crypto');
const { CheckLogin } = require("../utils/authHandler");
let mongoose = require('mongoose');
let cartModel = require('../schemas/carts');
const { ChangePasswordValidator, validatedResult } = require("../utils/validateHandler");

// REGISTER
router.post('/register', async function (req, res, next) {
    try {
        let { username, password, email } = req.body;

        let newUser = await userController.CreateAnUser(
            username,
            password,
            email,
            "69b0ddec842e41e8160132b8"
        );

        let newCart = new cartModel({
            user: newUser._id
        });

        await newCart.save();
        await newCart.populate('user');

        res.send(newCart);
    } catch (error) {
        res.status(400).send({
            message: error.message
        });
    }
});

// LOGIN
router.post('/login', async function (req, res, next) {
    try {
        let { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).send({
                message: "username va password la bat buoc"
            });
        }

        let user = await userController.GetAnUserByUsername(username);

        if (!user) {
            return res.status(404).send({
                message: "thong tin dang nhap sai"
            });
        }

        if (user.lockTime && user.lockTime > Date.now()) {
            return res.status(403).send({
                message: "ban dang bi khoa tam thoi"
            });
        }

        let isMatch = bcrypt.compareSync(password, user.password);

        if (isMatch) {
            user.loginCount = 0;
            user.lockTime = null;
            await user.save();

            let token = jwt.sign(
                { id: user._id },
                'secret',
                { expiresIn: '1h' }
            );

            res.cookie('NNPTUD_S4', token, {
                maxAge: 30 * 24 * 3600 * 1000,
                httpOnly: true,
                secure: false
            });

            return res.send({
                message: "dang nhap thanh cong",
                token: token,
                user: user
            });
        } else {
            user.loginCount = (user.loginCount || 0) + 1;

            if (user.loginCount >= 3) {
                user.loginCount = 0;
                user.lockTime = Date.now() + 3600 * 1000;
            }

            await user.save();

            return res.status(404).send({
                message: "thong tin dang nhap sai"
            });
        }
    } catch (error) {
        return res.status(500).send({
            message: error.message
        });
    }
});

// ME
router.get('/me', CheckLogin, function (req, res, next) {
    res.send(req.user);
});

// LOGOUT
router.post('/logout', CheckLogin, function (req, res, next) {
    res.cookie('NNPTUD_S4', "", {
        maxAge: 0,
        httpOnly: true,
        secure: false
    });
    res.send({
        message: "logout"
    });
});

// CHANGE PASSWORD
router.post(
    '/changepassword',
    CheckLogin,
    ChangePasswordValidator,
    validatedResult,
    async function (req, res, next) {
        try {
            let { oldpassword, newpassword } = req.body;
            let user = req.user;

            if (!oldpassword || !newpassword) {
                return res.status(400).send({
                    message: "oldpassword va newpassword la bat buoc"
                });
            }

            if (bcrypt.compareSync(oldpassword, user.password)) {
                user.password = newpassword;
                await user.save();

                return res.send({
                    message: "da cap nhat"
                });
            } else {
                return res.status(400).send({
                    message: "old password khong dung"
                });
            }
        } catch (error) {
            return res.status(500).send({
                message: error.message
            });
        }
    }
);

// FORGOT PASSWORD
router.post('/forgotpassword', async function (req, res, next) {
    try {
        let email = req.body.email;
        let user = await userController.GetAnUserByEmail(email);

        if (user) {
            user.forgotPasswordToken = crypto.randomBytes(32).toString('hex');
            user.forgotPasswordTokenExp = Date.now() + 10 * 60000;

            let url = "http://localhost:3000/api/v1/auth/resetpassword/" + user.forgotPasswordToken;
            await user.save();

            console.log("Reset password url:", url);
        }

        res.send({
            message: "check mail"
        });
    } catch (error) {
        res.status(500).send({
            message: error.message
        });
    }
});

module.exports = router;