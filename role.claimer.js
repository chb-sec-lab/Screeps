/**
 * role.claimer.js - SCOS v6.1.0
 * Updated: 2026-02-13 CET (Europe/Amsterdam)
 * Behavior:
 *  - targetRoom: creep.memory.targetRoom || rooms.EXPANSION || rooms.TARGET
 *  - mode: creep.memory.claimMode = "claim" | "reserve" (default reserve)
 */
const rooms = require('config.rooms');

module.exports = {
    run: function (creep) {

        const targetRoom = creep.memory.targetRoom || rooms.EXPANSION || rooms.TARGET;
        const mode = creep.memory.claimMode || "reserve"; // safer default

        // Travel to target room
        if (creep.room.name !== targetRoom) {
            const exit = creep.pos.findClosestByRange(creep.room.findExitTo(targetRoom));
            creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' } });
            creep.say('➡️ ' + targetRoom);
            return;
        }

        // In target room: act on controller
        const ctrl = creep.room.controller;
        if (!ctrl) return;

        if (mode === "claim") {
            const res = creep.claimController(ctrl);
            if (res === ERR_NOT_IN_RANGE) creep.moveTo(ctrl, { visualizePathStyle: { stroke: '#ffffff' } });
            else if (res === ERR_GCL_NOT_ENOUGH) creep.say('GCL?');
            else if (res === OK) creep.say('🏳️ Claim');
            return;
        }

        // Default: reserve
        const res = creep.reserveController(ctrl);
        if (res === ERR_NOT_IN_RANGE) creep.moveTo(ctrl, { visualizePathStyle: { stroke: '#ffffff' } });
        else if (res === OK) creep.say('📌 Reserve');
    }
};
