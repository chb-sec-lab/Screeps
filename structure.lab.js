/**
 * structure.lab.js - SCOS Lab Network
 * Orchestriert chemische Reaktionen im Labor-Diamanten.
 */
module.exports = {
    run: function(room) {
        const labs = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB });
        if (labs.length < 3) return; // Wir brauchen mindestens 2 Inputs und 1 Output

        let input1 = null;
        let input2 = null;
        const outputs = [];

        // Nutze den gespeicherten Anker des Auto-Planners, um die Labore logisch zuzuordnen
        if (room.memory.labAnchor) {
            const ax = room.memory.labAnchor.x;
            const ay = room.memory.labAnchor.y;
            
            labs.forEach(lab => {
                // Der Planner setzt die Inputs auf [0,1] und [1,2] relativ zum Anker
                if (lab.pos.x === ax + 0 && lab.pos.y === ay + 1) input1 = lab;
                else if (lab.pos.x === ax + 1 && lab.pos.y === ay + 2) input2 = lab;
                else outputs.push(lab);
            });
        }

        // Sicherheitsabbruch, falls die Input-Labore noch im Bau sind
        if (!input1 || !input2 || outputs.length === 0) return;

        // --- REAKTIONEN DURCHFÜHREN ---
        // Labore haben einen Cooldown. Wir geben einfach jeden Tick den Befehl, 
        // die Engine führt ihn automatisch aus, sobald der Cooldown auf 0 ist.
        const in1Ready = Object.keys(input1.store).some(k => k !== RESOURCE_ENERGY);
        const in2Ready = Object.keys(input2.store).some(k => k !== RESOURCE_ENERGY);
        
        if (in1Ready && in2Ready) {
            outputs.forEach(outLab => {
                if (outLab.cooldown === 0 && outLab.store.getFreeCapacity() > 0) {
                    outLab.runReaction(input1, input2);
                }
            });
        }
    }
};