"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var twilio = require("twilio");
var dotenv = require("dotenv");
dotenv.config();
var accountSid = process.env.TWILIO_ACCOUNT_SID;
var authToken = process.env.TWILIO_AUTH_TOKEN;
var whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
var client = twilio(accountSid, authToken);
var signups = {
    monday: [],
    friday: []
};
function sendWhatsAppMessage(toNumber, message) {
    return client.messages.create({
        from: whatsappNumber,
        body: message,
        to: toNumber
    });
}
function processMessage(fromNumber, messageBody) {
    var message = messageBody.trim().toLowerCase();
    var response = "";
    if (message.startsWith("signup")) {
        var parts = message.split(/\s+/);
        if (parts.length > 1) {
            var day = parts[1];
            if (["monday", "friday"].includes(day)) {
                var existingIndex = signups[day].findIndex(function (entry) { return entry.phone === fromNumber; });
                if (existingIndex === -1) {
                    signups[day].push({
                        phone: fromNumber,
                        name: "",
                        timestamp: new Date().toISOString()
                    });
                    response = "\u2705 You've signed up for ".concat(day.charAt(0).toUpperCase() + day.slice(1), " training!");
                }
                else {
                    response = "\u26A0\uFE0F You're already signed up for ".concat(day.charAt(0).toUpperCase() + day.slice(1), "!");
                }
            }
            else {
                response = "\u274C Invalid day. Please use: signup monday OR signup friday";
            }
        }
        else {
            response = "\ud83d\udcdd Please specify a day: signup monday OR signup friday";
        }
    }
    else if (message === "list") {
        var mondayCount = signups.monday.length;
        var fridayCount = signups.friday.length;
        response = "\ud83d\udccb Current Signups:\n\nMonday: ".concat(mondayCount, " players\nFriday: ").concat(fridayCount, " players");
    }
    else if (message === "list monday") {
        if (signups.monday.length > 0) {
            var players_1 = signups.monday.map(function (p) { return "- ".concat(p.phone); }).join("\n");
            response = "\ud83c\udfc3 Monday Players (".concat(signups.monday.length, "):\n").concat(players_1);
        }
        else {
            response = "No players signed up for Monday yet.";
        }
    }
    else if (message === "list friday") {
        if (signups.friday.length > 0) {
            var players_2 = signups.friday.map(function (p) { return "- ".concat(p.phone); }).join("\n");
            response = "\ud83c\udfc3 Friday Players (".concat(signups.friday.length, "):\n").concat(players_2);
        }
        else {
            response = "No players signed up for Friday yet.";
        }
    }
    else if (message === "help") {
        response = "\ud83d\udcda Available Commands:\n\u2022 signup monday - Sign up for Monday\n\u2022 signup friday - Sign up for Friday\n\u2022 list - Show player counts\n\u2022 list monday - Show all Monday players\n\u2022 list friday - Show all Friday players\n\u2022 help - Show this message";
    }
    else {
        response = "\u2753 Unknown command. Type 'help' for available commands.";
    }
    sendWhatsAppMessage(fromNumber, response);
}
exports.sendWhatsAppMessage = sendWhatsAppMessage;
exports.processMessage = processMessage;
exports.signups = signups;
